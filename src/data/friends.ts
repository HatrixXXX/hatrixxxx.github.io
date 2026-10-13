export interface FriendLink {
  name: string;
  url: string;
  avatar: string;
  description: string;
}

export const FRIENDS: FriendLink[] = [
  {
    name: 'Sasasatori',
    url: 'https://www.cnblogs.com/sasasatori',
    avatar: 'https://assets.cnblogs.com/apple-touch-icon.png?v=2',
    description: '记录技术与生活的博客园博主'
  },
  {
    name: 'Polaris',
    url: 'https://polaris.xn--6qq986b3xl/',
    avatar: 'https://polaris.xn--6qq986b3xl/favicon.ico',
    description: '探索技术与创造的个人站点'
  },
  {
    name: 'Penry',
    url: 'https://penry.asia/',
    avatar: 'https://penry.asia/favicon.ico',
    description: '个人技术与生活记录'
  },
  {
    name: 'KraHsu',
    url: 'https://blog.krahsu.top/',
    avatar: 'https://blog.krahsu.top/favicon.svg',
    description: 'KraHsu 的个人博客'
  }
];

