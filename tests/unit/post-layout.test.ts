import { describe, expect, it } from 'vitest';
import { latestPostLimit } from '../../src/lib/post-layout';

describe('latest post rail sizing', () => {
  it.each([
    [0, 4],
    [4, 4],
    [8, 3],
    [12, 2],
    [16, 1],
    [20, 0]
  ])('maps %i headings to %i latest posts', (headingCount, expected) => {
    expect(latestPostLimit(headingCount)).toBe(expected);
  });
});
