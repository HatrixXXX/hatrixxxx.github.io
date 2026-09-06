import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(process.cwd(), 'src/components/LoadingOverlay.astro');

describe('LoadingOverlay component', () => {
  it('defines the DOM hooks and the 15 by 15 hexagon grid', async () => {
    const source = await readFile(componentPath, 'utf8');

    expect(source).toContain('data-loading-overlay');
    expect(source).toContain('data-loading-grid');
    expect(source).toContain('data-loading-status');
    expect(source).toMatch(/Array\.from\(\{\s*length:\s*225\s*\}\s*,/);
    expect(source).toMatch(/15\s*[×x]\s*15|row\s*:\s*15|columns\s*=\s*15/);
  });

  it('uses native motion styles without GSAP and honors reduced motion', async () => {
    const source = await readFile(componentPath, 'utf8');

    expect(source).not.toMatch(/gsap/i);
    expect(source).toMatch(/prefers-reduced-motion\s*:\s*reduce/);
    expect(source).toContain('<svg');
    expect(source).toContain('role="status"');
  });
});
