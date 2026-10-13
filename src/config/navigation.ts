export const ABOUT_SECTION_LINKS = [
  { label: '爱好', slug: 'hobbies', href: '/about/hobbies/' },
  { label: '研究', slug: 'research', href: '/about/research/' },
  { label: '阅读', slug: 'reading', href: '/about/reading/' },
  { label: '游戏', slug: 'games', href: '/about/games/' },
  { label: '相簿', slug: 'albums', href: '/about/albums/' }
] as const;

// Home cards and the primary navigation share the same route definitions.
export const HOME_LINKS = {
  blog: { label: '博客文章', href: '/blogs/' },
  projects: { label: '作品橱窗', href: '/creation/' },
  about: { label: '关于我', href: '/about/' },
  guestbook: { label: '留言板', href: '/guestbook/' },
  friends: { label: '友链', href: '/friends/' },
  snippets: { label: '随笔', href: '/snippets/' },
  bookmarks: { label: '收藏夹', href: '/favorites/' },
  software: { label: '工具箱', href: '/toolbox/' },
  plans: { label: '计划', href: '/plans/' },
  digest: { label: '资讯', href: '/digest/' },
  lab: { label: '实验场', href: '/playground/' }
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
  { ...HOME_LINKS.digest, icon: 'digest' },
  { ...HOME_LINKS.friends, icon: 'friends' },
  { ...HOME_LINKS.guestbook, icon: 'guestbook' },
  { ...HOME_LINKS.lab, icon: 'lab' }
] as const;
