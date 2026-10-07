import { describe, expect, it } from 'vitest';
import { latestPostLimit } from '../../src/lib/post-layout';

describe('latest post rail sizing', () => {
  it.each([
    [0, 6],
    [4, 6],
    [8, 5],
    [12, 4],
    [16, 3],
    [20, 2]
  ])('maps %i headings to %i latest posts', (headingCount, expected) => {
    expect(latestPostLimit(headingCount)).toBe(expected);
  });
});
