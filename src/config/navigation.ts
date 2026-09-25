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

export const ALL_POSTS_LINK = {
  label: '全部文章',
  slug: 'all',
  href: '/blog/all/'
} as const;

export const BLOG_SUBNAV_LINKS = [ALL_POSTS_LINK, ...POST_TYPE_LINKS] as const;

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

// Home cards and the primary navigation share the same route definitions.
export const HOME_LINKS = {
  blog: { label: '博客文章', href: '/blog/all/' },
  projects: { label: '作品橱窗', href: '/projects/' },
  about: { label: '关于我', href: '/about/' },
  guestbook: { label: '留言板', href: '/guestbook/' },
  friends: { label: '友链', href: ABOUT_SECTION_LINKS[8].href },
  bookmarks: { label: '书签', href: ABOUT_SECTION_LINKS[7].href },
  software: { label: '软件', href: ABOUT_SECTION_LINKS[6].href },
  gear: { label: '装备', href: ABOUT_SECTION_LINKS[5].href },
  plans: { label: '计划', href: '/plans/' },
  lab: { label: '实验场', href: '/lab/' }
} as const;

export const PRIMARY_NAV_ITEMS = [
  { label: '首页', href: '/' },
  HOME_LINKS.blog,
  HOME_LINKS.projects,
  HOME_LINKS.about,
  HOME_LINKS.bookmarks,
  HOME_LINKS.software,
  HOME_LINKS.gear,
  HOME_LINKS.plans,
  HOME_LINKS.lab,
  HOME_LINKS.friends,
  HOME_LINKS.guestbook
] as const;
