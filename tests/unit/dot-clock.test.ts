import { describe, expect, it } from 'vitest';
import { changedDigitIndexes, formatClockTime, pointsForClock } from '../../src/lib/dot-clock';

describe('dot clock geometry', () => {
  it('formats a zero-padded clock value', () => {
    expect(formatClockTime(new Date(2025, 0, 1, 9, 8, 7))).toBe('09:08:07');
  });

  it('returns only changed numeric positions', () => {
    expect(changedDigitIndexes('12:34:59', '12:35:00')).toEqual([4, 6, 7]);
  });

  it('creates bounded points for eight clock characters', () => {
    const points = pointsForClock('00:00:00');
    expect(points.length).toBeGreaterThan(0);
    expect(points.every(({ x, y, characterIndex }) =>
      x >= 0 && x < 47 && y >= 0 && y < 7 && characterIndex >= 0 && characterIndex < 8
    )).toBe(true);
  });

  it('rejects values outside the HH:mm:ss shape', () => {
    expect(() => pointsForClock('9:08:07')).toThrowError('clock value must use HH:mm:ss');
  });
});
