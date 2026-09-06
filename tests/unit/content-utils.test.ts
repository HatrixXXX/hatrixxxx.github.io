import { describe, expect, it } from 'vitest';
import { buildArchives, getAdjacentPosts, paginatePosts, sortPosts, type PostEntry } from '../../src/lib/content';
import * as search from '../../src/lib/search';

const markdownToPlainText = (search as typeof search & {
  markdownToPlainText?: (markdown: string, maxLength?: number) => string;
}).markdownToPlainText;
const markdownToParagraphs = (search as typeof search & {
  markdownToParagraphs?: (markdown: string) => string[];
}).markdownToParagraphs;
const tokenizeSearchText = (search as typeof search & {
  tokenizeSearchText?: (text: string) => string[];
}).tokenizeSearchText;
const excerptForMatch = (search as typeof search & {
  excerptForMatch?: (paragraphs: string[], query: string, maxLength?: number) => string;
}).excerptForMatch;

const post = (id: string, date: string) => ({
  id,
  data: {
    title: id,
    pubDate: new Date(date),
    cover: '/x.svg',
    type: '技术笔记',
    draft: false,
    locked: false,
    math: false,
    mermaid: false,
    legacySlug: id
  }
}) as PostEntry;

const fixtures = [
  post('old', '2025-01-02'),
  post('new', '2026-02-03'),
  post('middle', '2025-06-04')
];

describe('content utilities', () => {
  it('sorts without mutating input', () => {
    expect(sortPosts(fixtures).map((item) => item.id)).toEqual(['new', 'middle', 'old']);
    expect(fixtures[0].id).toBe('old');
  });

  it('paginates with six items by default', () => {
    const page = paginatePosts(
      Array.from({ length: 7 }, (_, i) => post(String(i), `2025-01-${String(i + 1).padStart(2, '0')}`)),
      2
    );
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
  });

  it('rejects page numbers outside the available range', () => {
    expect(() => paginatePosts(fixtures, 0)).toThrow(RangeError);
    expect(() => paginatePosts(fixtures, 2)).toThrow(RangeError);
  });

  it('groups archives in newest-first order', () => {
    expect(buildArchives(fixtures).map((group) => [group.year, group.month, group.posts.length]))
      .toEqual([[2026, 2, 1], [2025, 6, 1], [2025, 1, 1]]);
  });

  it('returns chronological neighbours from newest-first input', () => {
    const adjacent = getAdjacentPosts(sortPosts(fixtures), 'middle');
    expect(adjacent.previous?.id).toBe('new');
    expect(adjacent.next?.id).toBe('old');
  });

  it('returns no neighbours for an unknown post', () => {
    expect(getAdjacentPosts(fixtures, 'missing')).toEqual({});
  });

  it('serializes a post into a searchable document', () => {
    const source = { ...post('FPGA', '2026-02-03'), body: 'a'.repeat(2501) } as PostEntry & { body: string };
    const document = search.toSearchDocument(source);
    expect(document).toMatchObject({
      id: 'FPGA',
      url: '/posts/FPGA/',
      title: 'FPGA',
      locked: false,
      paragraphs: expect.any(Array)
    });
    expect(document).not.toHaveProperty('category');
    expect(document).not.toHaveProperty('tags');
    expect(document.text).toContain('FPGA');
    expect(document.paragraphs).toEqual(['a'.repeat(2501)]);
    expect(document.text.endsWith('a'.repeat(2501))).toBe(true);
  });

  it('keeps locked post body text out of the search document', () => {
    const source = {
      ...post('locked-post', '2026-02-03'),
      body: 'distinctive-private-body-marker',
      data: {
        ...post('locked-post', '2026-02-03').data,
        title: 'Public locked title',
        locked: true
      }
    } as PostEntry & { body: string };

    expect(search.toSearchDocument(source)).toEqual({
      id: 'locked-post',
      url: '/posts/locked-post/',
      title: 'Public locked title',
      locked: true,
      text: 'Public locked title',
      paragraphs: []
    });
  });

  it('extracts searchable paragraphs and overlapping Chinese tokens', () => {
    expect(markdownToParagraphs).toBeTypeOf('function');
    expect(tokenizeSearchText).toBeTypeOf('function');
    if (!markdownToParagraphs || !tokenizeSearchText) return;

    expect(markdownToParagraphs('## 矩阵乘法\n\n第一段内容。\n\n第二段内容。')).toEqual([
      '矩阵乘法',
      '第一段内容。',
      '第二段内容。'
    ]);
    expect(tokenizeSearchText('矩阵乘法 GPU')).toEqual(expect.arrayContaining(['矩', '阵', '乘', '法', '矩阵', '阵乘', '乘法', 'gpu']));
  });

  it('extracts a bounded excerpt around the matching paragraph', () => {
    expect(excerptForMatch).toBeTypeOf('function');
    if (!excerptForMatch) return;

    expect(excerptForMatch(['前置内容。', '这一段包含需要查找的关键词以及后续说明。'], '关键词', 16))
      .toBe('…需要查找的关键词以及后续说明…');
  });

  it('normalizes Markdown into searchable plain text', () => {
    expect(markdownToPlainText).toBeTypeOf('function');
    if (!markdownToPlainText) return;

    expect(markdownToPlainText(`## Heading\n\n**strong** and *emphasis* with \`inline code\`.\n\n[Link label](https://example.com) ![image alt](image.png)\n\n\`\`\`ts\nconst value = 1;\n\`\`\`\n\n<my_repo_url> <span>HTML</span> <!-- hidden -->`))
      .toBe('Heading strong and emphasis with inline code. Link label image alt const value = 1; <my_repo_url> HTML');
  });

  it('collapses whitespace and truncates normalized search text', () => {
    expect(markdownToPlainText).toBeTypeOf('function');
    if (!markdownToPlainText) return;

    expect(markdownToPlainText(' first\n\n second\tthird ', 12)).toBe('first second');
  });
});
