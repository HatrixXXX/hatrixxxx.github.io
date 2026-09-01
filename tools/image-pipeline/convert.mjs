import { mkdir, readFile, rename, rm, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { animatedFrameHeight, inputPixelLimitReason, readSourceMetadata } from './animated.mjs';

async function size(path) { return (await stat(path)).size; }
async function prepare(path) { await mkdir(dirname(path), { recursive: true }); }

export function acceptAnimatedGif(source, output, sourceBytes, outputBytes) {
  return source.pages === output.pages &&
    source.loop === output.loop &&
    JSON.stringify(source.delay ?? []) === JSON.stringify(output.delay ?? []) &&
    outputBytes < sourceBytes;
}

export async function optimizeFull(source, destination, options = {}) {
  const { readMetadata = readSourceMetadata } = options;
  const sourceMeta = await readMetadata(source);
  const sourceBytes = await size(source);
  const blockReason = inputPixelLimitReason(sourceMeta);
  if (blockReason) {
    return {
      adopted: false,
      sourceBytes,
      outputBytes: null,
      width: sourceMeta.width ?? 0,
      height: animatedFrameHeight(sourceMeta),
      format: sourceMeta.format ?? 'unknown',
      reason: blockReason
    };
  }
  await prepare(destination);
  const temp = `${destination}.tmp`;
  const animated = (sourceMeta.pages ?? 1) > 1;
  let pipeline = sharp(source, { animated }).rotate();
  if ((sourceMeta.width ?? 0) > 1920) pipeline = pipeline.resize({ width: 1920, withoutEnlargement: true });
  await pipeline.webp({ quality: 88, alphaQuality: 100, effort: 5, loop: sourceMeta.loop }).toFile(temp);
  const outputMeta = await sharp(await readFile(temp), { animated: true }).metadata();
  const outputBytes = await size(temp);
  const adopted = animated
    ? acceptAnimatedGif(sourceMeta, outputMeta, sourceBytes, outputBytes)
    : outputBytes < sourceBytes;
  if (!adopted) await unlink(temp);
  else {
    await rm(destination, { force: true });
    await rename(temp, destination);
  }
  return {
    adopted, sourceBytes, outputBytes,
    width: outputMeta.width ?? 0, height: animatedFrameHeight(outputMeta),
    pages: Math.max(outputMeta.pages ?? 1, 1),
    format: outputMeta.format ?? 'webp', reason: adopted ? 'smaller' : 'not-smaller-or-animation-changed'
  };
}

export async function createThumbnail(source, destination) {
  await prepare(destination);
  const temp = `${destination}.tmp`;
  try {
    await sharp(source, { animated: false, pages: 1 }).rotate()
      .resize(640, 336, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82, alphaQuality: 100, effort: 5 })
      .toFile(temp);
    const meta = await sharp(await readFile(temp)).metadata();
    const sourceBytes = await size(source);
    const outputBytes = await size(temp);
    await rm(destination, { force: true });
    await rename(temp, destination);
    return {
      adopted: true, sourceBytes, outputBytes,
      width: meta.width ?? 0, height: meta.height ?? 0,
      pages: Math.max(meta.pages ?? 1, 1),
      format: meta.format ?? 'webp', reason: 'homepage-thumbnail'
    };
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}
