import type { CollectionEntry } from 'astro:content';
import { ABOUT_SECTION_LINKS, PRIMARY_NAV_ITEMS } from '@/config/navigation';
import { isConfiguredLockedPage } from '@/config/protected-content';
import { SITE } from '@/config/site';
import { BOOKMARKS } from '@/data/bookmarks';
import type { SearchDocument } from './search';

function document(id: string, url: string, title: string, paragraphs: string[]): SearchDocument {
  return { id, url, title, locked: false, text: [title, ...paragraphs].join(' '), paragraphs };
}

export function publicSiteSearchDocuments(projects: CollectionEntry<'projects'>[]): SearchDocument[] {
  const pageDescriptions: Record<string, string> = {
    '/': `首页 ${SITE.tagline} ${SITE.description}`,
    '/creation/': 'Hatrix 的作品展示与制作记录。',
    '/about/': `${SITE.author.name} ${SITE.description} 这里记录技术研发、学习笔记与作品进展。`,
    '/favorites/': '收藏的网址与简要介绍。',
    '/toolbox/': '展示工具方块样机。',
    '/friends/': '长按传送门，随机前往一位朋友的站点。',
    '/playground/': '复古电子工作台'
  };
  const pages = [
    ...PRIMARY_NAV_ITEMS.map(({ label, href }) => ({
      title: href === '/' ? SITE.title : label,
      url: href,
      description: pageDescriptions[href] ?? `浏览${label}`
    })),
    ...ABOUT_SECTION_LINKS.map(({ label, href }) => ({ title: `关于我 · ${label}`, url: href, description: label })),
    { title: '归档', url: '/archives/', description: '按时间浏览博客文章' }
  ].filter(({ url }) => !isConfiguredLockedPage(url));

  const sortedProjects = [...projects].sort((left, right) => left.data.order - right.data.order);

  return [
    ...pages.map(({ title, url, description }) => document(`page:${url}`, url, title, [description])),
    ...BOOKMARKS.map(({ title, url, category, description }, index) =>
      document(`bookmark:${url}`, `/favorites/?bookmark=${index}`, title, [`收藏夹 · ${category}`, description])),
    ...sortedProjects.map((project, index) =>
      document(`project:${project.id}`, `/creation/?project=${index}`, project.data.title,
        ['作品橱窗', project.data.description, ...project.data.gallery.flatMap(({ caption }: { caption?: string }) => caption ? [caption] : [])]))
  ];
}
