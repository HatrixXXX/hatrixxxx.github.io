import { readFileSync } from 'node:fs';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import { isHttpsUrl } from '../../src/lib/safe-url';
import remarkContentSecurity from '../../src/plugins/remark-content-security';

const PINNED_IMAGE =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/example.png';

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

  it.each([
    '<a href="&#x6a;ava&Tab;script&colon;alert(1)">open</a>',
    '<img src="&#x2f;&#x2f;evil.example/tracker.png">',
    '<img srcset="https://evil.example/tracker.png 1x">'
  ])('rejects browser-normalized raw HTML through Astro markdown processing: %s', async (value) => {
    await expect(renderMarkdown(value)).rejects.toThrow(/unsafe URL|unapproved remote image|srcset/i);
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
