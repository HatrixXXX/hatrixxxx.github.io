export const POST_TYPES = [
  '技术笔记',
  '踩坑记录',
  '生活动态',
  '好物推荐',
  '随笔杂谈'
] as const;

export type PostType = (typeof POST_TYPES)[number];

export const POST_TYPE_LINKS = [
  { label: '技术笔记', slug: 'tech-notes', href: '/blog/tech-notes/' },
  { label: '踩坑记录', slug: 'troubleshooting', href: '/blog/troubleshooting/' },
  { label: '生活动态', slug: 'life', href: '/blog/life/' },
  { label: '好物推荐', slug: 'recommendations', href: '/blog/recommendations/' },
  { label: '随笔杂谈', slug: 'essays', href: '/blog/essays/' }
] as const satisfies ReadonlyArray<{ label: PostType; slug: string; href: string }>;

export const ABOUT_SECTION_LINKS = [
  { label: '我的爱好', slug: 'hobbies', href: '/about/hobbies/' },
  { label: '我的研究', slug: 'research', href: '/about/research/' },
  { label: '我爱看的', slug: 'reading', href: '/about/reading/' },
  { label: '我爱玩的', slug: 'games', href: '/about/games/' },
  { label: '我的相簿', slug: 'albums', href: '/about/albums/' },
  { label: '我的装备', slug: 'gear', href: '/about/gear/' },
  { label: '我的工具', slug: 'tools', href: '/about/tools/' },
  { label: '我的书签', slug: 'bookmarks', href: '/about/bookmarks/' },
  { label: '我的友链', slug: 'friends', href: '/about/friends/' }
] as const;

export const PRIMARY_NAV_ITEMS = [
  { label: '首页', href: '/' },
  { label: '博客文章', href: '/blog/', children: POST_TYPE_LINKS },
  { label: '作品橱窗', href: '/projects/' },
  { label: '关于我', href: '/about/', children: ABOUT_SECTION_LINKS },
  { label: '留言板', href: '/guestbook/' }
] as const;
