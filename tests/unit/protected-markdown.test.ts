import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionEntry } from 'astro:content';
import {
  collectProtectedAssets,
  renderProtectedMarkdown
} from '../../src/lib/protected-content/markdown';

const keyBytes = new Uint8Array(32).fill(7);
const fixtureImage = resolve('tests/fixtures/protected-content/private-image.png');
let temporaryRoot: string;
let protectedRoot: string;
let entryPath: string;
let previousSnippetsDir: string | undefined;
let previousSanctuaryDir: string | undefined;

function fixtureSanctuary(body: string, overrides: Partial<CollectionEntry<'sanctuary'>> = {}): CollectionEntry<'sanctuary'> {
  return {
    id: 'private-sanctuary',
    collection: 'sanctuary',
    body,
    filePath: entryPath,
    data: {
      title: 'Private sanctuary',
      summary: 'Public summary',
      pubDate: new Date('2026-09-03'),
      cover: '/cover.svg',
    },
    ...overrides
  } as CollectionEntry<'sanctuary'>;
}

beforeEach(async () => {
  previousSnippetsDir = process.env.HATRIX_SNIPPETS_DIR;
  previousSanctuaryDir = process.env.HATRIX_SANCTUARY_DIR;
  temporaryRoot = await mkdtemp(join(tmpdir(), 'hatrix-protected-markdown-'));
  protectedRoot = join(temporaryRoot, 'sanctuary');
  entryPath = join(protectedRoot, 'nested', 'private.md');
  process.env.HATRIX_SNIPPETS_DIR = temporaryRoot;
  process.env.HATRIX_SANCTUARY_DIR = temporaryRoot;
  await mkdir(join(protectedRoot, 'nested'), { recursive: true });
  await copyFile(fixtureImage, join(protectedRoot, 'nested', 'private-image.png'));
  await writeFile(entryPath, '# fixture', 'utf8');
});

