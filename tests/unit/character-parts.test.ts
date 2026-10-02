import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

const manifestPath = 'src/data/character-parts.ts';

describe('character part assets', () => {
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
