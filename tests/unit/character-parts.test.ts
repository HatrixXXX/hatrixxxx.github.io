import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

const manifestPath = 'src/data/character-parts.ts';

describe('character part assets', () => {
  it.each(['count', 'dimensions'] as const)('preserves existing outputs when source %s validation fails', async (invalid) => {
    const fixture = await mkdtemp(resolve('.character-parts-test-'));
    try {
      const sources = join(fixture, 'src/assets/home/character-parts-source');
      const outputs = join(fixture, 'public/character-parts');
      const manifest = join(fixture, manifestPath);
      await mkdir(sources, { recursive: true });
      await mkdir(outputs, { recursive: true });
      await mkdir(join(fixture, 'src/data'), { recursive: true });
      await writeFile(join(outputs, 'head.webp'), 'existing-webp');
      await writeFile(join(outputs, 'skeleton.json'), 'existing-skeleton');
      await writeFile(join(outputs, 'unrelated.txt'), 'unrelated');
      await writeFile(manifest, 'existing-manifest');
      if (invalid === 'dimensions') {
        const png = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#ffffff' } }).png().toBuffer();
        await Promise.all(Array.from({ length: 29 }, (_, index) => writeFile(join(sources, `part-${index}.png`), png)));
      }

      await expect(promisify(execFile)(process.execPath, [
        '--import', import.meta.resolve('tsx'), resolve('scripts/optimize-character-parts.ts'),
      ], { cwd: fixture })).rejects.toThrow(invalid === 'count' ? 'Expected 29 source PNGs' : 'must be a 1024x1536 RGBA image');

      expect(await readFile(join(outputs, 'head.webp'), 'utf8')).toBe('existing-webp');
      expect(await readFile(join(outputs, 'skeleton.json'), 'utf8')).toBe('existing-skeleton');
      expect(await readFile(join(outputs, 'unrelated.txt'), 'utf8')).toBe('unrelated');
      expect(await readFile(manifest, 'utf8')).toBe('existing-manifest');
      expect(readdirSync(fixture).sort()).toEqual(['public', 'src']);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });

  it('publishes 29 cropped WebP layers within the original canvas and budgets', async () => {
    expect(existsSync(manifestPath)).toBe(true);
    if (!existsSync(manifestPath)) return;

    const { CHARACTER_CANVAS, CHARACTER_PARTS } = await import('../../src/data/character-parts');
    const parts = Object.values(CHARACTER_PARTS);
    const publicFiles = readdirSync('public/character-parts');
    const webpFiles = publicFiles.filter((file) => file.endsWith('.webp'));
    const pngFiles = publicFiles.filter((file) => file.endsWith('.png'));
    const encodedBytes = webpFiles.reduce(
      (total, file) => total + statSync(`public/character-parts/${file}`).size,
      0,
    );
    const decodedBytes = parts.reduce((total, part) => total + part.width * part.height * 4, 0);

    expect(parts).toHaveLength(29);
    expect(webpFiles).toHaveLength(29);
    expect(pngFiles).toHaveLength(0);
    expect(encodedBytes).toBeLessThanOrEqual(1.25 * 1024 * 1024);
    expect(decodedBytes).toBeLessThanOrEqual(22 * 1024 * 1024);
    for (const part of parts) {
      expect(existsSync(`public${part.src}`)).toBe(true);
      const metadata = await sharp(`public${part.src}`).metadata();
      expect(metadata.format).toBe('webp');
      expect([metadata.width, metadata.height]).toEqual([part.width, part.height]);
      expect(part.x).toBeGreaterThanOrEqual(0);
      expect(part.y).toBeGreaterThanOrEqual(0);
      expect(part.width).toBeGreaterThan(0);
      expect(part.height).toBeGreaterThan(0);
      expect(part.x + part.width).toBeLessThanOrEqual(CHARACTER_CANVAS.width);
      expect(part.y + part.height).toBeLessThanOrEqual(CHARACTER_CANVAS.height);
    }
  });
});
