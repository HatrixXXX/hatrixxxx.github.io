import { describe, expect, it } from 'vitest';
import {
  ABOUT_SECTION_LINKS,
  ALL_POSTS_LINK,
  BLOG_SUBNAV_LINKS,
  HOME_LINKS,
  POST_TYPE_LINKS,
  POST_TYPES,
  PRIMARY_NAV_ITEMS
} from '../../src/config/navigation';

describe('navigation configuration', () => {
  it('defines the requested primary and secondary navigation labels', () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      '首页', '博客文章', '作品橱窗', '书签', '软件', '装备', '计划', '实验场', '友链', '留言板'
    ]);
    expect(PRIMARY_NAV_ITEMS.map((item) => item.href)).toEqual([
      '/', '/blog/all/', '/projects/', '/about/bookmarks/', '/about/tools/', '/about/gear/',
      '/plans/', '/lab/', '/about/friends/', '/guestbook/'
    ]);
    expect(PRIMARY_NAV_ITEMS.filter((item) => 'children' in item).map((item) => item.label))
      .toEqual([]);
    expect(POST_TYPE_LINKS.map((item) => item.label)).toEqual(POST_TYPES);
    expect(BLOG_SUBNAV_LINKS.map((item) => item.label)).toEqual(['全部文章', ...POST_TYPES]);
    expect(ALL_POSTS_LINK.href).toBe('/blog/all/');
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

  it('uses unique paths inside each navigation group while reusing existing about destinations', () => {
    for (const links of [PRIMARY_NAV_ITEMS, BLOG_SUBNAV_LINKS, ABOUT_SECTION_LINKS]) {
      const hrefs = links.map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      expect(hrefs.every((href) => href.startsWith('/') && href.endsWith('/'))).toBe(true);
    }
    for (const href of ['/about/bookmarks/', '/about/tools/', '/about/gear/', '/about/friends/']) {
      expect(PRIMARY_NAV_ITEMS.some((item) => item.href === href)).toBe(true);
      expect(ABOUT_SECTION_LINKS.some((item) => item.href === href)).toBe(true);
    }
  });

  it('keeps home destinations stable after removing About from the primary navigation', () => {
    expect(HOME_LINKS.about).toMatchObject({ label: '关于我', href: '/about/' });
    expect(HOME_LINKS.blog.href).toBe('/blog/all/');
    expect(HOME_LINKS.projects.href).toBe('/projects/');
    expect(HOME_LINKS.guestbook.href).toBe('/guestbook/');
    expect(HOME_LINKS.bookmarks.href).toBe('/about/bookmarks/');
    expect(HOME_LINKS.software.href).toBe('/about/tools/');
    expect(HOME_LINKS.gear.href).toBe('/about/gear/');
    expect(HOME_LINKS.friends.href).toBe('/about/friends/');
  });
});
