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
      expect(tool.icon).toMatch(/^\/assets\/tool-icons\/[a-z0-9-]+\.png$/);
    }
    expect(new Set(SOFTWARE_TOOLS.map((tool) => tool.icon)).size).toBe(SOFTWARE_TOOLS.length);
  });

  it('keeps only listed icons on 128px transparent canvases', async () => {
    const iconDirectory = join(process.cwd(), 'public', 'assets', 'tool-icons');
    const expectedFiles = SOFTWARE_TOOLS.map((tool) => tool.icon.split('/').at(-1)).sort();
    const actualFiles = readdirSync(iconDirectory).filter((file) => /\.(?:png|svg|ico)$/.test(file)).sort();
    expect(actualFiles).toEqual(expectedFiles);
    const sourceNames = readFileSync(join(iconDirectory, 'SOURCES.txt'), 'utf8')
      .match(/^[a-z0-9-]+\.png <- /gm)?.map((line) => line.slice(0, -4)).sort();
    expect(sourceNames).toEqual(expectedFiles);

    for (const file of actualFiles) {
      const icon = sharp(join(iconDirectory, file));
      const metadata = await icon.metadata();
      expect([metadata.width, metadata.height, metadata.channels]).toEqual([128, 128, 4]);
      const { data } = await icon.raw().toBuffer({ resolveWithObject: true });
      expect(data[3]).toBe(0);
    }
  });
});
