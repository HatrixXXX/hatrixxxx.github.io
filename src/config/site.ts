export const SITE = {
  title: "Hatrixの窝",
  tagline: '轻松即单纯，速成即精准',
  description: '技术研发、学习记录与作品展示',
  url: 'https://hatrix.site',
  author: {
    name: 'Hatrix',
    email: '3113624526@qq.com',
    avatar: '/images/avatar.jpg'
  },
  socials: [
    { id: 'rss', label: 'RSS', url: '/rss.xml', color: '#f59e0b' },
    { id: 'github', label: 'GitHub', url: 'https://github.com/HatrixXXX', color: '#a78bfa' },
    { id: 'bilibili', label: 'Bilibili', url: 'https://space.bilibili.com/352420563', color: '#fb7299' },
    { id: 'zhihu', label: '知乎', url: 'https://www.zhihu.com/people/hatrixxxx', color: '#2f88ff' },
    { id: 'xiaohongshu', label: '小红书', url: 'xhsdiscover://user/62a6030000000000190299d', color: '#ff2442' },
    { id: 'wechat', label: '微信', url: null, color: '#07c160' },
    { id: 'qqmusic', label: 'QQ 音乐', url: null, color: '#e6b800' },
    { id: 'email', label: '邮件', url: 'mailto:3113624526@qq.com', color: '#f97316' }
  ],
  filings: [] as readonly { label: string; url: string }[],
  giscus: {
    repo: 'hatrixxxx/hatrixxxx.github.io',
    repoId: 'R_kgDORB9GlQ',
    category: 'Comments',
    categoryId: 'DIC_kwDORB9Glc4DACF_',
    mapping: 'pathname'
  },
  verification: { bing: '3B97E495A5055898AEC92C5FF736F169' }
} as const;
