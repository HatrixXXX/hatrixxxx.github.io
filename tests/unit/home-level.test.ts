import { describe, expect, it } from 'vitest';
import { getHomeLevel } from '../../src/lib/home-level';

describe('birthday level in Beijing time', () => {
  it.each([
    ['2002-07-28T16:00:00Z', 0, 0, 365],
    ['2026-07-28T15:59:59Z', 23, 364, 365],
    ['2026-07-28T16:00:00Z', 24, 0, 365],
    ['2026-07-29T15:59:59Z', 24, 0, 365],
    ['2026-07-29T16:00:00Z', 24, 1, 365],
    ['2026-09-25T00:00:00Z', 24, 58, 365],
    ['2026-01-01T00:00:00Z', 23, 156, 365],
    ['2024-02-29T00:00:00Z', 21, 215, 366],
    ['2024-03-01T00:00:00Z', 21, 216, 366],
    ['2024-07-28T16:00:00Z', 22, 0, 365]
  ])('%s gives level %i with %i of %i days completed', (instant, level, elapsedDays, yearDays) => {
    expect(getHomeLevel(new Date(instant))).toEqual({
      level, elapsedDays, yearDays, progress: elapsedDays / yearDays
    });
  });
});
