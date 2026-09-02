export const POST_CATEGORIES = [
  'FPGA 与数字系统',
  '嵌入式与硬件',
  'AI 与图形计算',
  '软件工程与工具',
  '数学与基础',
  '随笔与资源'
] as const;

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
    { label: 'GitHub', url: 'https://github.com/HatrixXXX' },
    { label: 'Gitee', url: 'https://gitee.com/hatrixxxx' },
    { label: 'Bilibili', url: 'https://space.bilibili.com/352420563' },
    { label: '知乎', url: 'https://www.zhihu.com/people/hatrixxxx' }
  ],
  giscus: {
    repo: 'hatrixxxx/hatrixxxx.github.io',
    repoId: 'R_kgDORB9GlQ',
    category: 'Comments',
    categoryId: 'DIC_kwDORB9Glc4DACF_',
    mapping: 'pathname'
  },
  verification: { bing: '3B97E495A5055898AEC92C5FF736F169' }
} as const;
