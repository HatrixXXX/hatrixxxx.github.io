import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { acceptAnimatedGif, createThumbnail, optimizeFull } from '../convert.mjs';

test('limits full width and creates an exact 40:21 thumbnail', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-convert-'));
  const source = join(root, 'source.png');
  const full = join(root, 'full.webp');
  const thumb = join(root, 'thumb.webp');
  const pixels = Buffer.alloc(2400 * 1200 * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 31) % 251;
  await sharp(pixels, { raw: { width: 2400, height: 1200, channels: 3 } })
    .png({ compressionLevel: 0 }).toFile(source);
  const fullResult = await optimizeFull(source, full);
  const thumbResult = await createThumbnail(source, thumb);
  assert.equal((await sharp(full).metadata()).width, 1920);
  assert.deepEqual(
    [(await sharp(thumb).metadata()).width, (await sharp(thumb).metadata()).height],
    [640, 336]
  );
  assert.equal(fullResult.adopted, true);
  assert.equal(thumbResult.adopted, true);
});

test('accepts animated output only when timing is preserved and bytes shrink', () => {
  const source = { pages: 3, loop: 0, delay: [80, 90, 100] };
  assert.equal(acceptAnimatedGif(source, source, 1000, 700), true);
  assert.equal(acceptAnimatedGif(source, { ...source, delay: [80, 80, 100] }, 1000, 700), false);
  assert.equal(acceptAnimatedGif(source, source, 1000, 1100), false);
});

test('replaces the same thumbnail destination safely on repeated conversion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-convert-repeat-'));
  const source = join(root, 'source.png');
  const thumb = join(root, 'thumb.webp');
  const pixels = Buffer.alloc(800 * 400 * 3, 127);
  await sharp(pixels, { raw: { width: 800, height: 400, channels: 3 } }).png().toFile(source);
  await createThumbnail(source, thumb);
  await createThumbnail(source, thumb);
  assert.deepEqual(
    [(await sharp(thumb).metadata()).width, (await sharp(thumb).metadata()).height],
    [640, 336]
  );
});

test('skips oversized animated full conversion without creating output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-convert-skip-'));
  const source = join(root, 'source.gif');
  const full = join(root, 'full.webp');
  await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } }).gif().toFile(source);

  const result = await optimizeFull(source, full, {
    readMetadata: async () => ({
      format: 'gif',
      width: 854,
      height: 480,
      pages: 753,
      loop: 0,
      delay: Array(753).fill(50)
    })
  });

  assert.equal(result.adopted, false);
  assert.equal(result.outputBytes, null);
  assert.equal(result.reason, 'input-pixel-limit');
  await assert.rejects(stat(full), /ENOENT/u);
});
