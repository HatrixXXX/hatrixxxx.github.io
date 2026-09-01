import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { fullOutputPath, thumbnailOutputPath, cdnUrl } from './paths.mjs';
import { scanReferences } from './scan.mjs';

const FULL_FORMATS = new Set(['png', 'jpeg', 'gif', 'bmp']);

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

function sourceWithinImageDirectory(imageRoot, sourcePath) {
  const imageDirectory = resolve(imageRoot, 'img');
  const source = resolve(imageRoot, sourcePath);
  if (!source.startsWith(`${imageDirectory}${sep}`)) {
    throw new Error(`unsafe image source path: ${sourcePath}`);
  }
  return source;
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

export async function buildManifest(blogRoot, imageRoot) {
  const grouped = new Map();
  for (const reference of await scanReferences(blogRoot)) {
    const references = grouped.get(reference.repoPath) ?? [];
    references.push(reference);
    grouped.set(reference.repoPath, references);
  }

  const entries = [];
  for (const [sourcePath, references] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const source = sourceWithinImageDirectory(imageRoot, sourcePath);
    const sourceBytes = (await stat(source)).size;
    const metadata = await sharp(source, { animated: true }).metadata();
    const fullEligible = FULL_FORMATS.has(metadata.format);
    const thumbnailEligible = references.some(({ scope, kind }) => scope === 'published' && kind === 'cover');
    entries.push({
      sourcePath,
      sourceBytes,
      references,
      full: outputFor(
        fullOutputPath(sourcePath),
        fullEligible,
        `unsupported-format:${metadata.format ?? 'unknown'}`
      ),
      thumbnail: outputFor(
        thumbnailOutputPath(sourcePath),
        thumbnailEligible,
        'not-published-cover'
      )
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    blogCommit: commitAt(blogRoot),
    imageCommit: commitAt(imageRoot),
    entries
  };
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
