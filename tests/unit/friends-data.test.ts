import { describe, expect, it } from 'vitest';
import { FRIENDS } from '../../src/data/friends';

describe('friend links', () => {
  it('contains only the four confirmed destinations', () => {
    expect(FRIENDS.map(({ url }) => url)).toEqual([
      'https://www.cnblogs.com/sasasatori',
      'https://polaris.xn--6qq986b3xl/',
      'https://penry.asia/',
      'https://blog.krahsu.top/'
    ]);
  });

  it('includes KraHsu with the public site metadata', () => {
    expect(FRIENDS).toContainEqual({
      name: 'KraHsu',
      url: 'https://blog.krahsu.top/',
      avatar: 'https://blog.krahsu.top/favicon.svg',
      description: 'KraHsu 的个人博客'
    });
  });
});
