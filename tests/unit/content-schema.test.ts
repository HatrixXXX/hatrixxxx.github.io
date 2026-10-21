import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { SITE } from '../../src/config/site';
import { playlist } from '../../src/data/playlist';
import { contentRoot } from '../../src/lib/content-root';
import { postSchema } from '../../src/lib/post-schema';

const postFixture = {
  title: 'Schema fixture',
  summary: '一篇用于校验文章元数据的示例。',
  pubDate: '2026-09-03',
  cover: 'https://example.com/cover.png',
  legacySlug: 'schema-fixture'
};

describe('content contracts', () => {
  it('keeps published frontmatter free of removed metadata', async () => {
    const root = contentRoot('posts');
    const files = (await readdir(root)).filter((file) => /\.mdx?$/.test(file));
    const usesPublicFixtures = root === resolve('tests/fixtures/private-content/posts');
    let lockedPosts = 0;

    expect(files).toHaveLength(usesPublicFixtures ? 2 : 13);
    for (const file of files) {
      const { data } = matter(await readFile(join(root, file), 'utf8'));
      expect(postSchema.safeParse(data).success, file).toBe(true);
      if (data.locked === true) lockedPosts += 1;
      expect(data, file).not.toHaveProperty('type');
      expect(data, file).not.toHaveProperty('series');
      expect(data, file).not.toHaveProperty('seriesOrder');
      expect(data, file).not.toHaveProperty('math');
      expect(data, file).not.toHaveProperty('mermaid');
      expect(data, file).not.toHaveProperty('category');
      expect(data, file).not.toHaveProperty('categories');
      expect(data, file).not.toHaveProperty('tags');
    }

    expect(lockedPosts).toBe(usesPublicFixtures ? 1 : 0);
  });

  it('keeps the configured playlist entries valid', () => {
    expect(playlist).toHaveLength(20);
    expect(new Set(playlist.map(({ id }) => id)).size).toBe(playlist.length);
    for (const track of playlist) {
      expect(track.title.trim()).not.toBe('');
      expect(track.artist.trim()).not.toBe('');
      expect(track.src).toMatch(/^\/assets\/audio\/.+\.(mp3|ogg)$/);
      expect(existsSync(join('public', decodeURIComponent(track.src).slice(1)))).toBe(true);
    }
  });

  it('uses the dedicated Twikoo endpoint for comments', () => {
    expect(SITE.twikoo.envId).toBe('https://comments.hatrix.site');
  });

  it('loads published posts from the private content root', async () => {
    const config = await readFile(join(process.cwd(), 'src/content.config.ts'), 'utf8');
    expect(config).toContain("import { pathToFileURL } from 'node:url';");
    expect(config).toContain("import { contentRoot } from './lib/content-root';");
    expect(config).toContain("base: pathToFileURL(contentRoot('posts')).href");
    expect(config).not.toContain('./src/content/posts');
  });

  it('defaults omitted locked metadata to public and rejects non-boolean values', () => {
    const publicPost = postSchema.safeParse(postFixture);
    expect(publicPost.success).toBe(true);
    if (publicPost.success) {
      expect(publicPost.data).toEqual({
        ...postFixture,
        pubDate: new Date(postFixture.pubDate),
        locked: false
      });
    }

    expect(postSchema.safeParse({ ...postFixture, locked: 'true' }).success).toBe(false);
  });

  it('requires a nonempty summary of at most 100 characters', () => {
    const { summary: _summary, ...postWithoutSummary } = postFixture;

    expect(postSchema.safeParse(postWithoutSummary).success).toBe(false);
    expect(postSchema.safeParse({ ...postFixture, summary: '   ' }).success).toBe(false);
    expect(postSchema.safeParse({ ...postFixture, summary: '文'.repeat(100) }).success).toBe(true);
    expect(postSchema.safeParse({ ...postFixture, summary: '文'.repeat(101) }).success).toBe(false);
  });

  it('accepts an omitted cover while rejecting an empty cover', () => {
    const { cover: _cover, ...postWithoutCover } = postFixture;

    expect(postSchema.safeParse(postWithoutCover).success).toBe(true);
    expect(postSchema.safeParse({ ...postFixture, cover: '' }).success).toBe(false);
  });
});
