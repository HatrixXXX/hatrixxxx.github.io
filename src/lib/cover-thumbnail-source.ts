import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { ImageMetadata } from 'astro';
import { imageMetadata } from 'astro/assets/utils';

type LocalCoverSource = ImageMetadata & { contentHash: string };

export async function coverThumbnailSource(
  src: string,
  publicDirectory = resolve(process.cwd(), 'public'),
): Promise<string | LocalCoverSource> {
  if (!src.startsWith('/assets/') || /\.(gif|svg)(?:[?#]|$)/i.test(src)) return src;
  const cleanSrc = src.split(/[?#]/, 1)[0];
  const assetsDirectory = resolve(publicDirectory, 'assets');
  const file = resolve(publicDirectory, `.${decodeURIComponent(cleanSrc)}`);
  const child = relative(assetsDirectory, file);
  if (child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new Error('Cover image is outside public/assets');
  }
  const bytes = await readFile(file);
  return {
    ...await imageMetadata(bytes, file),
    src: cleanSrc,
    contentHash: createHash('sha256').update(bytes).digest('hex'),
  };
}
