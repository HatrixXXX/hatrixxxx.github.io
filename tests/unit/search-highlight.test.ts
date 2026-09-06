import { describe, expect, it } from 'vitest';
import { findSearchTarget } from '../../src/scripts/search-highlight';

function element(textContent: string): HTMLElement {
  return { textContent } as HTMLElement;
}

describe('search highlight target selection', () => {
  it('returns the first case-insensitive matching element', () => {
    const first = element('没有命中');
    const second = element('这里包含矩阵乘法');
    const third = element('矩阵乘法的后续说明');

    expect(findSearchTarget([first, second, third], '矩阵')).toBe(second);
  });

  it('returns undefined for an empty query or no match', () => {
    const elements = [element('正文')];

    expect(findSearchTarget(elements, '   ')).toBeUndefined();
    expect(findSearchTarget(elements, '不存在')).toBeUndefined();
  });
});
