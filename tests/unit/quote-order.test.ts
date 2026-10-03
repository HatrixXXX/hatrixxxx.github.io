import { describe, expect, it } from 'vitest';
import { shuffleQuoteOrder } from '../../src/lib/quote-order';

describe('shuffleQuoteOrder', () => {
  it('returns a complete shuffled copy without mutating the input', () => {
    const input = [0, 1, 2, 3];
    const order = shuffleQuoteOrder(input, undefined, () => 0.999_999);
    expect(order).toEqual([3, 0, 1, 2]);
    expect(input).toEqual([0, 1, 2, 3]);
  });

  it('selects the first item uniformly from every index except the previous one', () => {
    const firstItems = [0, 0.34, 0.999_999].map((randomValue) =>
      shuffleQuoteOrder([0, 1, 2, 3], 0, () => randomValue)[0]);
    expect(firstItems).toEqual([1, 2, 3]);
  });
});
