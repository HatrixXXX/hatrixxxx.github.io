import { describe, expect, it } from 'vitest';
import { FRIENDS } from '../../src/data/friends';

describe('friend links', () => {
  it('includes KraHsu with the public site metadata', () => {
    expect(FRIENDS).toContainEqual({
      name: 'KraHsu',
      url: 'https://blog.krahsu.top/',
      avatar: 'https://blog.krahsu.top/favicon.svg',
      description: 'KraHsu 的个人博客'
    });
  });
});
