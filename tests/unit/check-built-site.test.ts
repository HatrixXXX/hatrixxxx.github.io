import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { inspectBuiltSite, inspectProjectBuiltSite } from '../../scripts/check-built-site';

async function writeSiteFile(root: string, relativePath: string, contents = ''): Promise<void> {
  const target = join(root, ...relativePath.split('/'));
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, contents);
}

it('reports missing routes and broken local links', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-site-'));
  await mkdir(join(root, 'posts', 'present'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<a href="/missing/">broken</a>');
  await writeFile(join(root, 'posts', 'present', 'index.html'), '<h1>present</h1>');

  const result = await inspectBuiltSite(root, ['/posts/present/', '/posts/absent/']);

  expect(result.errors).toEqual(expect.arrayContaining([
    expect.stringContaining('/missing/'),
    expect.stringContaining('/posts/absent/')
  ]));
});

it('accepts a complete site with encoded Unicode routes and local assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-site-'));
  const postRoute = '/posts/中文 文章/';

  await writeSiteFile(
    root,
    'index.html',
    '<a href="/posts/%E4%B8%AD%E6%96%87%20%E6%96%87%E7%AB%A0/">post</a><img src="/images/logo.svg"><a href="#jump">skip</a><a href="mailto:test@example.com">mail</a><a href="tel:+100">phone</a><img src="data:image/svg+xml,skip"><a href="https://example.com">external</a>'
  );
  await writeSiteFile(root, 'posts/中文 文章/index.html', '<a href="/">home</a>');
  await writeSiteFile(root, 'images/logo.svg', '<svg/>');
  await writeSiteFile(root, '404.html');
  await writeSiteFile(root, 'CNAME', 'hatrix.site\n');
  await writeSiteFile(root, 'rss.xml', '<rss/>');
  await writeSiteFile(root, 'sitemap-0.xml', '<urlset/>');
  await writeSiteFile(root, 'search-index.json', '[]');

  const result = await inspectBuiltSite(root, [postRoute]);

  expect(result.errors).toEqual([]);
});

it('aggregates missing post output errors without throwing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-project-'));
  await writeSiteFile(root, 'public/CNAME', 'hatrix.site\n');
  await writeSiteFile(root, 'src/content/posts/example.md', '---\nlegacySlug: absent\n---\n');
  await writeSiteFile(root, 'dist/index.html');
  await writeSiteFile(root, 'dist/404.html');
  await writeSiteFile(root, 'dist/CNAME', 'hatrix.site\n');
  await writeSiteFile(root, 'dist/rss.xml');
  await writeSiteFile(root, 'dist/search-index.json', '[]');
  await writeSiteFile(root, 'dist/sitemap-0.xml');

  await expect(inspectProjectBuiltSite(root)).resolves.toMatchObject({
    errors: expect.arrayContaining([
      expect.stringContaining('Missing generated posts directory'),
      expect.stringContaining('/posts/absent/')
    ])
  });
});
