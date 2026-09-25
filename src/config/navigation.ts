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
  href: '/blog/'
} as const;

export const BLOG_SUBNAV_LINKS = [ALL_POSTS_LINK, ...POST_TYPE_LINKS] as const;

export const ABOUT_SECTION_LINKS = [
  { label: '爱好', slug: 'hobbies', href: '/about/hobbies/', subtitle: '玩过、迷过、还在喜欢的东西' },
  { label: '研究', slug: 'research', href: '/about/research/', subtitle: '学术方向与在研课题' },
  { label: '阅读', slug: 'reading', href: '/about/reading/', subtitle: '读过的书与留下印象的内容' },
  { label: '游戏', slug: 'games', href: '/about/games/', subtitle: '玩过和正在玩的游戏' },
  { label: '相簿', slug: 'albums', href: '/about/albums/', subtitle: '拍过的照片与值得记住的瞬间' },
  { label: '装备', slug: 'gear', href: '/about/gear/', subtitle: '日常使用的硬件与外设' },
  { label: '工具', slug: 'tools', href: '/about/tools/', subtitle: '效率工具与常用软件' },
  { label: '书签', slug: 'bookmarks', href: '/about/bookmarks/', subtitle: '值得反复翻看的链接' },
  { label: '友链', slug: 'friends', href: '/about/friends/', subtitle: '一些有趣的人与站点' }
] as const;

// Home cards and the primary navigation share the same route definitions.
export const HOME_LINKS = {
  blog: { label: '博客文章', href: '/blog/' },
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
