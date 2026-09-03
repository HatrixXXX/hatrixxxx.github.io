import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isHttpsUrl } from '../../src/lib/safe-url';
import remarkContentSecurity from '../../src/plugins/remark-content-security';

const PINNED_IMAGE =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/example.png';

function transform(children: Array<Record<string, unknown>>) {
  return () => remarkContentSecurity()({ type: 'root', children }, { path: 'post.md' });
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

  it('rejects remote images outside the immutable prefix', () => {
    expect(transform([{ type: 'image', url: 'https://example.com/tracker.png' }])).toThrow(
      /unapproved remote image/i
    );
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
