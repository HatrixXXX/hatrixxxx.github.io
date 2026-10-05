export const ABOUT_SECTION_LINKS = [
  { label: '爱好', slug: 'hobbies', href: '/about/hobbies/' },
  { label: '研究', slug: 'research', href: '/about/research/' },
  { label: '阅读', slug: 'reading', href: '/about/reading/' },
  { label: '游戏', slug: 'games', href: '/about/games/' },
  { label: '相簿', slug: 'albums', href: '/about/albums/' },
  { label: '装备铺', slug: 'gear', href: '/about/gear/' },
  { label: '工具箱', slug: 'software', href: '/about/software/' },
  { label: '书签', slug: 'bookmarks', href: '/about/bookmarks/' },
  { label: '友链', slug: 'friends', href: '/about/friends/' }
] as const;

// Home cards and the primary navigation share the same route definitions.
export const HOME_LINKS = {
  blog: { label: '博客文章', href: '/blog/' },
  projects: { label: '作品橱窗', href: '/projects/' },
  about: { label: '关于我', href: '/about/' },
  guestbook: { label: '留言板', href: '/guestbook/' },
  friends: { label: '友链', href: ABOUT_SECTION_LINKS[8].href },
  bookmarks: { label: '书签', href: ABOUT_SECTION_LINKS[7].href },
  software: { label: '工具箱', href: ABOUT_SECTION_LINKS[6].href },
  gear: { label: '装备铺', href: ABOUT_SECTION_LINKS[5].href },
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