afterEach(async () => {
  if (previousSnippetsDir === undefined) delete process.env.HATRIX_SNIPPETS_DIR;
  else process.env.HATRIX_SNIPPETS_DIR = previousSnippetsDir;
  if (previousSanctuaryDir === undefined) delete process.env.HATRIX_SANCTUARY_DIR;
  else process.env.HATRIX_SANCTUARY_DIR = previousSanctuaryDir;
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe('protected Markdown', () => {
  it('keeps sanctuary images inside the encrypted asset pipeline', async () => {
    const sanctuaryRootPath = join(temporaryRoot, 'sanctuary');
    const sanctuaryFile = join(sanctuaryRootPath, '选购清单.md');
    await mkdir(sanctuaryRootPath, { recursive: true });
    await writeFile(sanctuaryFile, '# fixture', 'utf8');
    await copyFile(fixtureImage, join(sanctuaryRootPath, 'private-image.png'));
    const sanctuary = {
      id: '选购清单', collection: 'sanctuary', filePath: sanctuaryFile,
      body: '![private sanctuary image](./private-image.png)', data: {}
    } as CollectionEntry<'sanctuary'>;

    const result = await renderProtectedMarkdown(sanctuary, keyBytes);

    expect(result.html).toContain('data-protected-src="/protected-content/assets/');
    expect(result.html).not.toContain('private-image.png');
    expect(result.assets).toHaveLength(1);
  });
  it('encrypts snippet Markdown images from the private snippets checkout', async () => {
    const snippetsRoot = join(temporaryRoot, 'snippets');
    const snippetPath = join(snippetsRoot, 'private.md');
    await mkdir(snippetsRoot, { recursive: true });
    await writeFile(snippetPath, '# fixture', 'utf8');
    await copyFile(fixtureImage, join(snippetsRoot, 'private-image.png'));
    const snippet = {
      id: 'private', collection: 'snippets', filePath: snippetPath,
      body: '![secret alt](./private-image.png)',
      data: { title: 'Private snippet', date: new Date('2026-10-12') }
    } as CollectionEntry<'snippets'>;

    const result = await renderProtectedMarkdown(snippet, keyBytes);

    expect(result.html).toContain('data-protected-src="/protected-content/assets/');
    expect(result.html).not.toContain('private-image.png');
    expect(result.assets[0].sourcePath).toBe(join(snippetsRoot, 'private-image.png'));
  });
  it('replaces a local image with an opaque encrypted asset reference', async () => {
    const result = await renderProtectedMarkdown(
      fixtureSanctuary('Private marker.\n\n![secret alt](./private-image.png "secret title")'),
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
      sourcePath: join(protectedRoot, 'nested', 'private-image.png'),
      mediaType: 'image/png',
      aad: `asset:${result.assets[0].id}`,
      url: `/protected-content/assets/${result.assets[0].id}.bin`
    });
    expect(result.assets[0].id).not.toContain('private-image');
  });

  it.each([
    '![secret alt][PiC]\n\n[pIc]: ./private-image.png "secret title"',
    '![secret alt][]\n\n[SECRET ALT]: ./private-image.png "secret title"',
    '![secret alt]\n\n[SECRET ALT]: ./private-image.png "secret title"'
  ])('protects reference images with case-insensitive trailing definitions: %s', async (body) => {
    const result = await renderProtectedMarkdown(fixtureSanctuary(body), keyBytes);

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].sourcePath).toBe(join(protectedRoot, 'nested', 'private-image.png'));
    expect(result.html).toContain(`data-protected-src="${result.assets[0].url}"`);
    expect(result.html).toContain('data-protected-type="image/png"');
    expect(result.html).toContain('alt="secret alt"');
    expect(result.html).toContain('title="secret title"');
    expect(result.html).not.toContain('private-image.png');
  });

  it.each([
    'https://example.com/private.png',
    '/assets/private.png'
  ])('rejects reference images outside the protected relative asset pipeline: %s', async (url) => {
    await expect(renderProtectedMarkdown(
      fixtureSanctuary(`![secret][PiC]\n\n[pIc]: ${url}`),
      keyBytes
    )).rejects.toThrow(/加锁文章/);
  });

  it('keeps unresolved image references as text', async () => {
    const result = await renderProtectedMarkdown(fixtureSanctuary('![missing][not-defined]'), keyBytes);

    expect(result.assets).toEqual([]);
    expect(result.html).toContain('![missing][not-defined]');
  });

  it('uses the content key for IDs and deduplicates repeated image references', async () => {
    const body = '![first](./private-image.png)\n\n![second](./private-image.png)';
    const first = await renderProtectedMarkdown(fixtureSanctuary(body), keyBytes);
    const otherKey = await renderProtectedMarkdown(fixtureSanctuary(body), new Uint8Array(32).fill(8));

    expect(first.assets).toHaveLength(1);
    expect(otherKey.assets).toHaveLength(1);
    expect(first.assets[0].id).not.toBe(otherKey.assets[0].id);
    expect(first.html.match(/data-protected-src=/g)).toHaveLength(2);
  });

  it('changes the opaque asset ID and URL when bytes change at the same path', async () => {
    const body = '![secret](./private-image.png)';
    const first = await renderProtectedMarkdown(fixtureSanctuary(body), keyBytes);
    await writeFile(join(protectedRoot, 'nested', 'private-image.png'), new Uint8Array([1, 2, 3, 4]));
    const replacement = await renderProtectedMarkdown(fixtureSanctuary(body), keyBytes);

    expect(first.assets[0].id).not.toBe(replacement.assets[0].id);
    expect(first.assets[0].url).not.toBe(replacement.assets[0].url);
    expect(replacement.assets[0].aad).toBe(`asset:${replacement.assets[0].id}`);
  });

  it.each([
    '![x](https://example.com/x.png)',
    '![x](/assets/images/x.png)',
    '![x](../../outside.png)'
  ])('rejects an unprotectable image reference without echoing private body text: %s', async (image) => {
    const privateText = 'PRIVATE BODY MUST NOT APPEAR IN ERRORS';
    await writeFile(join(temporaryRoot, 'outside.png'), 'outside', 'utf8');

    try {
      await renderProtectedMarkdown(fixtureSanctuary(`${privateText}\n\n${image}`), keyBytes);
      throw new Error('expected protected Markdown rendering to reject the image');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/加锁文章/);
      expect((error as Error).message).not.toContain(privateText);
    }
  });

  it('rejects raw HTML images because they cannot be safely rewritten', async () => {
    await expect(
      renderProtectedMarkdown(fixtureSanctuary('<img src="./private-image.png" alt="secret">'), keyBytes)
    ).rejects.toThrow(/加锁文章/);
  });

  it('rejects an image reached through a symlink that escapes the content root', async () => {
    const outsideDirectory = join(temporaryRoot, 'outside');
    await mkdir(outsideDirectory);
    await copyFile(fixtureImage, join(outsideDirectory, 'private-image.png'));
    await symlink(outsideDirectory, join(protectedRoot, 'nested', 'linked'), 'junction');

    await expect(
      renderProtectedMarkdown(fixtureSanctuary('![secret](./linked/private-image.png)'), keyBytes)
    ).rejects.toThrow(/加锁文章/);
  });

  it('accepts only the default private sanctuary root when HATRIX_SANCTUARY_DIR is unset', async () => {
    const previousWorkingDirectory = process.cwd();
    const privateEntries = join(temporaryRoot, '.private-sanctuary', 'sanctuary');
    const publicEntries = join(temporaryRoot, 'src', 'content', 'sanctuary');
    const privateEntryPath = join(privateEntries, 'private.md');
    const publicEntryPath = join(publicEntries, 'public.md');
    delete process.env.HATRIX_SANCTUARY_DIR;
    await mkdir(privateEntries, { recursive: true });
    await mkdir(publicEntries, { recursive: true });
    await copyFile(fixtureImage, join(privateEntries, 'private-image.png'));
    await copyFile(fixtureImage, join(publicEntries, 'private-image.png'));
    await writeFile(privateEntryPath, '# private fixture', 'utf8');
    await writeFile(publicEntryPath, '# public fixture', 'utf8');

    try {
      process.chdir(temporaryRoot);
      await expect(
        renderProtectedMarkdown(
          fixtureSanctuary('![private](./private-image.png)', { filePath: privateEntryPath }),
          keyBytes
        )
      ).resolves.toMatchObject({ assets: [{ sourcePath: join(privateEntries, 'private-image.png') }] });
      await expect(
        renderProtectedMarkdown(
          fixtureSanctuary('![public](./private-image.png)', { filePath: publicEntryPath }),
          keyBytes
        )
      ).rejects.toThrow(/加锁文章/);
    } finally {
      process.chdir(previousWorkingDirectory);
    }
  });

  it('keeps the existing math and Shiki Markdown behavior', async () => {
    const result = await renderProtectedMarkdown(
      fixtureSanctuary('$x^2$\n\n```ts\nconst value = 1;\n```'),
      keyBytes
    );

    expect(result.html).toContain('class="katex"');
    expect(result.html).toContain('github-dark');
  });

  it('deduplicates shared images across protected sanctuary entries', async () => {
    const body = '![secret](./private-image.png)';
    const locked = fixtureSanctuary(body);
    const duplicate = fixtureSanctuary(body, { id: 'locked-duplicate' });
    const assets = await collectProtectedAssets(
      [locked, duplicate],
      keyBytes
    );

    expect(assets).toHaveLength(1);
    expect(relative(protectedRoot, assets[0].sourcePath)).toBe(join('nested', 'private-image.png'));
  });
});
