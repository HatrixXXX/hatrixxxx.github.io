import { stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { animatedFrameHeight, inputPixelLimitReason, readSourceMetadata } from './animated.mjs';
import { fullOutputPath, thumbnailOutputPath, cdnUrl } from './paths.mjs';
import { resolveSafeImagePath, resolveSafePath } from './safe-paths.mjs';
import { scanReferences } from './scan.mjs';

const FULL_FORMATS = new Set(['png', 'jpeg', 'gif', 'bmp']);
const GENERATED_DIRECTORIES = ['img/optimized/', 'img/thumbnails/'];
const FULL_SHA = /^[0-9a-f]{40}$/u;
export const MANIFEST_SCHEMA_VERSION = 3;

function commitAt(root) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

function outputFor(outputPath, eligible, reason) {
  return {
    path: outputPath,
    url: cdnUrl(outputPath),
    adopted: false,
    outputBytes: null,
    reason: eligible ? 'eligible' : reason
  };
}

function sourceMetadata(metadata) {
  return {
    format: metadata.format ?? 'unknown',
    width: metadata.width ?? 0,
    height: animatedFrameHeight(metadata),
    pages: Math.max(metadata.pages ?? 1, 1)
  };
}

function assertOutput(output, label) {
  if (!output || typeof output !== 'object') throw new Error(`manifest ${label} is missing`);
  if (typeof output.path !== 'string' || typeof output.url !== 'string' ||
      typeof output.adopted !== 'boolean' || typeof output.reason !== 'string') {
    throw new Error(`manifest ${label} fields are incomplete`);
  }
  if (output.adopted && (!Number.isSafeInteger(output.outputBytes) || output.outputBytes < 0)) {
    throw new Error(`manifest ${label} outputBytes is invalid`);
  }
  if (output.adopted && (typeof output.format !== 'string' ||
      !Number.isSafeInteger(output.width) || output.width < 1 ||
      !Number.isSafeInteger(output.height) || output.height < 1 ||
      !Number.isSafeInteger(output.pages) || output.pages < 1)) {
    throw new Error(`manifest ${label} metadata is invalid`);
  }
}

export function validateManifest(manifest, { requirePublished = false } = {}) {
  if (!manifest || typeof manifest !== 'object' || manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(`manifest schemaVersion must be ${MANIFEST_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(manifest.entries) || !Object.hasOwn(manifest, 'sourceImageCommit') ||
      !Object.hasOwn(manifest, 'publishedImageCommit')) {
    throw new Error('manifest top-level fields are incomplete');
  }
  if (manifest.sourceImageCommit !== null && !FULL_SHA.test(manifest.sourceImageCommit)) {
    throw new Error('manifest sourceImageCommit must be null or a full SHA');
  }
  if (manifest.publishedImageCommit !== null && !FULL_SHA.test(manifest.publishedImageCommit)) {
    throw new Error('manifest publishedImageCommit must be null or a full SHA');
  }
  if (requirePublished && !FULL_SHA.test(manifest.publishedImageCommit ?? '')) {
    throw new Error('manifest publishedImageCommit must be a full SHA');
  }
  const sourcePaths = new Set();
  const adoptedOutputPaths = new Set();
  for (const [index, entry] of manifest.entries.entries()) {
    if (typeof entry.sourcePath !== 'string' || !Number.isSafeInteger(entry.sourceBytes) ||
        entry.sourceBytes < 0 || !entry.source || typeof entry.source !== 'object' ||
        typeof entry.source.format !== 'string' || !Number.isSafeInteger(entry.source.width) ||
        entry.source.width < 1 || !Number.isSafeInteger(entry.source.height) || entry.source.height < 1 ||
        !Number.isSafeInteger(entry.source.pages) || entry.source.pages < 1 ||
        !Array.isArray(entry.references)) {
      throw new Error(`manifest entry ${index} fields are incomplete`);
    }
    assertOutput(entry.full, `entry ${index} full output`);
    assertOutput(entry.thumbnail, `entry ${index} thumbnail output`);
    if (sourcePaths.has(entry.sourcePath)) {
      throw new Error(`duplicate source path: ${entry.sourcePath}`);
    }
    sourcePaths.add(entry.sourcePath);
    for (const output of [entry.full, entry.thumbnail]) {
      if (!output.adopted) continue;
      if (adoptedOutputPaths.has(output.path)) {
        throw new Error(`duplicate adopted output path: ${output.path}`);
      }
      adoptedOutputPaths.add(output.path);
    }
  }
  return manifest;
}

function previousPaths(manifest) {
  const paths = new Map();
  for (const entry of manifest.entries) {
    for (const path of [
      entry.sourcePath,
      ...(entry.full.adopted ? [entry.full.path] : []),
      ...(entry.thumbnail.adopted ? [entry.thumbnail.path] : [])
    ]) {
      const existing = paths.get(path);
      if (existing && existing.sourcePath !== entry.sourcePath) {
        throw new Error(`manifest path maps to multiple sources: ${path}`);
      }
      paths.set(path, entry);
    }
  }
  return paths;
}

function expectedFull(entry) {
  return entry.full.adopted
    ? { path: entry.full.path, url: entry.full.url }
    : { path: entry.sourcePath, url: cdnUrl(entry.sourcePath) };
}

function replacementRepair(reference, entry, expected) {
  if (reference.repoPath === expected.path && reference.rawUrl === expected.url) return null;
  return {
    type: 'replace-reference',
    sourcePath: entry.sourcePath,
    file: reference.file,
    line: reference.line,
    kind: reference.kind,
    fromUrl: reference.rawUrl,
    toUrl: expected.url
  };
}

function thumbnailRepair(cover, thumbnail, entry, full) {
  if (!entry.thumbnail.adopted) return null;
  if (thumbnail?.repoPath === entry.thumbnail.path && thumbnail.rawUrl === entry.thumbnail.url) return null;
  return {
    type: 'upsert-thumbnail',
    sourcePath: entry.sourcePath,
    file: cover.file,
    line: thumbnail?.line ?? cover.line,
    fromUrl: thumbnail?.rawUrl ?? null,
    fullUrl: full.url,
    thumbnailUrl: entry.thumbnail.url
  };
}

function sortRepairs(repairs) {
  return repairs.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line ||
    a.type.localeCompare(b.type) || (a.fromUrl ?? '').localeCompare(b.fromUrl ?? ''));
}

function rejectOutputCollisions(entries) {
  const sourcesByOutputPath = new Map();
  for (const { sourcePath, full, thumbnail } of entries) {
    for (const output of [full, thumbnail]) {
      if (output.reason !== 'eligible' && !output.adopted) continue;
      const existing = sourcesByOutputPath.get(output.path);
      if (existing && existing !== sourcePath) {
        throw new Error(`generated output collision: ${output.path} from ${existing} and ${sourcePath}`);
      }
      sourcesByOutputPath.set(output.path, sourcePath);
    }
  }
}

export async function buildManifest(blogRoot, imageRoot, options = {}) {
  const { readMetadata = readSourceMetadata, previousManifest = null } = options;
  const knownPaths = previousManifest
    ? previousPaths(validateManifest(previousManifest))
    : new Map();
  const scannedReferences = await scanReferences(blogRoot);
  const referencesByFile = new Map();
  for (const reference of scannedReferences) {
    await resolveSafePath(blogRoot, reference.file, 'blog source');
    if (reference.kind !== 'thumbnail') {
      await resolveSafeImagePath(imageRoot, reference.repoPath);
    }
    const references = referencesByFile.get(reference.file) ?? [];
    references.push(reference);
    referencesByFile.set(reference.file, references);
  }

  const grouped = new Map();
  const repairs = [];
  for (const [file, fileReferences] of referencesByFile) {
    const covers = fileReferences.filter(({ kind }) => kind === 'cover');
    const thumbnails = fileReferences.filter(({ kind }) => kind === 'thumbnail');
    if (covers.length > 1) throw new Error(`image.path is ambiguous: ${file}`);
    if (thumbnails.length > 1) throw new Error(`image.thumbnail is ambiguous: ${file}`);
    const cover = covers[0];
    const coverEntry = cover && knownPaths.get(cover.repoPath);

    for (const reference of fileReferences.filter(({ kind }) => kind !== 'thumbnail')) {
      const knownEntry = knownPaths.get(reference.repoPath);
      if (knownEntry) {
        const repair = replacementRepair(reference, knownEntry, expectedFull(knownEntry));
        if (repair) repairs.push(repair);
        continue;
      }
      if (GENERATED_DIRECTORIES.some((directory) => reference.repoPath.startsWith(directory))) {
        throw new Error(`referenced generated output is missing from manifest: ${reference.repoPath}`);
      }
      const references = grouped.get(reference.repoPath) ?? [];
      references.push(reference);
      grouped.set(reference.repoPath, references);
    }

    if (coverEntry && cover.scope === 'published') {
      const repair = thumbnailRepair(cover, thumbnails[0], coverEntry, expectedFull(coverEntry));
      if (repair) repairs.push(repair);
    } else if (thumbnails.length > 0 && !cover) {
      throw new Error(`image.thumbnail has no image.path: ${file}`);
    }
  }

  const entries = [];
  for (const [sourcePath, references] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const source = await resolveSafeImagePath(imageRoot, sourcePath);
    const sourceBytes = (await stat(source)).size;
    const metadata = await readMetadata(source);
    const fullReason = FULL_FORMATS.has(metadata.format)
      ? inputPixelLimitReason(metadata)
      : `unsupported-format:${metadata.format ?? 'unknown'}`;
    const thumbnailEligible = references.some(({ scope, kind }) => scope === 'published' && kind === 'cover');
    entries.push({
      sourcePath,
      sourceBytes,
      source: sourceMetadata(metadata),
      references,
      full: outputFor(
        fullOutputPath(sourcePath),
        fullReason === null,
        fullReason ?? 'eligible'
      ),
      thumbnail: outputFor(
        thumbnailOutputPath(sourcePath),
        thumbnailEligible,
        'not-published-cover'
      )
    });
  }
  const previousEntries = previousManifest?.entries ?? [];
  rejectOutputCollisions([...previousEntries, ...entries]);

  if (previousManifest) {
    await validateWorkingAdoptedOutputs(previousManifest, imageRoot, { readMetadata });
  }
  const referenceRepairs = sortRepairs(repairs);
  if (previousManifest && entries.length === 0 && referenceRepairs.length === 0) {
    return previousManifest;
  }

  if (previousManifest && entries.length === 0) {
    return { ...previousManifest, referenceRepairs };
  }

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    blogCommit: commitAt(blogRoot),
    sourceImageCommit: commitAt(imageRoot),
    publishedImageCommit: null,
    entries: [...previousEntries, ...entries]
      .sort(({ sourcePath: a }, { sourcePath: b }) => a.localeCompare(b)),
    referenceRepairs
  };
}

function resolveCommit(imageRoot, imageCommit) {
  if (!imageCommit?.trim()) throw new Error('image commit is required');
  try {
    return execFileSync('git', ['rev-parse', '--verify', `${imageCommit}^{commit}`], {
      cwd: imageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    throw new Error(`image commit does not exist: ${imageCommit}`);
  }
}

function adoptedOutputs(manifest) {
  validateManifest(manifest);
  return manifest.entries.flatMap(({ full, thumbnail }) => [full, thumbnail]).filter(({ adopted }) => adopted);
}

export async function validateWorkingAdoptedOutputs(manifest, imageRoot, options = {}) {
  const { readMetadata = readSourceMetadata } = options;
  for (const output of adoptedOutputs(manifest)) {
    if (!output.path.startsWith('img/optimized/') && !output.path.startsWith('img/thumbnails/')) {
      throw new Error(`invalid adopted output path: ${output.path}`);
    }
    const localPath = await resolveSafeImagePath(imageRoot, output.path);
    const localBytes = (await stat(localPath)).size;
    if (localBytes !== output.outputBytes) {
      throw new Error(`working output byte count does not match manifest: ${output.path}`);
    }
    const metadata = await readMetadata(localPath);
    const actual = {
      format: metadata.format ?? 'unknown',
      width: metadata.width ?? 0,
      height: animatedFrameHeight(metadata),
      pages: Math.max(metadata.pages ?? 1, 1)
    };
    for (const key of ['format', 'width', 'height', 'pages']) {
      if (output[key] !== actual[key]) {
        throw new Error(`working output ${key} does not match manifest: ${output.path}`);
      }
    }
  }
}

export async function stampPublishedImageCommit(manifest, imageRoot, imageCommit) {
  const outputs = adoptedOutputs(manifest);
  const resolvedCommit = resolveCommit(imageRoot, imageCommit);
  await validateWorkingAdoptedOutputs(manifest, imageRoot);
  for (const output of outputs) {
    const localPath = await resolveSafeImagePath(imageRoot, output.path);
    let committedBlob;
    try {
      committedBlob = execFileSync('git', ['rev-parse', '--verify', `${resolvedCommit}:${output.path}`], {
        cwd: imageRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {
      throw new Error(`adopted output is missing from image commit: ${output.path}`);
    }
    const committedBytes = Number(execFileSync('git', ['cat-file', '-s', committedBlob], {
      cwd: imageRoot,
      encoding: 'utf8'
    }).trim());
    if (committedBytes !== output.outputBytes) {
      throw new Error(`committed output byte count does not match manifest: ${output.path}`);
    }
    const localBlob = execFileSync('git', ['hash-object', '--no-filters', '--', localPath], {
      cwd: imageRoot,
      encoding: 'utf8'
    }).trim();
    if (localBlob !== committedBlob) {
      throw new Error(`committed output does not match working file: ${output.path}`);
    }
  }
  return { ...manifest, publishedImageCommit: resolvedCommit };
}

export async function validatePublishedManifest(manifest, imageRoot) {
  validateManifest(manifest, { requirePublished: true });
  await stampPublishedImageCommit(manifest, imageRoot, manifest.publishedImageCommit);
  return manifest;
}

export function pruneCandidates(manifest, currentRefs) {
  return manifest.entries
    .filter(({ sourcePath, full }) => {
      if (!sourcePath.startsWith('img/') || sourcePath.startsWith('img/optimized/') ||
          sourcePath.startsWith('img/thumbnails/')) {
        throw new Error(`unsafe prune path: ${sourcePath}`);
      }
      return full.adopted && !currentRefs.has(sourcePath);
    })
    .map(({ sourcePath }) => sourcePath)
    .sort();
}
