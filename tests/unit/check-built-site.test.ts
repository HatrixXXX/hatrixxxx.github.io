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

it('rejects SVG scripts and external SVG resources while preserving local fragments and pinned images', () => {
  const pinnedImage =
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/a.png';
  const safeHtml = `<html>${secureHead}<body><svg><use href="#symbol"></use><image href="/images/local.svg"></image><feImage href="${pinnedImage}"></feImage></svg></body></html>`;
  const unsafeHtml = `<html>${secureHead}<body><svg xmlns:xlink="http://www.w3.org/1999/xlink"><script>alert(1)</script><script xlink:href="https://evil.example/script.js"></script><image href="https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/mutable.png"></image><feImage xlink:href="//evil.example/filter.png"></feImage><use href="https://evil.example/sprite.svg#icon"></use></svg></body></html>`;

  expect(securityErrorsForHtml(safeHtml, '/svg/')).toEqual([]);
  expect(securityErrorsForHtml(unsafeHtml, '/svg/')).toEqual(expect.arrayContaining([
    expect.stringContaining('SVG <script>'),
    expect.stringContaining('xlink:href='),
    expect.stringContaining('unapproved remote image'),
    expect.stringContaining('external SVG reference')
  ]));
});

it('validates standard image resource carriers', () => {
  const pinnedImage =
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/a.png';
  const safeHtml = `<html>${secureHead}<body><link rel="icon" href="/favicon.svg"><video poster="${pinnedImage}"></video><input type="image" src="/images/submit.png"><table background="${pinnedImage}"></table></body></html>`;
  const unsafeHtml = `<html>${secureHead}<body><link rel="shortcut icon" href="https://evil.example/favicon.ico"><video poster="https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/mutable.png"></video><input type="image" src="//evil.example/submit.png"><table background="https://evil.example/background.png"></table></body></html>`;

  expect(securityErrorsForHtml(safeHtml, '/carriers/')).toEqual([]);
  expect(securityErrorsForHtml(unsafeHtml, '/carriers/')).toEqual(expect.arrayContaining([
    expect.stringContaining('poster='),
    expect.stringContaining('background='),
    expect.stringContaining('src='),
    expect.stringContaining('href='),
    expect.stringContaining('unapproved remote image')
  ]));
});

it('rejects iframe srcdoc without relaxing the frame allowlist', () => {
  const html = `<html>${secureHead}<body><iframe src="https://giscus.app" srcdoc="<p>embedded</p>"></iframe></body></html>`;

  expect(securityErrorsForHtml(html, '/frames/')).toEqual(expect.arrayContaining([
    expect.stringContaining('iframe srcdoc'),
    expect.stringContaining('srcdoc=')
  ]));
});

it('enforces explicit remote CSS resources in attributes and style elements', () => {
  const pinnedImage =
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/a.png';
  const safeHtml = `<html>${secureHead}<body><style>.hero { background-image: url(${pinnedImage}); }</style><div style="background-image: url('/images/local.png')"></div></body></html>`;
  const unsafeHtml = `<html>${secureHead}<body><div style="background-image: url(//evil.example/inline.png)"></div><style>@import "https://evil.example/theme.css"; .hero { background-image: url(https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/mutable.png); }</style></body></html>`;

  expect(securityErrorsForHtml(safeHtml, '/styles/')).toEqual([]);
  expect(securityErrorsForHtml(unsafeHtml, '/styles/')).toEqual(expect.arrayContaining([
    expect.stringContaining('unapproved CSS resource'),
    expect.stringContaining('style='),
    expect.stringContaining('text=')
  ]));
});

it('parses escaped CSS resource functions and image sets without rejecting safe declarations', () => {
  const pinnedImage =
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/a.png';
  const safeHtml = `<html>${secureHead}<body><style>.shiki { color: #fff; } .katex { font: normal 1em KaTeX_Main; } .hero { --hero-image: url(${pinnedImage}); } .local { background: url(/images/local.png); } .raster { background: url(data:image/png;base64,AA==); }</style></body></html>`;
  const unsafeHtml = String.raw`<html>${secureHead}<body><div style='background: u\72l("https\3A //cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@main/img/mutable.png")'></div><style>.escaped { background: url("https\3A //evil.example/escaped.png"); } .set { background: image-set("https://evil.example/set.png" 1x, "https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@main/img/set.png" 2x); }</style></body></html>`;

  expect(securityErrorsForHtml(safeHtml, '/css/')).toEqual([]);
  expect(securityErrorsForHtml(unsafeHtml, '/css/')).toEqual(expect.arrayContaining([
    expect.stringContaining('unapproved CSS resource'),
    expect.stringContaining('style='),
    expect.stringContaining('text=')
  ]));
});

