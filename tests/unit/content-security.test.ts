import { readFileSync } from 'node:fs';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import { isHttpsUrl } from '../../src/lib/safe-url';
import remarkContentSecurity from '../../src/plugins/remark-content-security';

const PINNED_IMAGE =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/example.png';
const BACKSLASH_REMOTE_IMAGE = String.raw`https:\\evil.example\\tracker.png`;
const RELATIVE_BACKSLASH_REMOTE_IMAGE = String.raw`\\evil.example\tracker.png`;
const ROOTED_BACKSLASH_REMOTE_IMAGE = String.raw`/\\evil.example\tracker.png`;
const EXECUTABLE_DATA_URLS = [
  'data: text/html,<script>alert(1)</script>',
  'data:text/html ;charset=utf-8,<script>alert(1)</script>',
  'data: \tapplication/xhtml+xml ;charset=utf-8,<script>alert(1)</script>',
  'data: image/svg+xml ;charset=utf-8,<svg></svg>'
];
const UNSAFE_STYLE_VALUES = [
  'background-image:url(https://evil.example/tracker.png)',
  'background:image-set(url(https://evil.example/tracker.png) 1x)',
  'background:-webkit-image-set(url(https://evil.example/tracker.png) 1x)',
  '@import "https://evil.example/style.css"',
  'width:expression(alert(1))',
  'behavior:url(#default#time2)',
  '-moz-binding:url(https://evil.example/binding.xml#x)',
  String.raw`background:u\72l(https://evil.example/tracker.png)`,
  String.raw`background:\69mage-set("https://evil.example/tracker.png" 1x)`,
  String.raw`@\69mport "https://evil.example/style.css"`,
  String.raw`width:\65xpression(alert(1))`,
  'color:red'
];
const SAFE_STYLE_VALUES = ['zoom:50%;', 'zoom: 67%', 'zoom:300%;'];
const FORBIDDEN_NOSCRIPT_HTML = [
  '<noscript><style>@import "https://evil.example/x.css"</style></noscript>',
  '<noscript><meta http-equiv="refresh" content="0;url=https://evil.example/"></noscript>',
  '<noscript><link rel="stylesheet" href="https://evil.example/x.css"></noscript>',
  '<noscript><iframe src="https://evil.example/"></iframe></noscript>',
  '<noscript><img src="https://evil.example/tracker.png"></noscript>'
];

function transform(children: Array<Record<string, unknown>>) {
  return () => remarkContentSecurity()({ type: 'root', children }, { path: 'post.md' });
}

async function renderMarkdown(value: string) {
  const processor = await createMarkdownProcessor({ remarkPlugins: [remarkContentSecurity] });
  return processor.render(value, { fileURL: new URL('file:///E:/post.md') });
}

