import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createThumbnail, optimizeFull } from './convert.mjs';
import {
  buildManifest,
  pruneCandidates,
  stampPublishedImageCommit,
  validatePublishedManifest
} from './manifest.mjs';
import { scanReferences } from './scan.mjs';
import { assertSafeRoot, resolveSafeImagePath, resolveSafePath } from './safe-paths.mjs';
import { applyReferenceMap, upsertThumbnail } from './update.mjs';

const HELP = `Usage:
  npm run images -- <audit|apply|stamp|prune> --blog-root <absolute path> --image-root <absolute path> [options]

Commands:
  audit  Scan both repositories and write the required --report JSON file.
  apply  Require clean worktrees, create eligible WebP outputs, update references, and write the manifest.
  stamp  Verify adopted outputs at --image-commit and record the resolved commit in the manifest.
  prune  Require clean worktrees and --report; dry-run unless --confirm-prune is supplied.

Options:
  --blog-root <path>   Required absolute blog repository path.
  --image-root <path>  Required absolute image repository path.
  --report <path>      Required audit or prune JSON report path.
  --image-commit <id>  Required explicit image commit/ref for stamp; the resolved full SHA is stored.
  --confirm-prune      Delete after prune preflight; without it prune is read-only.
  --help               Show this help text.
`;

function requireClean(root) {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (status.trim()) throw new Error(`worktree is not clean: ${root}`);
}

