import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createThumbnail, optimizeFull } from './convert.mjs';
import { buildManifest, pruneCandidates } from './manifest.mjs';
import { scanReferences } from './scan.mjs';
import { assertSafeRoot, resolveSafeImagePath, resolveSafePath } from './safe-paths.mjs';
import { applyReferenceMap, upsertThumbnail } from './update.mjs';

const HELP = `Usage:
  npm run images -- <audit|apply|prune> --blog-root <absolute path> --image-root <absolute path> [--report <path>] [--confirm-prune]

Commands:
  audit  Scan both repositories and write the required --report JSON file.
  apply  Require clean worktrees, create eligible WebP outputs, update references, and write the manifest.
  prune  Require clean worktrees and --confirm-prune before deleting adopted, unreferenced source images.

Options:
  --blog-root <path>   Required absolute blog repository path.
  --image-root <path>  Required absolute image repository path.
  --report <path>      Required audit report path.
  --confirm-prune      Required acknowledgement before prune deletes any source image.
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

function saveConversion(target, conversion) {
  target.adopted = conversion.adopted;
  target.outputBytes = conversion.outputBytes;
  target.reason = conversion.reason;
  target.width = conversion.width;
  target.height = conversion.height;
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

async function prepareReferenceUpdates(manifest, blogRoot) {
  const replacementByRawUrl = new Map();
  const updatesByFile = new Map();
  for (const entry of manifest.entries) {
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

async function prepareOutputInstallations(manifest, imageRoot, stagingRoot) {
  const installations = [];
  for (const entry of manifest.entries) {
    for (const output of [entry.full, entry.thumbnail]) {
      if (!output.adopted) continue;
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

async function runAudit(blogRoot, imageRoot, report) {
  if (!report) throw new Error('--report is required for audit');
  await writeJson(report, await buildManifest(blogRoot, imageRoot));
}

async function runApply(blogRoot, imageRoot) {
  requireClean(blogRoot);
  requireClean(imageRoot);
  let stagingRoot;
  try {
    const manifest = await buildManifest(blogRoot, imageRoot);
    stagingRoot = await mkdtemp(join(imageRoot, '.image-pipeline-staging-'));
    await createStagedOutputs(manifest, imageRoot, stagingRoot);
    const updates = await prepareReferenceUpdates(manifest, blogRoot);
    const installations = await prepareOutputInstallations(manifest, imageRoot, stagingRoot);
    const outputManifest = await manifestPath(blogRoot, { allowMissing: true });
    await installStagedOutputs(installations, imageRoot);
    await writeReferenceUpdates(updates);
    await writeJson(outputManifest, manifest);
  } finally {
    if (stagingRoot) await rm(stagingRoot, { recursive: true, force: true });
  }
}

async function runPrune(blogRoot, imageRoot, confirmPrune) {
  if (!confirmPrune) throw new Error('prune requires --confirm-prune');
  requireClean(blogRoot);
  requireClean(imageRoot);
  const manifest = JSON.parse(await readFile(await manifestPath(blogRoot), 'utf8'));
  const currentRefs = new Set((await scanReferences(blogRoot)).map(({ repoPath }) => repoPath));
  const candidates = pruneCandidates(manifest, currentRefs);
  console.log(JSON.stringify(candidates, null, 2));
  for (const sourcePath of candidates) await unlink(await resolveSafeImagePath(imageRoot, sourcePath));
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
      'confirm-prune': { type: 'boolean' }
    },
    allowPositionals: true
  });
  const command = positionals[0];
  if (!['audit', 'apply', 'prune'].includes(command) || positionals.length !== 1) {
    throw new Error('command must be exactly one of: audit, apply, prune');
  }
  const blogRoot = await requireAbsoluteDirectory('--blog-root', values['blog-root']);
  const imageRoot = await requireAbsoluteDirectory('--image-root', values['image-root']);
  await assertSafeRoot(blogRoot, 'blog root');
  await assertSafeRoot(imageRoot, 'image root');
  const report = values.report && resolve(values.report);

  if (command === 'audit') await runAudit(blogRoot, imageRoot, report);
  else if (command === 'apply') await runApply(blogRoot, imageRoot);
  else await runPrune(blogRoot, imageRoot, values['confirm-prune']);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
