import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { coverThumbnailSource } from '../../src/lib/cover-thumbnail-source';

let publicDirectory: string;

beforeEach(async () => {
  const temporaryRoot = resolve('.codex-tmp');
  await mkdir(temporaryRoot, { recursive: true });
  publicDirectory = await mkdtemp(resolve(temporaryRoot, 'cover-source-test-'));
  await mkdir(resolve(publicDirectory, 'assets'));
});

afterEach(async () => { await rm(publicDirectory, { recursive: true, force: true }); });

async function png(background: string): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 2, channels: 3, background } }).png().toBuffer();
}

describe('coverThumbnailSource', () => {
  it('gives Astro metadata for the selected local cover without changing its original', async () => {
    const original = await png('red');
    const file = resolve(publicDirectory, 'assets', 'local cover.png');
    await writeFile(file, original);

    const source = await coverThumbnailSource('/assets/local%20cover.png?v=1', publicDirectory);

    expect(source).toMatchObject({ src: '/assets/local%20cover.png', width: 4, height: 2, format: 'png' });
    expect(source).not.toHaveProperty('fsPath');
    expect(await readFile(file)).toEqual(original);
  });

  it('changes the thumbnail cache key when same-size source pixels change', async () => {
    const file = resolve(publicDirectory, 'assets', 'cover.png');
    await writeFile(file, await png('red'));
    const first = await coverThumbnailSource('/assets/cover.png', publicDirectory);
    await writeFile(file, await png('blue'));
    const second = await coverThumbnailSource('/assets/cover.png', publicDirectory);

    expect(typeof first).toBe('object');
    expect(typeof second).toBe('object');
    if (typeof first === 'string' || typeof second === 'string') throw new Error('Missing local image metadata');
    expect(first.contentHash).not.toBe(second.contentHash);
  });

  it('keeps remote covers and GIF/SVG originals as their existing URLs', async () => {
    for (const source of ['https://example.com/cover.png', '/assets/animated.gif', '/assets/vector.svg']) {
      await expect(coverThumbnailSource(source, publicDirectory)).resolves.toBe(source);
    }
  });

  it('rejects an encoded cover path that leaves the public assets directory', async () => {
    await writeFile(resolve(publicDirectory, 'secret.png'), await png('red'));
    await expect(coverThumbnailSource('/assets/%2e%2e/secret.png', publicDirectory))
      .rejects.toThrow('outside public/assets');
  });
});
