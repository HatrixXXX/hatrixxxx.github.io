import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from '../../src/config/security';

describe('browser security policy', () => {
  it('uses the reviewed CSP directives', () => {
    expect(CONTENT_SECURITY_POLICY).toBe([
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://giscus.app",
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://cdn.jsdelivr.net",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' blob:",
      'frame-src https://giscus.app',
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "form-action 'self'"
    ].join('; '));
    expect(REFERRER_POLICY).toBe('strict-origin-when-cross-origin');
  });

  it('places the production CSP before the first script', () => {
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    const csp = layout.indexOf('http-equiv="Content-Security-Policy"');
    const firstScript = layout.indexOf('<script');

    expect(layout).toContain('import.meta.env.PROD');
    expect(csp).toBeGreaterThan(-1);
    expect(csp).toBeLessThan(firstScript);
    expect(layout).toContain('name="referrer" content={REFERRER_POLICY}');
  });
});
