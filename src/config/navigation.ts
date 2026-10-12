export const ABOUT_SECTION_LINKS = [
  { label: '爱好', slug: 'hobbies', href: '/about/hobbies/' },
  { label: '研究', slug: 'research', href: '/about/research/' },
  { label: '阅读', slug: 'reading', href: '/about/reading/' },
  { label: '游戏', slug: 'games', href: '/about/games/' },
  { label: '相簿', slug: 'albums', href: '/about/albums/' },
  { label: '工具箱', slug: 'software', href: '/about/software/' },
  { label: '收藏夹', slug: 'bookmarks', href: '/about/bookmarks/' },
  { label: '友链', slug: 'friends', href: '/about/friends/' }
] as const;

// Home cards and the primary navigation share the same route definitions.
export const HOME_LINKS = {
  blog: { label: '博客文章', href: '/blog/' },
  projects: { label: '作品橱窗', href: '/projects/' },
  about: { label: '关于我', href: '/about/' },
  guestbook: { label: '留言板', href: '/guestbook/' },
  friends: { label: '友链', href: ABOUT_SECTION_LINKS[7].href },
  snippets: { label: '随笔', href: '/snippets/' },
  bookmarks: { label: '收藏夹', href: ABOUT_SECTION_LINKS[6].href },
  software: { label: '工具箱', href: ABOUT_SECTION_LINKS[5].href },
  plans: { label: '计划', href: '/plans/' },
  lab: { label: '实验场', href: '/lab/' }
} as const;

export const PRIMARY_NAV_ITEMS = [
  { label: '首页', href: '/', icon: 'home' },
  { ...HOME_LINKS.blog, icon: 'blog' },
  { ...HOME_LINKS.projects, icon: 'projects' },
  { ...HOME_LINKS.about, icon: 'about' },
  { ...HOME_LINKS.snippets, icon: 'snippets' },
  { ...HOME_LINKS.bookmarks, icon: 'bookmark' },
  { ...HOME_LINKS.software, icon: 'software' },
  { ...HOME_LINKS.plans, icon: 'plans' },
  { ...HOME_LINKS.lab, icon: 'lab' },
  { ...HOME_LINKS.friends, icon: 'friends' },
  { ...HOME_LINKS.guestbook, icon: 'guestbook' }
] as const;
