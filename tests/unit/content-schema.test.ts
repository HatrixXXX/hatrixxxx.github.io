import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { POST_TYPES } from '../../src/config/navigation';
import { SITE } from '../../src/config/site';
import { playlist } from '../../src/data/playlist';
import { postSchema } from '../../src/lib/post-schema';

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

  it('keeps published posts on the current source root until the private migration', async () => {
    const config = await readFile(join(process.cwd(), 'src/content.config.ts'), 'utf8');
    expect(config).toContain("loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' })");
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
