import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PostEntry } from '../../src/lib/content';
import {
  collectProtectedAssets,
  renderProtectedMarkdown
} from '../../src/lib/protected-content/markdown';

const keyBytes = new Uint8Array(32).fill(7);
const fixtureImage = resolve('tests/fixtures/protected-content/private-image.png');
let temporaryRoot: string;
let postsRoot: string;
let postPath: string;
let previousContentDir: string | undefined;

function fixturePost(body: string, overrides: Partial<PostEntry> = {}): PostEntry {
  return {
    id: 'locked-post',
    collection: 'posts',
    body,
    filePath: postPath,
    data: {
      title: 'Locked post',
      description: 'Public description',
      pubDate: new Date('2026-09-03'),
      cover: '/cover.svg',
      type: '技术笔记',
      draft: false,
      locked: true,
      math: true,
      mermaid: false,
      legacySlug: 'locked-post'
    },
    ...overrides
  } as PostEntry;
}

beforeEach(async () => {
  previousContentDir = process.env.HATRIX_CONTENT_DIR;
  temporaryRoot = await mkdtemp(join(tmpdir(), 'hatrix-protected-markdown-'));
  postsRoot = join(temporaryRoot, 'posts');
  postPath = join(postsRoot, 'nested', 'private.md');
  process.env.HATRIX_CONTENT_DIR = temporaryRoot;
  await mkdir(join(postsRoot, 'nested'), { recursive: true });
  await copyFile(fixtureImage, join(postsRoot, 'nested', 'private-image.png'));
  await writeFile(postPath, '# fixture', 'utf8');
});

