import { describe, expect, it } from 'vitest';
import { getPostExcerpt } from '../../src/lib/post-excerpt';

describe('getPostExcerpt', () => {
  it('uses the first prose paragraph and removes Markdown links and emphasis', () => {
    const body = '# Heading\n\n![cover](cover.png)\n\n```ts\nconst secret = 1;\n```\n\n这是 **第一段**，参考 [资料](https://example.com)。\n\n这是第二段。';
    expect(getPostExcerpt(body, false)).toBe('这是第一段，参考资料。');
  });

  it('does not expose locked article body', () => {
    expect(getPostExcerpt('不能公开的正文', true)).toBeNull();
  });

  it('shortens long prose at a readable boundary', () => {
    expect(getPostExcerpt('第一句介绍。第二句提供背景。第三句补充内容。', false, 14)).toBe('第一句介绍。第二句提供背景。');
  });
});
