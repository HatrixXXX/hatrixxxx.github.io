import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { snippetRoot } from '../../src/lib/snippet-root';
import { snippetSchema } from '../../src/lib/snippet-schema';
import { IMMUTABLE_IMAGE_PREFIX } from '../../src/lib/safe-url';
import { getAdjacentSnippets, snippetIdFromFile, snippetPath, sortSnippets } from '../../src/lib/snippets';

const fixture = {
  title: '一篇随笔',
  date: '2026-10-12',
  description: '简短介绍',
  cover: '/assets/images/snippets/wallpaper.webp'
};

describe('snippets content', () => {
  it('loads snippets from their own collection and checkout in both build modes', () => {
    const config = readFileSync('src/content.config.ts', 'utf8');
    const workflow = readFileSync('.github/workflows/pages-deploy.yml', 'utf8');
    expect(config).toContain("base: pathToFileURL(snippetRoot('snippets')).href");
    expect(config).toContain('export const collections = { posts, snippets, sanctuary, projects };');
    expect(workflow).toContain('HATRIX_SNIPPETS_DIR: tests/fixtures/private-snippets');
    expect(workflow).toContain('HATRIX_SNIPPETS_DIR: .private-snippets');
    expect(workflow).toContain('repository: HatrixXXX/hatrix-snippets');
    expect(workflow).toContain('ssh-key: ${{ secrets.HATRIX_SNIPPETS_DEPLOY_KEY }}');
    expect(workflow).toContain('path: .private-snippets');
  });

  it('uses a private repository separate from blog posts', () => {
    const previousRoot = process.env.HATRIX_SNIPPETS_DIR;
    try {
      delete process.env.HATRIX_SNIPPETS_DIR;
      expect(snippetRoot('snippets')).toBe(resolve('.private-snippets', 'snippets'));
      process.env.HATRIX_SNIPPETS_DIR = 'tests/fixtures/private-snippets';
      expect(snippetRoot('snippets')).toBe(resolve('tests/fixtures/private-snippets', 'snippets'));
      process.env.HATRIX_SNIPPETS_DIR = '';
      expect(() => snippetRoot()).toThrow('HATRIX_SNIPPETS_DIR must not be empty');
    } finally {
      if (previousRoot === undefined) delete process.env.HATRIX_SNIPPETS_DIR;
      else process.env.HATRIX_SNIPPETS_DIR = previousRoot;
    }
  });

  it('parses metadata and allows an omitted cover and description', () => {
    expect(snippetSchema.parse(fixture)).toEqual({ ...fixture, date: new Date(fixture.date) });
    expect(snippetSchema.safeParse({ title: fixture.title, date: fixture.date }).success).toBe(true);
    expect(snippetSchema.safeParse({ ...fixture, title: '' }).success).toBe(false);
    expect(snippetSchema.safeParse({ ...fixture, date: 'invalid' }).success).toBe(false);
    expect(snippetSchema.safeParse({ ...fixture, date: '2026-10-12T00:00:00+08:00' }).success).toBe(false);
    expect(snippetSchema.safeParse({ ...fixture, locked: true }).success).toBe(false);
  });

  it('accepts approved immutable image-host covers', () => {
    expect(snippetSchema.safeParse({
      ...fixture, cover: `${IMMUTABLE_IMAGE_PREFIX}example.webp`
    }).success).toBe(true);
  });

  it('rejects unsafe local cover paths and unapproved remote covers', () => {
    for (const cover of ['https://example.com/x.webp', '//example.com/x.webp', 'javascript:x', '/x.webp?token=1', '/x.webp#part', '../x.webp']) {
      expect(snippetSchema.safeParse({ ...fixture, cover }).success, cover).toBe(false);
    }
    expect(snippetSchema.safeParse({
      ...fixture, cover: IMMUTABLE_IMAGE_PREFIX.replace(/@[a-f0-9]+\//, '@master/') + 'example.webp'
    }).success).toBe(false);
  });

  it('sorts newest first without changing the source array and builds detail paths', () => {
    const older = { id: 'older', data: { date: new Date('2025-01-01') } };
    const newer = { id: 'newer', data: { date: new Date('2026-01-01') } };
    const source = [older, newer];
    expect(sortSnippets(source)).toEqual([newer, older]);
    expect(source).toEqual([older, newer]);
    expect(snippetPath('older')).toBe('/snippets/older/');
    expect(snippetIdFromFile('My Note.md')).toBe('my-note');
    expect(snippetIdFromFile('我的随笔：秋天.md')).toBe('我的随笔秋天');
  });

  it('finds previous and next snippets in the timeline order', () => {
    const older = { id: 'older', data: { date: new Date('2024-01-01') } };
    const middle = { id: 'middle', data: { date: new Date('2025-01-01') } };
    const newer = { id: 'newer', data: { date: new Date('2026-01-01') } };
    const ordered = sortSnippets([older, newer, middle]);
    expect(getAdjacentSnippets(ordered, 'middle')).toEqual({ previous: newer, next: older });
    expect(getAdjacentSnippets(ordered, 'newer')).toEqual({ previous: undefined, next: middle });
    expect(getAdjacentSnippets(ordered, 'older')).toEqual({ previous: middle, next: undefined });
    expect(getAdjacentSnippets(ordered, 'missing')).toEqual({});
  });
});
