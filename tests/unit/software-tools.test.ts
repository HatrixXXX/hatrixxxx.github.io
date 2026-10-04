import { describe, expect, it } from 'vitest';
import { SOFTWARE_TOOLS } from '../../src/data/software-tools';

describe('software tool cabinet data', () => {
  it('contains two full shelves with both software and web links', () => {
    expect(SOFTWARE_TOOLS).toHaveLength(16);
    expect(SOFTWARE_TOOLS.filter((tool) => tool.kind === 'software')).toHaveLength(6);
    expect(SOFTWARE_TOOLS.filter((tool) => tool.kind === 'link')).toHaveLength(10);
  });

  it('uses complete, unique HTTPS entries', () => {
    const names = SOFTWARE_TOOLS.map((tool) => tool.name);
    const hrefs = SOFTWARE_TOOLS.map((tool) => tool.href);

    expect(new Set(names).size).toBe(names.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);

    for (const tool of SOFTWARE_TOOLS) {
      expect(tool.name.trim().length).toBeGreaterThan(0);
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(new URL(tool.href).protocol).toBe('https:');
    }
  });
});
