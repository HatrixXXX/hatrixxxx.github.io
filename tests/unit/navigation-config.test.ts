import { describe, expect, it } from 'vitest';
import {
  ABOUT_SECTION_LINKS,
  HOME_LINKS,
  PRIMARY_NAV_ITEMS
} from '../../src/config/navigation';

describe('navigation configuration', () => {
  it('defines the requested primary and secondary navigation labels', () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      '首页', '博客文章', '作品橱窗', '关于我', '随笔', '收藏夹', '工具箱', '计划', '实验场', '友链', '留言板'
    ]);
    expect(PRIMARY_NAV_ITEMS.map((item) => item.href)).toEqual([
      '/', '/blog/', '/projects/', '/about/', '/snippets/', '/about/bookmarks/', '/about/software/',
      '/plans/', '/lab/', '/about/friends/', '/guestbook/'
    ]);
    expect(PRIMARY_NAV_ITEMS.filter((item) => 'children' in item).map((item) => item.label))
      .toEqual([]);
    expect(ABOUT_SECTION_LINKS.map((item) => item.label)).toEqual([
      '爱好',
      '研究',
      '阅读',
      '游戏',
      '相簿',
      '工具箱',
      '收藏夹',
      '友链'
    ]);
  });

  it('uses unique paths inside each navigation group while reusing existing about destinations', () => {
    for (const links of [PRIMARY_NAV_ITEMS, ABOUT_SECTION_LINKS]) {
      const hrefs = links.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(hrefs.every((href) => href.startsWith('/') && href.endsWith('/'))).toBe(true);
    }
    for (const href of ['/about/bookmarks/', '/about/software/', '/about/friends/']) {
      expect(PRIMARY_NAV_ITEMS.some((item) => item.href === href)).toBe(true);
      expect(ABOUT_SECTION_LINKS.some((item) => item.href === href)).toBe(true);
    }
  });

  it('keeps home destinations stable after removing About from the primary navigation', () => {
    expect(HOME_LINKS.about).toMatchObject({ label: '关于我', href: '/about/' });
    expect(HOME_LINKS.blog.href).toBe('/blog/');
    expect(HOME_LINKS.projects.href).toBe('/projects/');
    expect(HOME_LINKS.guestbook.href).toBe('/guestbook/');
    expect(HOME_LINKS.snippets).toMatchObject({ label: '随笔', href: '/snippets/' });
    expect(HOME_LINKS.bookmarks.label).toBe('收藏夹');
    expect(HOME_LINKS.bookmarks.href).toBe('/about/bookmarks/');
    expect(HOME_LINKS.software.href).toBe('/about/software/');
    expect(ABOUT_SECTION_LINKS.find((item) => item.slug === 'software')).toMatchObject({
      label: '工具箱'
    });
    expect(ABOUT_SECTION_LINKS.map((item) => item.slug)).not.toContain('gear');
    expect(HOME_LINKS.friends.href).toBe('/about/friends/');
  });
});
