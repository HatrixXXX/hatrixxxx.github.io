import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SOFTWARE_TOOLS } from '../../src/data/software-tools';

describe('software tool cabinet data', () => {
  it('contains the migrated development toolchain alongside software and web links', () => {
    expect(SOFTWARE_TOOLS).toHaveLength(47);
    expect(SOFTWARE_TOOLS.filter((tool) => tool.kind === 'software')).toHaveLength(37);
    expect(SOFTWARE_TOOLS.filter((tool) => tool.kind === 'link')).toHaveLength(10);
  });

  it('keeps every tool from the development toolchain in one category', () => {
    expect(SOFTWARE_TOOLS.filter((tool) => tool.category === 'toolchain').map((tool) => tool.name)).toEqual([
      'SolidWorks', 'Fusion 360', 'Inventor', 'Bambu Studio',
      'Altium Designer', '嘉立创 EDA', 'KiCad', 'OrCAD', 'PADS',
      'STM32CubeMX', 'Keil MDK', 'Ozone', 'Arduino IDE', 'PlatformIO',
      'Vivado', 'Quartus Prime', 'PSIM', 'Multisim', 'MATLAB',
      'Visual Studio Code', 'Git', 'SourceTree', 'CLion', 'PyCharm',
      'Visual Studio', 'Anaconda', 'VMware Workstation', 'Zotero',
      'Typora', '向日葵', 'RustDesk', 'VNC Viewer', 'PicGo'
    ]);
  });

  it('uses complete, unique HTTPS entries', () => {
    const names = SOFTWARE_TOOLS.map((tool) => tool.name);
    const hrefs = SOFTWARE_TOOLS.map((tool) => tool.href);

    expect(new Set(names).size).toBe(names.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);

    for (const tool of SOFTWARE_TOOLS) {
      expect(tool.name.trim().length).toBeGreaterThan(0);
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(tool.purpose.trim().length).toBeGreaterThan(0);
      expect(new URL(tool.href).protocol).toBe('https:');
      expect(tool.icon).toMatch(/^\/tool-icons\/[a-z0-9-]+\.(?:svg|png|ico)$/);
      expect(existsSync(join(process.cwd(), 'public', tool.icon.slice(1)))).toBe(true);
    }

    expect(new Set(SOFTWARE_TOOLS.map((tool) => tool.icon)).size).toBe(SOFTWARE_TOOLS.length);
  });
});
