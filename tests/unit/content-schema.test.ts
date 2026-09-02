import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { SITE } from '../../src/config/site';
import { playlist } from '../../src/data/playlist';

describe('content contracts', () => {
  it('does not carry taxonomy metadata', async () => {
    for (const directory of ['src/content/posts', 'src/drafts']) {
      const root = join(process.cwd(), directory);
      const files = (await readdir(root)).filter((file) => /\.mdx?$/.test(file));
      for (const file of files) {
        const { data } = matter(await readFile(join(root, file), 'utf8'));
        expect(data, `${directory}/${file}`).not.toHaveProperty('category');
        expect(data, `${directory}/${file}`).not.toHaveProperty('categories');
        expect(data, `${directory}/${file}`).not.toHaveProperty('tags');
      }
    }
  });

  it('starts with empty projects and playlist data', () => {
    expect(playlist).toEqual([]);
    expect(SITE.giscus.mapping).toBe('pathname');
  });
});
