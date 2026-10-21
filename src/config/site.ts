export const SITE = {
  title: "Hatrixの窝",
  tagline: '轻松即单纯，速成即精准',
  description: '技术研发、学习记录与作品展示',
  url: 'https://hatrix.site',
  author: {
    name: 'Hatrix',
    email: '3113624526@qq.com',
    avatar: '/assets/images/avatar.jpg'
  },
  socials: [
    { id: 'rss', label: 'RSS', url: '/rss.xml', color: '#f59e0b' },
    { id: 'bilibili', label: 'Bilibili', url: 'https://space.bilibili.com/352420563', color: '#fb7299' },
    { id: 'zhihu', label: '知乎', url: 'https://www.zhihu.com/people/hatrixxxx', color: '#2f88ff' },
    { id: 'github', label: 'GitHub', url: 'https://github.com/HatrixXXX', color: '#a78bfa' }
  ],
  filings: [] as readonly { label: string; url: string }[],
  twikoo: {
    envId: 'https://comments.hatrix.site'
  },
  verification: { bing: '3B97E495A5055898AEC92C5FF736F169' }
} as const;
