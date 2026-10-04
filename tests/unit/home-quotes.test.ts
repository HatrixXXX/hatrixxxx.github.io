import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HOME_QUOTES, HOME_QUOTE_INTERVAL } from '../../src/data/home-quotes';

describe('home quotes', () => {
  it('keeps each quote visible for six seconds', () => {
    expect(HOME_QUOTE_INTERVAL).toBe(6_000);
  });

  it('keeps the complete quote inventory unique and unchanged', () => {
    expect(HOME_QUOTES).toHaveLength(83);
    expect(HOME_QUOTES).toContainEqual({ text: '纵有疾风起，人生不言弃。', source: '强风吹拂' });
    expect(HOME_QUOTES).toContainEqual({ text: '我曾以为自己的人生是一场悲剧，现在我才明白，它是一出喜剧。', source: '小丑' });
    expect(HOME_QUOTES).toContainEqual({
      text: '如果你手里只有一把锤子，那么一切看起来都像钉子。',
      source: '巴鲁克'
    });
    expect(new Set(HOME_QUOTES.map(({ text }) => text))).toHaveLength(83);
    expect(createHash('sha256').update(JSON.stringify(HOME_QUOTES)).digest('hex'))
      .toBe('616967f7fabc3746a035b8c990b60e35d876656bc93cdb532e55e4d38729b809');
  });
});
