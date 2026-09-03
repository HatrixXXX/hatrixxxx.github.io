import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { describe, expect, it, vi } from 'vitest';
import { POST_TYPES } from '../../src/config/navigation';
import { SITE } from '../../src/config/site';

vi.mock('astro:content', () => ({ defineCollection: <T>(config: T) => config }));
vi.mock('astro/loaders', () => ({ glob: <T>(config: T) => config }));
vi.mock('astro/zod', async () => {
  const { z } = await import('../../node_modules/.pnpm/zod@4.5.4/node_modules/zod/index.js');
  return { z };
});

import { collections } from '../../src/content.config';
import { playlist } from '../../src/data/playlist';
import { contentRoot } from '../../src/lib/content-root';

const postSchema = collections.posts.schema;

if (!postSchema || typeof postSchema === 'function') {
  throw new Error('posts collection must expose a schema object');
}

const postFixture = {
  title: 'Schema fixture',
  description: 'Exercises the post metadata schema.',
  pubDate: '2026-09-03',
  cover: 'https://example.com/cover.png',
  type: POST_TYPES[0],
  legacySlug: 'schema-fixture'
};

describe('content contracts', () => {
  it('assigns every published post an approved type without taxonomy metadata', async () => {
    const root = join(process.cwd(), 'src/content/posts');
    const files = (await readdir(root)).filter((file) => /\.mdx?$/.test(file));
    const counts = Object.fromEntries(POST_TYPES.map((type) => [type, 0]));

    expect(files).toHaveLength(40);
    for (const file of files) {
      const { data } = matter(await readFile(join(root, file), 'utf8'));
      expect(POST_TYPES, file).toContain(data.type);
      counts[data.type as keyof typeof counts] += 1;
      expect(data, file).not.toHaveProperty('category');
      expect(data, file).not.toHaveProperty('categories');
      expect(data, file).not.toHaveProperty('tags');
    }

    expect(counts).toEqual({
      技术笔记: 37,
      踩坑记录: 1,
      生活动态: 0,
      好物推荐: 2,
      随笔杂谈: 0
    });
  });

  it('starts with empty projects and playlist data', () => {
    expect(playlist).toEqual([]);
    expect(SITE.giscus.mapping).toBe('pathname');
  });

  it('gives Astro a file URL for the absolute private posts root', () => {
    const postLoader = (collections.posts as unknown as { loader: { base: string } }).loader;
    expect(postLoader.base).toBe(pathToFileURL(contentRoot('posts')).href);
  });

  it('defaults omitted locked metadata to public and rejects non-boolean values', () => {
    const publicPost = postSchema.safeParse(postFixture);
    expect(publicPost.success).toBe(true);
    if (publicPost.success) {
      expect(publicPost.data.locked).toBe(false);
    }

    expect(postSchema.safeParse({ ...postFixture, locked: 'true' }).success).toBe(false);
  });
});
