import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Astro project bootstrap', () => {
  it('keeps the production custom domain file', () => {
    expect(readFileSync('public/CNAME', 'utf8').trim()).toBe('hatrix.site');
  });

  it('runs image preflight before the static build', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.build).toBe(
      'corepack pnpm check:images && cross-env NODE_USE_ENV_PROXY=1 astro build && corepack pnpm check:protected'
    );
  });
});
