import { describe, expect, it } from 'vitest';
import { ABOUT_SECTION_LINKS, POST_TYPE_LINKS, POST_TYPES, PRIMARY_NAV_ITEMS } from '../../src/config/navigation';

describe('navigation configuration', () => {
  it('defines the requested primary and secondary navigation labels', () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual(['首页', '博客文章', '作品橱窗', '关于我', '留言板']);
    expect(POST_TYPE_LINKS.map((item) => item.label)).toEqual(POST_TYPES);
    expect(ABOUT_SECTION_LINKS.map((item) => item.label)).toEqual([
      '我的爱好',
      '我的研究',
      '我爱看的',
      '我爱玩的',
      '我的相簿',
      '我的装备',
      '我的工具',
      '我的书签',
      '我的友链'
    ]);
  });

  it('uses unique absolute trailing-slash paths throughout navigation', () => {
    const hrefs = [
      ...PRIMARY_NAV_ITEMS.map((item) => item.href),
      ...POST_TYPE_LINKS.map((item) => item.href),
      ...ABOUT_SECTION_LINKS.map((item) => item.href)
    ];

    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((href) => href.startsWith('/') && href.endsWith('/'))).toBe(true);
  });
});
