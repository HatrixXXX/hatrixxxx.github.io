import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Astro project bootstrap', () => {
  it('keeps the production custom domain file', () => {
    expect(readFileSync('public/CNAME', 'utf8').trim()).toBe('hatrix.site');
  });

  it('defines a static build command', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.build).toBe('astro build');
  });
});
