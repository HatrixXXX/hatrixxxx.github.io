import { describe, expect, it } from 'vitest';
import { ambientTrailCount } from '../../src/lib/ambient-trail';

describe('ambient trail sizing', () => {
  it.each([
    [0, 0],
    [47, 0],
    [80, 1],
    [220, 2],
    [420, 3],
    [800, 4]
  ])('maps a %i px gutter to %i curves', (gutter, expected) => {
    expect(ambientTrailCount(gutter)).toBe(expected);
  });
});
