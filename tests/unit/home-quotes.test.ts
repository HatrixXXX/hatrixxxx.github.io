import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HOME_QUOTES, HOME_QUOTE_INTERVAL } from '../../src/data/home-quotes';

describe('home quotes', () => {
  it('keeps each quote visible for six seconds', () => {
    expect(HOME_QUOTE_INTERVAL).toBe(6_000);
  });

  it('keeps the complete quote inventory unique and unchanged', () => {
    expect(HOME_QUOTES).toHaveLength(84);
    expect(HOME_QUOTES).toContainEqual({ text: '纵有疾风起，人生不言弃。', source: '强风吹拂' });
    expect(HOME_QUOTES).toContainEqual({ text: '我曾以为自己的人生是一场悲剧，现在我才明白，它是一出喜剧。', source: '小丑' });
    expect(HOME_QUOTES).toContainEqual({
      text: '如果你手里只有一把锤子，那么一切看起来都像钉子。',
      source: '巴鲁克'
    });
    expect(HOME_QUOTES).toContainEqual({ text: '金牌选手不会从天而降，你必须用热爱、刻苦和投入来浇灌他们。', source: '行码棋' });
    expect(new Set(HOME_QUOTES.map(({ text }) => text))).toHaveLength(84);
    expect(createHash('sha256').update(JSON.stringify(HOME_QUOTES)).digest('hex'))
      .toBe('817165405f95e4f54a7208c9c3dff3e990959136494d6888d8575416bca1e5f1');
  });
});