afterEach(async () => {
  if (previousContentDir === undefined) {
    delete process.env.HATRIX_CONTENT_DIR;
  } else {
    process.env.HATRIX_CONTENT_DIR = previousContentDir;
  }
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe('protected Markdown', () => {
  it('replaces a local image with an opaque encrypted asset reference', async () => {
    const result = await renderProtectedMarkdown(
      fixturePost('Private marker.\n\n![secret alt](./private-image.png "secret title")'),
      keyBytes
    );

    expect(result.html).toContain('data-protected-src="/protected-content/assets/');
    expect(result.html).toContain('data-protected-type="image/png"');
    expect(result.html).toContain('alt="secret alt"');
    expect(result.html).toContain('title="secret title"');
    expect(result.html).not.toContain('private-image.png');
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toEqual({
      id: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      sourcePath: join(postsRoot, 'nested', 'private-image.png'),
      mediaType: 'image/png',
      aad: `asset:${result.assets[0].id}`,
      url: `/protected-content/assets/${result.assets[0].id}.bin`
    });
    expect(result.assets[0].id).not.toContain('private-image');
  });

  it('uses the content key for IDs and deduplicates repeated image references', async () => {
    const body = '![first](./private-image.png)\n\n![second](./private-image.png)';
    const first = await renderProtectedMarkdown(fixturePost(body), keyBytes);
    const otherKey = await renderProtectedMarkdown(fixturePost(body), new Uint8Array(32).fill(8));

    expect(first.assets).toHaveLength(1);
    expect(otherKey.assets).toHaveLength(1);
    expect(first.assets[0].id).not.toBe(otherKey.assets[0].id);
    expect(first.html.match(/data-protected-src=/g)).toHaveLength(2);
  });

  it('changes the opaque asset ID and URL when bytes change at the same path', async () => {
    const body = '![secret](./private-image.png)';
    const first = await renderProtectedMarkdown(fixturePost(body), keyBytes);
    await writeFile(join(postsRoot, 'nested', 'private-image.png'), new Uint8Array([1, 2, 3, 4]));
    const replacement = await renderProtectedMarkdown(fixturePost(body), keyBytes);

    expect(first.assets[0].id).not.toBe(replacement.assets[0].id);
    expect(first.assets[0].url).not.toBe(replacement.assets[0].url);
    expect(replacement.assets[0].aad).toBe(`asset:${replacement.assets[0].id}`);
  });

  it.each([
    '![x](https://example.com/x.png)',
    '![x](/images/x.png)',
    '![x](../../outside.png)'
  ])('rejects an unprotectable image reference without echoing private body text: %s', async (image) => {
    const privateText = 'PRIVATE BODY MUST NOT APPEAR IN ERRORS';
    await writeFile(join(temporaryRoot, 'outside.png'), 'outside', 'utf8');

    try {
      await renderProtectedMarkdown(fixturePost(`${privateText}\n\n${image}`), keyBytes);
      throw new Error('expected protected Markdown rendering to reject the image');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/加锁文章/);
      expect((error as Error).message).not.toContain(privateText);
    }
  });

  it('rejects raw HTML images because they cannot be safely rewritten', async () => {
    await expect(
      renderProtectedMarkdown(fixturePost('<img src="./private-image.png" alt="secret">'), keyBytes)
    ).rejects.toThrow(/加锁文章/);
  });

  it('rejects an image reached through a symlink that escapes the content root', async () => {
    const outsideDirectory = join(temporaryRoot, 'outside');
    await mkdir(outsideDirectory);
    await copyFile(fixtureImage, join(outsideDirectory, 'private-image.png'));
    await symlink(outsideDirectory, join(postsRoot, 'nested', 'linked'), 'junction');

    await expect(
      renderProtectedMarkdown(fixturePost('![secret](./linked/private-image.png)'), keyBytes)
    ).rejects.toThrow(/加锁文章/);
  });

  it('accepts only the default private content root when HATRIX_CONTENT_DIR is unset', async () => {
    const previousWorkingDirectory = process.cwd();
    const privatePosts = join(temporaryRoot, '.private-content', 'posts');
    const publicPosts = join(temporaryRoot, 'src', 'content', 'posts');
    const privatePostPath = join(privatePosts, 'private.md');
    const publicPostPath = join(publicPosts, 'public.md');
    delete process.env.HATRIX_CONTENT_DIR;
    await mkdir(privatePosts, { recursive: true });
    await mkdir(publicPosts, { recursive: true });
    await copyFile(fixtureImage, join(privatePosts, 'private-image.png'));
    await copyFile(fixtureImage, join(publicPosts, 'private-image.png'));
    await writeFile(privatePostPath, '# private fixture', 'utf8');
    await writeFile(publicPostPath, '# public fixture', 'utf8');

    try {
      process.chdir(temporaryRoot);
      await expect(
        renderProtectedMarkdown(
          fixturePost('![private](./private-image.png)', { filePath: privatePostPath }),
          keyBytes
        )
      ).resolves.toMatchObject({ assets: [{ sourcePath: join(privatePosts, 'private-image.png') }] });
      await expect(
        renderProtectedMarkdown(
          fixturePost('![public](./private-image.png)', { filePath: publicPostPath }),
          keyBytes
        )
      ).rejects.toThrow(/加锁文章/);
    } finally {
      process.chdir(previousWorkingDirectory);
    }
  });

  it('keeps the existing math and Shiki Markdown behavior', async () => {
    const result = await renderProtectedMarkdown(
      fixturePost('$x^2$\n\n```ts\nconst value = 1;\n```'),
      keyBytes
    );

    expect(result.html).toContain('class="katex"');
    expect(result.html).toContain('github-dark');
  });

  it('collects assets only from published locked posts and deduplicates them', async () => {
    const body = '![secret](./private-image.png)';
    const locked = fixturePost(body);
    const duplicate = fixturePost(body, { id: 'locked-duplicate' });
    const publicPost = fixturePost(body, {
      id: 'public-post',
      data: { ...locked.data, locked: false }
    });
    const draftPost = fixturePost(body, {
      id: 'draft-post',
      data: { ...locked.data, draft: true }
    });

    const assets = await collectProtectedAssets(
      [locked, duplicate, publicPost, draftPost],
      keyBytes
    );

    expect(assets).toHaveLength(1);
    expect(relative(postsRoot, assets[0].sourcePath)).toBe(join('nested', 'private-image.png'));
  });
});
