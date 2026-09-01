import { describe, expect, it } from 'vitest';
import { POST_CATEGORIES, SITE } from '../../src/config/site';
import { playlist } from '../../src/data/playlist';

describe('content contracts', () => {
  it('uses the six approved categories', () => {
    expect(POST_CATEGORIES).toEqual([
      'FPGA 与数字系统',
      '嵌入式与硬件',
      'AI 与图形计算',
      '软件工程与工具',
      '数学与基础',
      '随笔与资源'
    ]);
  });

  it('starts with empty projects and playlist data', () => {
    expect(playlist).toEqual([]);
    expect(SITE.giscus.mapping).toBe('pathname');
  });
});
