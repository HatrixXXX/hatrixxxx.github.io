import { describe, expect, it } from 'vitest';
import {
  ABOUT_SECTION_LINKS,
  HOME_LINKS,
  PRIMARY_NAV_ITEMS
} from '../../src/config/navigation';

describe('navigation configuration', () => {
  it('defines the requested primary and secondary navigation labels', () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      '首页', '博客文章', '作品橱窗', '关于我', '随笔', '收藏夹', '工具箱', '秘境', '资讯', '友链', '留言板', '实验场'
    ]);
    expect(PRIMARY_NAV_ITEMS.map((item) => item.href)).toEqual([
      '/', '/blogs/', '/creation/', '/about/', '/snippets/', '/favorites/', '/toolbox/',
      '/sanctuary/', '/digest/', '/friends/', '/guestbook/', '/playground/'
    ]);
    expect(PRIMARY_NAV_ITEMS.filter((item) => 'children' in item).map((item) => item.label))
      .toEqual([]);
    expect(ABOUT_SECTION_LINKS.map((item) => item.label)).toEqual([
      '爱好',
      '研究',
      '阅读',
      '游戏',
      '相簿'
    ]);
  });

  it('keeps home cards at one route level and about sections nested under About', () => {
    for (const links of [PRIMARY_NAV_ITEMS, ABOUT_SECTION_LINKS]) {
      const hrefs = links.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(hrefs.every((href) => href.startsWith('/') && href.endsWith('/'))).toBe(true);
    }
    expect(PRIMARY_NAV_ITEMS.slice(1).every((item) => /^\/[a-z]+\/$/.test(item.href))).toBe(true);
    expect(ABOUT_SECTION_LINKS.every((item) => item.href.startsWith('/about/'))).toBe(true);
  });

  it('routes each home card to its English caption', () => {
    expect(HOME_LINKS.about).toMatchObject({ label: '关于我', href: '/about/' });
    expect(HOME_LINKS.blog.href).toBe('/blogs/');
    expect(HOME_LINKS.projects.href).toBe('/creation/');
    expect(HOME_LINKS.guestbook.href).toBe('/guestbook/');
    expect(HOME_LINKS.snippets).toMatchObject({ label: '随笔', href: '/snippets/' });
    expect(HOME_LINKS.bookmarks.label).toBe('收藏夹');
    expect(HOME_LINKS.bookmarks.href).toBe('/favorites/');
    expect(HOME_LINKS.software.href).toBe('/toolbox/');
    expect(HOME_LINKS.digest).toEqual({ label: '资讯', href: '/digest/' });
    expect(ABOUT_SECTION_LINKS.map((item) => item.slug)).not.toContain('gear');
    expect(HOME_LINKS.friends.href).toBe('/friends/');
    expect(HOME_LINKS.lab.href).toBe('/playground/');
  });
});
