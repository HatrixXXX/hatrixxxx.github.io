import { describe, expect, it } from 'vitest';
import { buildArchives, buildTaxonomy, getAdjacentPosts, paginatePosts, sortPosts, type PostEntry } from '../../src/lib/content';
import * as search from '../../src/lib/search';

const markdownToPlainText = (search as typeof search & {
  markdownToPlainText?: (markdown: string, maxLength?: number) => string;
}).markdownToPlainText;

const post = (id: string, date: string, category = '软件工程与工具', tags = ['Git']) => ({
  id,
  data: {
    title: id,
    description: `description for ${id}`,
    pubDate: new Date(date),
    cover: '/x.svg',
    category,
    tags,
    draft: false,
    math: false,
    mermaid: false,
    legacySlug: id
  }
}) as PostEntry;

const fixtures = [
  post('old', '2025-01-02'),
  post('new', '2026-02-03'),
  post('middle', '2025-06-04', 'FPGA 与数字系统', ['FPGA'])
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

  it('groups archives and taxonomies in newest-first order', () => {
    expect(buildArchives(fixtures).map((group) => [group.year, group.month, group.posts.length]))
      .toEqual([[2026, 2, 1], [2025, 6, 1], [2025, 1, 1]]);
    expect(buildTaxonomy(fixtures, 'category').get('软件工程与工具')?.map((item) => item.id))
      .toEqual(['new', 'old']);
    expect(buildTaxonomy(fixtures, 'tags').get('FPGA')?.map((item) => item.id)).toEqual(['middle']);
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
      description: 'description for FPGA',
      category: '软件工程与工具',
      tags: ['Git']
    });
    expect(document.text).toContain('FPGA description for FPGA 软件工程与工具 Git');
    expect(document.text.endsWith('a'.repeat(2000))).toBe(true);
  });

  it('normalizes Markdown into searchable plain text', () => {
    expect(markdownToPlainText).toBeTypeOf('function');
    if (!markdownToPlainText) return;

    expect(markdownToPlainText(`## Heading\n\n**strong** and *emphasis* with \`inline code\`.\n\n[Link label](https://example.com) ![image alt](image.png)\n\n\`\`\`ts\nconst value = 1;\n\`\`\`\n\n<my_repo_url> <span>HTML</span>`))
      .toBe('Heading strong and emphasis with inline code. Link label image alt const value = 1; HTML');
  });

  it('collapses whitespace and truncates normalized search text', () => {
    expect(markdownToPlainText).toBeTypeOf('function');
    if (!markdownToPlainText) return;

    expect(markdownToPlainText(' first\n\n second\tthird ', 12)).toBe('first second');
  });
});
