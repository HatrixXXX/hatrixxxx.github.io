import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { SOFTWARE_TOOLS } from '../../src/data/software-tools';

const listedNames = [
  'VS Code', 'Git', 'CC Switch', 'CLion', 'Pycharm', 'Anaconda', 'SolidWorks', 'Blender',
  'Bamboo Studio', 'Altium Designer', 'Kicad', 'CubeMX', 'Keil', 'Ozone',
  'Vivado', 'Quartus', 'Matlab', 'Multisim', 'MobaXterm', 'VMware',
  'Acrobat DC', 'Adobe Illustrator', 'Adobe Media Encoder',
  'Adobe Photoshop', 'Adobe Premiere Pro', 'Everything', 'Honeyview',
  'Potplayer', 'Typora', 'Zotero', 'PicGo', 'Q-dir', '7-zip', 'Geek',
  'Snipaste', 'Bandicam', 'DiskGenius', 'Spacesniffer', 'CPU-Z',
  'ContextMenuManager'
];

describe('software tool cabinet data', () => {
  it('keeps the curated software inventory in display order', () => {
    expect(SOFTWARE_TOOLS.map((tool) => tool.name)).toEqual(listedNames);
    expect(SOFTWARE_TOOLS.every((tool) => tool.kind === 'software')).toBe(true);
  });

  it('uses complete, unique HTTPS entries', () => {
    const hrefs = SOFTWARE_TOOLS.map((tool) => tool.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);

    for (const tool of SOFTWARE_TOOLS) {
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(tool.purpose.trim().length).toBeGreaterThan(0);
      expect(new URL(tool.href).protocol).toBe('https:');
      expect(tool.icon).toMatch(/^\/assets\/tool-icons\/[a-z0-9-]+\.(?:png|svg|ico)$/);
    }
    expect(new Set(SOFTWARE_TOOLS.map((tool) => tool.icon)).size).toBe(SOFTWARE_TOOLS.length);
  });

  it('keeps listed icons at their available source resolution', async () => {
    const iconDirectory = join(process.cwd(), 'public', 'assets', 'tool-icons');
    const expectedFiles = SOFTWARE_TOOLS.map((tool) => tool.icon.split('/').at(-1)).sort();
    const actualFiles = readdirSync(iconDirectory).filter((file) => /\.(?:png|svg|ico)$/.test(file)).sort();
    expect(actualFiles).toEqual(expectedFiles);
    const sourceNames = readFileSync(join(iconDirectory, 'SOURCES.txt'), 'utf8')
      .match(/^[a-z0-9-]+\.(?:png|svg|ico) <- /gm)?.map((line) => line.slice(0, -4)).sort();
    expect(sourceNames).toEqual(expectedFiles);

    const sourceLimited = new Set(['solidworks.png', 'q-dir.png']);
    const reconstructed = new Set(['vivado.png', 'mobaxterm.png', 'spacesniffer.png', '7zip.svg']);
    for (const file of actualFiles) {
      const path = join(iconDirectory, file);
      let width: number | undefined;
      let height: number | undefined;
      if (file.endsWith('.ico')) {
        const bytes = readFileSync(path);
        const count = bytes.readUInt16LE(4);
        width = Math.max(...Array.from({ length: count }, (_, index) => bytes[6 + index * 16] || 256));
        height = Math.max(...Array.from({ length: count }, (_, index) => bytes[7 + index * 16] || 256));
      } else {
        const metadata = await sharp(path).metadata();
        width = metadata.width;
        height = metadata.height;
      }
      const minimum = sourceLimited.has(file) ? 128 : file === 'bambu-studio.png' ? 192 : 256;
      expect(width, file).toBeGreaterThanOrEqual(minimum);
      expect(height, file).toBeGreaterThanOrEqual(minimum);
      if (reconstructed.has(file)) {
        expect([width, height], file).toEqual([512, 512]);
        expect((await sharp(path).metadata()).hasAlpha, file).toBe(true);
      }
    }
  });
});
