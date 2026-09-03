import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from '../../src/config/security';
import {
  inspectBuiltSite,
  inspectProjectBuiltSite,
  securityErrorsForHtml
} from '../../scripts/check-built-site';

const secureHead = `<head><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}"><meta name="referrer" content="${REFERRER_POLICY}"></head>`;

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
    `<html>${secureHead}<body><a href="/posts/%E4%B8%AD%E6%96%87%20%E6%96%87%E7%AB%A0/">post</a><img src="/images/logo.svg"><a href="#jump">skip</a><a href="mailto:test@example.com">mail</a><a href="tel:+100">phone</a><img src="data:image/png,skip"><a href="https://example.com">external</a></body></html>`
  );
  await writeSiteFile(root, 'posts/中文 文章/index.html', `<html>${secureHead}<body><a href="/">home</a></body></html>`);
  await writeSiteFile(root, 'images/logo.svg', '<svg/>');
  await writeSiteFile(root, '404.html', `<html>${secureHead}</html>`);
  await writeSiteFile(root, 'CNAME', 'hatrix.site\n');
  await writeSiteFile(root, 'rss.xml', '<rss/>');
  await writeSiteFile(root, 'sitemap-0.xml', '<urlset/>');
  await writeSiteFile(root, 'search-index.json', '[]');
  await writeSiteFile(root, 'third-party-notices.txt', 'Sakana notice');

  const result = await inspectBuiltSite(root, [postRoute]);

  expect(result.errors).toEqual([]);
});

it('accepts the reviewed metadata and safe external resources', () => {
  const html = `<html>${secureHead}<body><img src="https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/a.png"><a href="https://example.com" target="_blank" rel="noreferrer">external</a><script src="https://giscus.app/client.js"></script></body></html>`;

  expect(securityErrorsForHtml(html, '/safe/')).toEqual([]);
});

it('reports missing or late metadata and unsafe HTML attributes', () => {
  const html = `<html><head><script src="/early.js"></script>${secureHead}</head><body><a href="javascript:alert(1)" target="_blank">bad</a><img src="https://evil.example/tracker.png" onerror="alert(1)"></body></html>`;

  expect(securityErrorsForHtml(html, '/unsafe/')).toEqual(expect.arrayContaining([
    expect.stringContaining('CSP must appear before every script'),
    expect.stringContaining('unsafe URL scheme'),
    expect.stringContaining('inline event attribute'),
    expect.stringContaining('missing noopener protection'),
    expect.stringContaining('unapproved remote image')
  ]));
});

it.each([
  ['template', `<template>${secureHead}<script src="/template.js"></script></template>`],
  ['body', secureHead],
  ['foreign content', `<svg>${secureHead}</svg>`]
])('rejects policy metadata placed in %s', (_placement, metadata) => {
  const html = `<html><head></head><body>${metadata}</body></html>`;
  const errors = securityErrorsForHtml(html, '/metadata/');

  expect(errors).toEqual(expect.arrayContaining([
    expect.stringContaining('Invalid Content Security Policy'),
    expect.stringContaining('Invalid Referrer Policy')
  ]));
  expect(errors).not.toEqual(expect.arrayContaining([
    expect.stringContaining('CSP must appear before every script')
  ]));
});

it('accepts local and pinned image srcsets while rejecting normalized remote image sources', () => {
  const pinnedImage =
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/a.png';
  const safeHtml = `<html>${secureHead}<body><picture><source srcset="/_astro/a.webp 320w, ${pinnedImage} 640w"><img src="/_astro/a.webp" srcset="/_astro/a.webp 320w, ${pinnedImage} 640w"></picture></body></html>`;
  const unsafeHtml = String.raw`<html>${secureHead}<body><img src="\\evil.example\\tracker.png" srcset="//evil.example/one.png 1x, https:\\evil.example\\two.png 2x"><picture><source srcset="//evil.example/three.png 1x"></picture></body></html>`;

  expect(securityErrorsForHtml(safeHtml, '/images/')).toEqual([]);
  expect(securityErrorsForHtml(unsafeHtml, '/images/')).toEqual(expect.arrayContaining([
    expect.stringContaining('unapproved remote image'),
    expect.stringContaining('src='),
    expect.stringContaining('srcset=')
  ]));
});

it('rejects executable carriers and applicable executable URL attributes', () => {
  const html = `<html>${secureHead}<body><meta http-equiv="refresh" content="0;url=https://evil.example/"><object data="javascript:alert(1)"></object><embed src="https://evil.example/plugin"><iframe src="vbscript:msgbox(1)"></iframe></body></html>`;

  expect(securityErrorsForHtml(html, '/carriers/')).toEqual(expect.arrayContaining([
    expect.stringContaining('meta refresh'),
    expect.stringContaining('<object'),
    expect.stringContaining('<embed'),
    expect.stringContaining('unsafe URL scheme'),
    expect.stringContaining('data='),
    expect.stringContaining('src=')
  ]));
});

it('bounds diagnostic attribute values while retaining the route and attribute name', () => {
  const longRemoteImage = `https://evil.example/${'x'.repeat(300)}`;
  const html = `<html>${secureHead}<body><img src="${longRemoteImage}" onerror="alert(1)"></body></html>`;
  const errors = securityErrorsForHtml(html, '/diagnostics/');

  expect(errors).toEqual(expect.arrayContaining([
    expect.stringContaining('/diagnostics/'),
    expect.stringContaining('onerror='),
    expect.stringContaining('src='),
    expect.stringContaining('evil.example')
  ]));
  expect(errors.join('\n')).not.toContain('x'.repeat(200));
});

it('requires the third-party notice in built output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-site-'));
  await writeSiteFile(root, 'index.html');
  await writeSiteFile(root, '404.html');
  await writeSiteFile(root, 'CNAME', 'hatrix.site\n');
  await writeSiteFile(root, 'rss.xml', '<rss/>');
  await writeSiteFile(root, 'sitemap-0.xml', '<urlset/>');
  await writeSiteFile(root, 'search-index.json', '[]');

  const result = await inspectBuiltSite(root, []);

  expect(result.errors).toContain('Missing required output: /third-party-notices.txt');
});

it('reports when the local link inventory is one below the expected count', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-site-'));

  await writeSiteFile(root, 'index.html', '<a href="/404.html">not found</a>');
  await writeSiteFile(root, '404.html');
  await writeSiteFile(root, 'CNAME', 'hatrix.site\n');
  await writeSiteFile(root, 'rss.xml', '<rss/>');
  await writeSiteFile(root, 'sitemap-0.xml', '<urlset/>');
  await writeSiteFile(root, 'search-index.json', '[]');

  const result = await inspectBuiltSite(root, [], { expectedLocalLinks: 2 });

  expect(result.checkedLinks).toBe(1);
  expect(result.errors).toContain('Expected 2 local links, found 1.');
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