it('validates image and executable link resource relations', () => {
  const pinnedImage =
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/a.png';
  const safeHtml = `<html>${secureHead}<body><link rel="manifest" href="/site.webmanifest"><link rel="stylesheet" href="/_astro/site.css"><link rel="modulepreload" href="/_astro/app.js"><link rel="preload" as="font" href="data:font/woff2;base64,AA=="><link rel="preload" as="image" href="${pinnedImage}"><link rel="apple-touch-icon" href="/touch.png"><link rel="mask-icon" href="${pinnedImage}"></body></html>`;
  const unsafeHtml = `<html>${secureHead}<body><link rel="preload" as="image" href="https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@main/img/mutable.png"><link rel="icon" href="https://evil.example/icon.png"><link rel="apple-touch-icon" href="https://evil.example/touch.png"><link rel="mask-icon" href="https://evil.example/mask.svg"><link rel="stylesheet" href="https://evil.example/site.css"><link rel="modulepreload" href="https://evil.example/app.js"><link rel="preload" as="script" href="https://evil.example/app.js"><link rel="preload" as="font" href="https://evil.example/font.woff2"></body></html>`;

  expect(securityErrorsForHtml(safeHtml, '/links/')).toEqual([]);
  expect(securityErrorsForHtml(unsafeHtml, '/links/')).toEqual(expect.arrayContaining([
    expect.stringContaining('unapproved remote image'),
    expect.stringContaining('unapproved external link resource'),
    expect.stringContaining('href=')
  ]));
});

it('validates image preload imagesrcset candidates independently of a local href', () => {
  const pinnedImage =
    'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/a.png';
  const safeHtml = `<html>${secureHead}<body><link rel="preload" as="image" href="/images/hero.png" imagesrcset="/images/hero.png 320w, ${pinnedImage} 640w"></body></html>`;
  const unsafeHtml = `<html>${secureHead}<body><link rel="preload" as="image" href="/images/hero.png" imagesrcset="//evil.example/hero.png 320w, https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@main/img/mutable.png 640w"></body></html>`;

  expect(securityErrorsForHtml(safeHtml, '/preloads/')).toEqual([]);
  expect(securityErrorsForHtml(unsafeHtml, '/preloads/')).toEqual(expect.arrayContaining([
    expect.stringContaining('unapproved remote image'),
    expect.stringContaining('imagesrcset=')
  ]));
});

it('rejects remote candidates following a data URL in image srcsets', () => {
  const html = `<html>${secureHead}<body><img srcset="data:image/png;base64,AAAA, https://evil.example/after-data.png 2x"><picture><source srcset="data:image/png;base64,BBBB, https://evil.example/source-after-data.png 2x"></picture><link rel="preload" as="image" href="/images/hero.png" imagesrcset="data:image/png;base64,CCCC, https://evil.example/preload-after-data.png 2x"></body></html>`;

  expect(securityErrorsForHtml(html, '/srcset-data/')).toEqual(expect.arrayContaining([
    expect.stringContaining('unapproved remote image'),
    expect.stringContaining('srcset='),
    expect.stringContaining('imagesrcset=')
  ]));
});

it('applies executable URL and dangerous data checks to preload imagesrcset candidates', () => {
  const html = `<html>${secureHead}<body><link rel="preload" as="image" href="/images/hero.png" imagesrcset="javascript:alert(1) 1x, data:image/svg+xml,%3Csvg%3E 2x"></body></html>`;

  expect(securityErrorsForHtml(html, '/preload-schemes/')).toEqual(expect.arrayContaining([
    expect.stringContaining('unsafe URL scheme'),
    expect.stringContaining('dangerous data document'),
    expect.stringContaining('imagesrcset=')
  ]));
});

it('returns a bounded diagnostic for malformed strict srcset values', () => {
  const html = `<html>${secureHead}<body><img srcset="/images/a.png 1x 2x"></body></html>`;

  expect(securityErrorsForHtml(html, '/srcset-error/')).toEqual(expect.arrayContaining([
    expect.stringContaining('Unable to parse srcset'),
    expect.stringContaining('srcset='),
    expect.stringContaining('/srcset-error/')
  ]));
});

it('returns a bounded diagnostic when css-tree rejects generated CSS', () => {
  const html = `<html>${secureHead}<body><div style="a{]"></div></body></html>`;

  expect(() => securityErrorsForHtml(html, '/css-error/')).not.toThrow();
  expect(securityErrorsForHtml(html, '/css-error/')).toEqual(expect.arrayContaining([
    expect.stringContaining('Unable to parse CSS resource'),
    expect.stringContaining('/css-error/'),
    expect.stringContaining('style=')
  ]));
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
