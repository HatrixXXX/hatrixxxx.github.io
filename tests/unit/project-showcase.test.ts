import { describe, expect, it } from 'vitest';
import { wrapIndex } from '../../src/lib/project-showcase';

describe('project showcase carousel', () => {
  it('wraps in both directions without leaving the slide range', () => {
    expect(wrapIndex(1, 3)).toBe(1);
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(0, 1)).toBe(0);
  });
});
