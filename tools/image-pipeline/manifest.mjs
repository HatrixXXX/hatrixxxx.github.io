import { stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { inputPixelLimitReason, readSourceMetadata } from './animated.mjs';
import { fullOutputPath, thumbnailOutputPath, cdnUrl } from './paths.mjs';
import { resolveSafeImagePath, resolveSafePath } from './safe-paths.mjs';
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

function outputFor(outputPath, eligible, reason) {
  return {
    path: outputPath,
    url: cdnUrl(outputPath),
    adopted: false,
    outputBytes: null,
    reason: eligible ? 'eligible' : reason
  };
}

function rejectOutputCollisions(entries) {
  const sourcesByOutputPath = new Map();
  for (const { sourcePath, full, thumbnail } of entries) {
    for (const output of [full, thumbnail]) {
      if (output.reason !== 'eligible') continue;
      const existing = sourcesByOutputPath.get(output.path);
      if (existing && existing !== sourcePath) {
        throw new Error(`generated output collision: ${output.path} from ${existing} and ${sourcePath}`);
      }
      sourcesByOutputPath.set(output.path, sourcePath);
    }
  }
}

export async function buildManifest(blogRoot, imageRoot, options = {}) {
  const { readMetadata = readSourceMetadata } = options;
  const grouped = new Map();
  for (const reference of await scanReferences(blogRoot)) {
    await resolveSafePath(blogRoot, reference.file, 'blog source');
    const references = grouped.get(reference.repoPath) ?? [];
    references.push(reference);
    grouped.set(reference.repoPath, references);
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
  rejectOutputCollisions(entries);

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
