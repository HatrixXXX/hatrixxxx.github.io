import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPostFrontmatter } from '../../scripts/migration/migrate-posts';

describe('Jekyll frontmatter migration', () => {
  it('preserves URL identity and media flags', () => {
    const result = toPostFrontmatter(
      basename('2026-02-25-FPGA开发(3)AXI协议.md'),
      {
        title: 'FPGA开发(3)AXI协议',
        description: 'AXI',
        math: true,
        mermaid: true,
        image: { path: 'https://cdn.jsdelivr.net/example.png' }
      },
      '2026-02-26T00:00:00+08:00'
    );

    expect(result.legacySlug).toBe('FPGA开发(3)AXI协议');
    expect(result.seriesOrder).toBe(3);
    expect(result.cover).toContain('https://');
    expect(result.math).toBe(true);
    expect(result.mermaid).toBe(true);
  });

  it('uses the filename identity for a series when its source title has a typo', () => {
    const result = toPostFrontmatter('2026-02-25-FPGA开发(4)XilinxFPGA硬件资源.md', {
      title: 'PGA开发(4) Xilinx FPGA硬件资源'
    });

    expect(result.series).toBe('FPGA 开发');
    expect(result.seriesOrder).toBe(4);
  });
});