async function requireAbsoluteDirectory(option, value) {
  if (!value || !isAbsolute(value)) throw new Error(`${option} must be an absolute path`);
  const path = resolve(value);
  if (!(await stat(path)).isDirectory()) throw new Error(`${option} must be an existing directory: ${path}`);
  return path;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonIfChanged(path, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  try {
    if (await readFile(path, 'utf8') === content) return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function saveConversion(target, conversion) {
  target.adopted = conversion.adopted;
  target.outputBytes = conversion.outputBytes;
  target.reason = conversion.reason;
  target.width = conversion.width;
  target.height = conversion.height;
  target.pages = conversion.pages;
  target.format = conversion.format;
}

async function stagedOutputPath(stagingRoot, outputPath) {
  return resolveSafePath(stagingRoot, outputPath, 'staged output', { allowMissing: true });
}

async function createStagedOutputs(manifest, imageRoot, stagingRoot) {
  for (const entry of manifest.entries) {
    const source = await resolveSafeImagePath(imageRoot, entry.sourcePath);
    if (entry.full.reason === 'eligible') {
      saveConversion(entry.full, await optimizeFull(source, await stagedOutputPath(stagingRoot, entry.full.path)));
    }
    if (entry.thumbnail.reason === 'eligible') {
      saveConversion(entry.thumbnail, await createThumbnail(source, await stagedOutputPath(stagingRoot, entry.thumbnail.path)));
    }
  }
}

async function prepareReferenceUpdates(manifest, blogRoot, pendingSources) {
  const replacementByRawUrl = new Map();
  const updatesByFile = new Map();
  for (const entry of manifest.entries) {
    if (!pendingSources.has(entry.sourcePath)) continue;
    if (entry.full.adopted) {
      for (const reference of entry.references) {
        replacementByRawUrl.set(reference.rawUrl, entry.full.url);
        updatesByFile.set(reference.file, updatesByFile.get(reference.file) ?? []);
      }
    }
    if (!entry.thumbnail.adopted) continue;
    for (const reference of entry.references) {
      if (reference.scope !== 'published' || reference.kind !== 'cover') continue;
      const updates = updatesByFile.get(reference.file) ?? [];
      updates.push({
        fullUrl: entry.full.adopted ? entry.full.url : reference.rawUrl,
        thumbnailUrl: entry.thumbnail.url
      });
      updatesByFile.set(reference.file, updates);
    }
  }

  const prepared = [];
  for (const [file, thumbnailUpdates] of updatesByFile) {
    const path = await resolveSafePath(blogRoot, file, 'blog source');
    const source = await readFile(path, 'utf8');
    let updated = applyReferenceMap(source, replacementByRawUrl);
    for (const update of thumbnailUpdates) {
      updated = upsertThumbnail(updated, update.fullUrl, update.thumbnailUrl);
    }
    if (updated !== source) prepared.push({ path, updated });
  }
  return prepared;
}

async function prepareOutputInstallations(manifest, imageRoot, stagingRoot, pendingOutputs) {
  const installations = [];
  for (const entry of manifest.entries) {
    for (const output of [entry.full, entry.thumbnail]) {
      if (!output.adopted || !pendingOutputs.has(output.path)) continue;
      const staged = await resolveSafePath(stagingRoot, output.path, 'staged output');
      const destination = await resolveSafeImagePath(imageRoot, output.path, { allowMissing: true });
      installations.push({ staged, destination, outputPath: output.path });
    }
  }
  return installations;
}

async function installStagedOutputs(installations, imageRoot) {
  for (const { staged, destination, outputPath } of installations) {
    await mkdir(dirname(destination), { recursive: true });
    const checkedDestination = await resolveSafeImagePath(imageRoot, outputPath, { allowMissing: true });
    await rm(checkedDestination, { force: true });
    await rename(staged, checkedDestination);
  }
}

async function writeReferenceUpdates(updates) {
  for (const { path, updated } of updates) await writeFile(path, updated);
}

async function manifestPath(blogRoot, options) {
  return resolveSafePath(blogRoot, join('tools', 'image-pipeline', 'manifest.json'), 'manifest', options);
}

async function readExistingManifest(blogRoot) {
  const path = await manifestPath(blogRoot, { allowMissing: true });
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function runAudit(blogRoot, imageRoot, report) {
  if (!report) throw new Error('--report is required for audit');
  const previousManifest = await readExistingManifest(blogRoot);
  await writeJson(report, await buildManifest(blogRoot, imageRoot, { previousManifest }));
}

async function runApply(blogRoot, imageRoot) {
  requireClean(blogRoot);
  requireClean(imageRoot);
  let stagingRoot;
  try {
    const previousManifest = await readExistingManifest(blogRoot);
    const manifest = await buildManifest(blogRoot, imageRoot, { previousManifest });
    const pendingEntries = manifest.entries.filter(({ full, thumbnail }) =>
      full.reason === 'eligible' || thumbnail.reason === 'eligible');
    const pendingSources = new Set(pendingEntries.map(({ sourcePath }) => sourcePath));
    const pendingOutputs = new Set(pendingEntries.flatMap(({ full, thumbnail }) => [full, thumbnail])
      .filter(({ reason }) => reason === 'eligible').map(({ path }) => path));
    const outputManifest = await manifestPath(blogRoot, { allowMissing: true });
    if (pendingOutputs.size > 0) {
      stagingRoot = await mkdtemp(join(imageRoot, '.image-pipeline-staging-'));
      await createStagedOutputs(manifest, imageRoot, stagingRoot);
    }
    const updates = await prepareReferenceUpdates(manifest, blogRoot, pendingSources);
    const installations = pendingOutputs.size > 0
      ? await prepareOutputInstallations(manifest, imageRoot, stagingRoot, pendingOutputs)
      : [];
    await installStagedOutputs(installations, imageRoot);
    await writeReferenceUpdates(updates);
    await writeJsonIfChanged(outputManifest, manifest);
  } finally {
    if (stagingRoot) await rm(stagingRoot, { recursive: true, force: true });
  }
}

async function runStamp(blogRoot, imageRoot, imageCommit) {
  if (!imageCommit) throw new Error('--image-commit is required for stamp');
  const outputManifest = await manifestPath(blogRoot);
  const manifest = JSON.parse(await readFile(outputManifest, 'utf8'));
  await writeJson(outputManifest, await stampPublishedImageCommit(manifest, imageRoot, imageCommit));
}

async function runPrune(blogRoot, imageRoot, confirmPrune, report) {
  if (!report) throw new Error('--report is required for prune');
  requireClean(blogRoot);
  requireClean(imageRoot);
  const manifest = JSON.parse(await readFile(await manifestPath(blogRoot), 'utf8'));
  await validatePublishedManifest(manifest, imageRoot);
  const currentRefs = new Set((await scanReferences(blogRoot)).map(({ repoPath }) => repoPath));
  const candidates = pruneCandidates(manifest, currentRefs);
  const resolvedCandidates = [];
  for (const path of candidates) {
    const absolute = await resolveSafeImagePath(imageRoot, path);
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error(`prune candidate is not a file: ${path}`);
    resolvedCandidates.push({ path, bytes: info.size, absolute });
  }
  const plan = {
    schemaVersion: 1,
    mode: confirmPrune ? 'delete' : 'dry-run',
    status: confirmPrune ? 'ready' : 'planned',
    publishedImageCommit: manifest.publishedImageCommit,
    candidates: resolvedCandidates.map(({ path, bytes }) => ({ path, bytes })),
    totalBytes: resolvedCandidates.reduce((sum, { bytes }) => sum + bytes, 0)
  };
  await writeJson(report, plan);
  console.log(JSON.stringify(plan, null, 2));
  if (!confirmPrune) return;

  const deleted = [];
  try {
    for (const { path, absolute } of resolvedCandidates) {
      await unlink(absolute);
      deleted.push(path);
    }
  } catch (error) {
    await writeJson(report, { ...plan, status: 'failed', deleted, error: error.message });
    throw error;
  }
  await writeJson(report, { ...plan, status: 'completed', deleted });
}

async function main() {
  if (process.argv.slice(2).includes('--help')) {
    process.stdout.write(HELP);
    return;
  }
  const { values, positionals } = parseArgs({
    options: {
      'blog-root': { type: 'string' },
      'image-root': { type: 'string' },
      report: { type: 'string' },
      'image-commit': { type: 'string' },
      'confirm-prune': { type: 'boolean' }
    },
    allowPositionals: true
  });
  const command = positionals[0];
  if (!['audit', 'apply', 'stamp', 'prune'].includes(command) || positionals.length !== 1) {
    throw new Error('command must be exactly one of: audit, apply, stamp, prune');
  }
  const blogRoot = await requireAbsoluteDirectory('--blog-root', values['blog-root']);
  const imageRoot = await requireAbsoluteDirectory('--image-root', values['image-root']);
  await assertSafeRoot(blogRoot, 'blog root');
  await assertSafeRoot(imageRoot, 'image root');
  const report = values.report && resolve(values.report);

  if (command === 'audit') await runAudit(blogRoot, imageRoot, report);
  else if (command === 'apply') await runApply(blogRoot, imageRoot);
  else if (command === 'stamp') await runStamp(blogRoot, imageRoot, values['image-commit']);
  else await runPrune(blogRoot, imageRoot, values['confirm-prune'], report);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
