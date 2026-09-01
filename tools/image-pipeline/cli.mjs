import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  prune  Write a bound dry-run plan, or confirm an existing unchanged plan.

Options:
  --blog-root <path>   Required absolute blog repository path.
  --image-root <path>  Required absolute image repository path.
  --report <path>      Required audit or prune JSON report path.
  --image-commit <id>  Required explicit image commit/ref for stamp; the resolved full SHA is stored.
  --confirm-prune      Delete only when the existing --report still matches every binding.
  --help               Show this help text.
`;

const PRUNE_REPORT_SCHEMA_VERSION = 2;
const FULL_SHA = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

function requireClean(root) {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (status.trim()) throw new Error(`worktree is not clean: ${root}`);
}

function gitHead(root) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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
  const updatesByFile = new Map();
  const updateFor = (file) => {
    const update = updatesByFile.get(file) ?? { replacements: new Map(), thumbnails: [] };
    updatesByFile.set(file, update);
    return update;
  };
  for (const entry of manifest.entries) {
    if (!pendingSources.has(entry.sourcePath)) continue;
    if (entry.full.adopted) {
      for (const reference of entry.references) {
        updateFor(reference.file).replacements.set(reference.rawUrl, entry.full.url);
      }
    }
    if (!entry.thumbnail.adopted) continue;
    for (const reference of entry.references) {
      if (reference.scope !== 'published' || reference.kind !== 'cover') continue;
      updateFor(reference.file).thumbnails.push({
        fullUrl: entry.full.adopted ? entry.full.url : reference.rawUrl,
        thumbnailUrl: entry.thumbnail.url
      });
    }
  }

  for (const repair of manifest.referenceRepairs ?? []) {
    const update = updateFor(repair.file);
    if (repair.type === 'replace-reference') {
      const existing = update.replacements.get(repair.fromUrl);
      if (existing && existing !== repair.toUrl) {
        throw new Error(`conflicting reference repair in ${repair.file}: ${repair.fromUrl}`);
      }
      update.replacements.set(repair.fromUrl, repair.toUrl);
    } else if (repair.type === 'upsert-thumbnail') {
      update.thumbnails.push({ fullUrl: repair.fullUrl, thumbnailUrl: repair.thumbnailUrl });
    } else {
      throw new Error(`unknown reference repair type: ${repair.type}`);
    }
  }

  const prepared = [];
  for (const [file, { replacements, thumbnails }] of updatesByFile) {
    const path = await resolveSafePath(blogRoot, file, 'blog source');
    const source = await readFile(path, 'utf8');
    let updated = applyReferenceMap(source, replacements);
    for (const update of thumbnails) {
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
  const manifest = await buildManifest(blogRoot, imageRoot, { previousManifest });
  await writeJson(report, {
    ...manifest,
    referenceRepairs: manifest.referenceRepairs ?? []
  });
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
    const { referenceRepairs, ...storedManifest } = manifest;
    await writeJsonIfChanged(outputManifest, storedManifest);
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

function pruneBinding(plan) {
  return {
    schemaVersion: plan.schemaVersion,
    blogHead: plan.blogHead,
    imageHead: plan.imageHead,
    manifestSha256: plan.manifestSha256,
    publishedImageCommit: plan.publishedImageCommit,
    candidates: plan.candidates,
    totalBytes: plan.totalBytes
  };
}

function digestPruneBinding(plan) {
  return sha256(JSON.stringify(pruneBinding(plan)));
}

function validateReviewedPrunePlan(plan) {
  if (!plan || typeof plan !== 'object' || plan.schemaVersion !== PRUNE_REPORT_SCHEMA_VERSION) {
    throw new Error(`prune report schemaVersion must be ${PRUNE_REPORT_SCHEMA_VERSION}`);
  }
  if (plan.mode !== 'dry-run' || plan.status !== 'planned') {
    throw new Error('prune report must be an uncompleted dry-run plan');
  }
  if (!FULL_SHA.test(plan.blogHead ?? '') || !FULL_SHA.test(plan.imageHead ?? '') ||
      !FULL_SHA.test(plan.publishedImageCommit ?? '') || !SHA256.test(plan.manifestSha256 ?? '') ||
      !SHA256.test(plan.planDigest ?? '') || !Array.isArray(plan.candidates)) {
    throw new Error('prune report binding fields are invalid');
  }
  const canonicalCandidates = [...plan.candidates]
    .map(({ path, bytes }) => ({ path, bytes }))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (JSON.stringify(canonicalCandidates) !== JSON.stringify(plan.candidates) ||
      canonicalCandidates.some(({ path, bytes }, index) => typeof path !== 'string' ||
        !Number.isSafeInteger(bytes) || bytes < 0 ||
        (index > 0 && canonicalCandidates[index - 1].path === path))) {
    throw new Error('prune report candidates are not canonical');
  }
  if (!Number.isSafeInteger(plan.totalBytes) || plan.totalBytes < 0 ||
      canonicalCandidates.reduce((sum, { bytes }) => sum + bytes, 0) !== plan.totalBytes) {
    throw new Error('prune report totalBytes is invalid');
  }
  if (digestPruneBinding(plan) !== plan.planDigest) {
    throw new Error('prune report planDigest does not match its bindings');
  }
  return plan;
}

async function buildPrunePlan(blogRoot, imageRoot) {
  const manifestFile = await manifestPath(blogRoot);
  const manifestText = await readFile(manifestFile, 'utf8');
  const manifest = JSON.parse(manifestText);
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
    schemaVersion: PRUNE_REPORT_SCHEMA_VERSION,
    mode: 'dry-run',
    status: 'planned',
    blogHead: gitHead(blogRoot),
    imageHead: gitHead(imageRoot),
    manifestSha256: sha256(manifestText),
    publishedImageCommit: manifest.publishedImageCommit,
    candidates: resolvedCandidates.map(({ path, bytes }) => ({ path, bytes })),
    totalBytes: resolvedCandidates.reduce((sum, { bytes }) => sum + bytes, 0)
  };
  plan.planDigest = digestPruneBinding(plan);
  return { plan, resolvedCandidates };
}

function assertSamePruneBinding(reviewed, current) {
  for (const field of [
    'schemaVersion', 'blogHead', 'imageHead', 'manifestSha256', 'publishedImageCommit',
    'candidates', 'totalBytes', 'planDigest'
  ]) {
    if (JSON.stringify(reviewed[field]) !== JSON.stringify(current[field])) {
      throw new Error(`prune plan binding mismatch: ${field}`);
    }
  }
}

async function runPrune(blogRoot, imageRoot, confirmPrune, report) {
  if (!report) throw new Error('--report is required for prune');
  requireClean(blogRoot);
  requireClean(imageRoot);

  if (!confirmPrune) {
    const { plan } = await buildPrunePlan(blogRoot, imageRoot);
    await writeJson(report, plan);
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  let reviewed;
  try {
    reviewed = validateReviewedPrunePlan(JSON.parse(await readFile(report, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('confirmed prune requires an existing reviewed --report');
    throw error;
  }
  const { plan: current, resolvedCandidates } = await buildPrunePlan(blogRoot, imageRoot);
  assertSamePruneBinding(reviewed, current);

  const deleted = [];
  for (const { path, absolute } of resolvedCandidates) {
    await unlink(absolute);
    deleted.push(path);
  }
  const completed = { ...reviewed, status: 'completed', deleted };
  await writeJson(report, completed);
  console.log(JSON.stringify(completed, null, 2));
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
