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
    expect(source).toContain('>LOADING</span>');
    expect(source).toMatch(/Array\.from\(\{\s*length:\s*15\s*\}/);
    expect(source).toMatch(/Array\.from\(\{\s*length:\s*15\s*\}/);
    expect(source).toContain('viewBox="0 0 1000 1000"');
    expect(source).toContain('points="0,-50 43.3,-25 43.3,25 0,50 -43.3,25 -43.3,-25"');
    expect(source).toContain('fill="#171717"');
    expect(source).toContain('stroke: #17f700');
    expect(source).toMatch(/line\s*%\s*2\s*\?\s*86\.5\s*\*\s*row\s*:\s*86\.5\s*\*\s*row\s*\+\s*43\.3/);
    expect(source).toMatch(/y=\{74\.5\s*\*\s*line\}/);
  });

  it('uses native motion styles without GSAP and honors reduced motion', async () => {
    const source = await readFile(componentPath, 'utf8');

    expect(source).not.toMatch(/gsap/i);
    expect(source).toMatch(/prefers-reduced-motion\s*:\s*reduce/);
    expect(source).toContain('<svg');
    expect(source).toContain('role="status"');
    expect(source).toContain('loading-cell-out');
    expect(source).toContain('stroke-dashoffset: 0');
    expect(source).toContain('transition:persist="loading-overlay"');
  });
});
