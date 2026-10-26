import { describe, expect, it, vi } from 'vitest';
import { BOOKMARKS } from '../../src/data/bookmarks';

describe('public bookmark archive', () => {
  it('keeps the 145 saved links without the private post repository', async () => {
    vi.resetModules();
    vi.stubEnv('HATRIX_BLOGS_DIR', './tests/fixtures/__missing_private_content__');
    try {
      const { BOOKMARKS: standalone } = await import('../../src/data/bookmarks');
      expect(standalone).toHaveLength(145);
      expect(standalone[0]).toMatchObject({ title: 'Human System Optimization', category: '有趣的网站' });
      expect(standalone.at(-1)).toMatchObject({ title: '自学纯数学', category: '方法论' });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('places 下歌吧 immediately after 聚合网盘 in the resource category', () => {
    const aggregateDriveIndex = BOOKMARKS.findIndex(({ title }) => title === '聚合网盘');
    expect(BOOKMARKS[aggregateDriveIndex + 1]).toMatchObject({
      title: '下歌吧', url: 'https://so.liumingye.cn/', category: '资源库'
    });
  });

  it('contains distinct, described HTTPS destinations', () => {
    expect(BOOKMARKS.length).toBeGreaterThan(12);
    expect(new Set(BOOKMARKS.map((bookmark) => bookmark.url)).size).toBe(BOOKMARKS.length);
    for (const bookmark of BOOKMARKS) {
      expect(bookmark.title.trim()).not.toBe('');
      expect(bookmark.category.trim()).not.toBe('');
      expect(bookmark.description.trim()).not.toBe('');
      expect(new URL(bookmark.url).protocol).toBe('https:');
    }
  });
});
