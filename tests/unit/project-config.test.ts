import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import playwrightConfig from '../../playwright.config';

describe('Astro project tooling', () => {
  it('does not retain the removed commitlint hook', () => {
    expect(existsSync('.husky/commit-msg')).toBe(false);
  });

  it('limits TypeScript checking to the Astro project', () => {
    const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf8'));

    expect(tsconfig.include).toContain('src/**/*.astro');
    expect(tsconfig.exclude).toContain('assets');
    expect(tsconfig.exclude).toContain('_javascript');
  });

  it('starts the Playwright server through the project package manager', () => {
    expect(playwrightConfig.webServer).toMatchObject({
      command: 'corepack pnpm dev --host 127.0.0.1',
      env: { ASTRO_DEV_BACKGROUND: '0' }
    });
  });

  it('keeps the static-heavy Playwright suite on one worker', () => {
    expect(playwrightConfig.workers).toBe(1);
  });

  it('uses project-specific snapshots without platform suffixes', () => {
    expect(playwrightConfig.snapshotPathTemplate).toBe(
      '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}'
    );
    expect(playwrightConfig.snapshotPathTemplate).not.toContain('platform');
  });

  it('limits Pages write permissions to the deployment job', () => {
    const workflow = readFileSync('.github/workflows/pages-deploy.yml', 'utf8');
    const workflowPermissions = workflow.match(/^permissions:\r?\n((?:  .+\r?\n)+)/m)?.[1];
    const deployJob = workflow.slice(workflow.indexOf('\n  deploy:'));

    expect(workflowPermissions).toBe('  contents: read\n');
    expect(deployJob).toContain('    permissions:\n      pages: write\n      id-token: write\n');
  });
});