describe('published content security', () => {
  it.each([
    '<script src="https://evil.example/payload.js"></script>',
    '<img src="x" onerror="alert(1)">',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<svg><script>alert(1)</script></svg>',
    '<a href="javascript:alert(1)">open</a>',
    '<style>@import "https://evil.example/x.css"</style>'
  ])('rejects dangerous raw HTML: %s', (value) => {
    expect(transform([{ type: 'html', value }])).toThrow(/post\.md/);
  });

  it('rejects dangerous Markdown destinations', () => {
    expect(transform([{ type: 'link', url: 'javascript:alert(1)' }])).toThrow(/unsafe URL/i);
  });

  it.each([
    '<a href="&#x6a;avascript:alert(1)">open</a>',
    '<a href="java\tscript:alert(1)">open</a>',
    '<a href="java\nscript:alert(1)">open</a>',
    '<a href="java&Tab;script&colon;alert(1)">open</a>'
  ])('rejects browser-normalized executable raw HTML URLs: %s', (value) => {
    expect(transform([{ type: 'html', value }])).toThrow(/unsafe URL/i);
  });

  it.each([
    '<a href="java&#9;script:alert(1)">open</a>',
    '<a href="java&Tab;script:alert(1)">open</a>',
    '<a href="java&NewLine;script:alert(1)">open</a>',
    '<a href="data: text/html ; charset=utf-8,<script>alert(1)</script>">open</a>',
    '<a href="data: application/xhtml+xml;charset=utf-8,<html></html>">open</a>',
    '<a href="data: image/svg+xml ; charset=utf-8,<svg></svg>">open</a>'
  ])('rejects decoded executable URLs with whitespace or MIME parameters: %s', (value) => {
    expect(transform([{ type: 'html', value }])).toThrow(/unsafe URL/i);
  });

  it.each(FORBIDDEN_NOSCRIPT_HTML)('rejects forbidden content hidden in noscript: %s', (value) => {
    expect(transform([{ type: 'html', value }])).toThrow(
      /forbidden raw HTML tag|unapproved remote image/i
    );
  });

  it('accepts text-only noscript fallback content', () => {
    expect(transform([{ type: 'html', value: '<noscript>评论需要 JavaScript。</noscript>' }])).not.toThrow();
  });

  it('rejects remote images outside the immutable prefix', () => {
    expect(transform([{ type: 'image', url: 'https://example.com/tracker.png' }])).toThrow(
      /unapproved remote image/i
    );
  });

  it.each([
    '//evil.example/tracker.png',
    ' \thttps://evil.example/tracker.png'
  ])('rejects normalized remote Markdown image URLs: %s', (url) => {
    expect(transform([{ type: 'image', url }])).toThrow(/unapproved remote image/i);
  });

  it.each([
    '<img src="//evil.example/tracker.png">',
    '<img src=" \thttps://evil.example/tracker.png">',
    '<img src="https&#58;//evil.example/tracker.png">'
  ])('rejects browser-normalized raw HTML image URLs: %s', (value) => {
    expect(transform([{ type: 'html', value }])).toThrow(/unapproved remote image/i);
  });

  it('rejects raw HTML image srcset candidates', () => {
    expect(
      transform([{ type: 'html', value: '<img srcset="https://evil.example/tracker.png 1x">' }])
    ).toThrow(/srcset/i);
  });

  it('rejects raw HTML images using WHATWG backslash normalization', () => {
    expect(
      transform([{ type: 'html', value: `<img src="${BACKSLASH_REMOTE_IMAGE}">` }])
    ).toThrow(/unapproved remote image/i);
  });

  it('rejects Markdown image URLs using WHATWG backslash normalization', () => {
    expect(transform([{ type: 'image', url: BACKSLASH_REMOTE_IMAGE }])).toThrow(
      /unapproved remote image/i
    );
  });

  it.each([RELATIVE_BACKSLASH_REMOTE_IMAGE, ROOTED_BACKSLASH_REMOTE_IMAGE])(
    'rejects raw HTML images resolved remotely from an HTTPS page base: %s',
    (url) => {
      expect(transform([{ type: 'html', value: `<img src="${url}">` }])).toThrow(
        /unapproved remote image/i
      );
    }
  );

  it.each([RELATIVE_BACKSLASH_REMOTE_IMAGE, ROOTED_BACKSLASH_REMOTE_IMAGE])(
    'rejects Markdown image URLs resolved remotely from an HTTPS page base: %s',
    (url) => {
      expect(transform([{ type: 'image', url }])).toThrow(/unapproved remote image/i);
    }
  );

  it.each([
    '<img src="&bsol;&bsol;evil.example&bsol;tracker.png">',
    '<img src="&sol;&bsol;evil.example&bsol;tracker.png">',
    '<img src="https&colon;&bsol;&bsol;evil.example&bsol;tracker.png">'
  ])('rejects raw HTML image separators constructed with named references: %s', (value) => {
    expect(transform([{ type: 'html', value }])).toThrow(/unapproved remote image/i);
  });

  it.each(EXECUTABLE_DATA_URLS)('rejects executable data URLs in raw HTML: %s', (url) => {
    expect(transform([{ type: 'html', value: `<a href="${url}">open</a>` }])).toThrow(/unsafe URL/i);
  });

  it.each(EXECUTABLE_DATA_URLS)('rejects executable data URLs in Markdown AST: %s', (url) => {
    expect(transform([{ type: 'link', url }])).toThrow(/unsafe URL/i);
  });

  it.each([
    '<video poster="https://evil.example/tracker.png"></video>',
    '<div background="https://evil.example/tracker.png"></div>'
  ])('rejects remote image-fetch attributes outside img/src: %s', (value) => {
    expect(transform([{ type: 'html', value }])).toThrow(/unapproved remote image/i);
  });

  it.each(UNSAFE_STYLE_VALUES)('rejects unsafe or non-zoom inline CSS: %s', (style) => {
    expect(transform([{ type: 'html', value: `<div style="${style}"></div>` }])).toThrow(
      /unsafe inline style/i
    );
  });

  it.each(SAFE_STYLE_VALUES)('accepts existing zoom formatting: %s', (style) => {
    expect(transform([{ type: 'html', value: `<div style="${style}"></div>` }])).not.toThrow();
  });

  it.each([
    '<a href="&#x6a;ava&Tab;script&colon;alert(1)">open</a>',
    '<img src="&#x2f;&#x2f;evil.example/tracker.png">',
    '<img srcset="https://evil.example/tracker.png 1x">',
    '<picture><source srcset="https://evil.example/tracker.png 1x"><img src="/local.png"></picture>',
    `<img src="${BACKSLASH_REMOTE_IMAGE}">`,
    `<img src="${RELATIVE_BACKSLASH_REMOTE_IMAGE}">`,
    `<img src="${ROOTED_BACKSLASH_REMOTE_IMAGE}">`,
    '<img src="&bsol;&bsol;evil.example&bsol;tracker.png">',
    '<img src="&sol;&bsol;evil.example&bsol;tracker.png">',
    '<img src="https&colon;&bsol;&bsol;evil.example&bsol;tracker.png">',
    '<a href="data: text/html,<script>alert(1)</script>">open</a>',
    '<a href="data:text/html ;charset=utf-8,<script>alert(1)</script>">open</a>',
    '<a href="data: image/svg+xml ;charset=utf-8,<svg></svg>">open</a>',
    '<video poster="https://evil.example/tracker.png"></video>',
    '<div background="https://evil.example/tracker.png"></div>',
    '<div style="background-image:url(https://evil.example/tracker.png)"></div>',
    `<div style="${String.raw`background:u\72l(https://evil.example/tracker.png)`}"></div>`,
    '<div style="color:red"></div>'
  ])('rejects browser-normalized raw HTML through Astro markdown processing: %s', async (value) => {
    await expect(renderMarkdown(value)).rejects.toThrow(
      /unsafe URL|unapproved remote image|unsafe inline style|srcset|forbidden raw HTML tag/i
    );
  });

  it.each(SAFE_STYLE_VALUES)('accepts existing zoom formatting through Astro markdown: %s', async (style) => {
    await expect(renderMarkdown(`<div style="${style}"></div>`)).resolves.toBeDefined();
  });

  it.each(FORBIDDEN_NOSCRIPT_HTML)(
    'rejects forbidden noscript content through Astro markdown processing: %s',
    async (value) => {
      await expect(renderMarkdown(value)).rejects.toThrow(
        /forbidden raw HTML tag|unapproved remote image/i
      );
    }
  );

  it('accepts text-only noscript fallback content through Astro markdown processing', async () => {
    await expect(renderMarkdown('<noscript>评论需要 JavaScript。</noscript>')).resolves.toBeDefined();
  });

  it('accepts code examples and pinned images', () => {
    expect(transform([
      { type: 'code', value: '<script>alert(1)</script>' },
      { type: 'image', url: PINNED_IMAGE },
      { type: 'html', value: `<img src="${PINNED_IMAGE}" alt="diagram">` }
    ])).not.toThrow();
  });
});

describe('safe URL contracts', () => {
  it('allows HTTPS and rejects executable or cleartext project links', () => {
    expect(isHttpsUrl('https://example.com/demo')).toBe(true);
    expect(isHttpsUrl('http://example.com/demo')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
  });

  it('pins Mermaid to strict security mode', () => {
    expect(readFileSync('src/scripts/mermaid.ts', 'utf8')).toContain("securityLevel: 'strict'");
  });
});
