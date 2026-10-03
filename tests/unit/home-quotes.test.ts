import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HOME_QUOTES, HOME_QUOTE_INTERVAL } from '../../src/data/home-quotes';

describe('home quotes', () => {
  it('keeps each quote visible for six seconds', () => {
    expect(HOME_QUOTE_INTERVAL).toBe(6_000);
  });

  it('includes every quote imported from 金句.md alongside the two existing quotes', () => {
    expect(HOME_QUOTES).toHaveLength(82);
    expect(HOME_QUOTES).toContainEqual({ text: '纵有疾风起，人生不言弃。', source: '强风吹拂' });
    expect(HOME_QUOTES).toContainEqual({ text: '我曾以为自己的人生是一场悲剧，现在我才明白，它是一出喜剧。', source: '小丑' });
    expect(new Set(HOME_QUOTES.map(({ text }) => text))).toHaveLength(82);
    expect(createHash('sha256').update(JSON.stringify(HOME_QUOTES)).digest('hex'))
      .toBe('842418a90070719095250ef1214a8bb736587c17d78c88260c03dee5397e098c');
  });
});
