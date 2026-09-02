import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import astroConfig from '../../astro.config';
import playwrightConfig from '../../playwright.config';

const PINNED_IMAGE_PATH =
  '/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/**';

describe('Astro project tooling', () => {
  it('enables Node environment proxy support for image checks and the entire build', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.scripts['check:images']).toBe(
      'cross-env NODE_USE_ENV_PROXY=1 tsx scripts/check-images.ts'
    );
    expect(packageJson.scripts.build).toBe(
      'cross-env-shell NODE_USE_ENV_PROXY=1 "tsx scripts/check-images.ts && astro build"'
    );
  });

  it('does not retain the removed commitlint hook', () => {
    expect(existsSync('.husky/commit-msg')).toBe(false);
  });

  it('documents the Sakana license and noncommercial illustration restriction', () => {
    const path = 'public/third-party-notices.txt';
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;

    const notice = readFileSync(path, 'utf8');
    expect(notice).toContain('Sakana 1.0.8');
    expect(notice).toContain('MIT License');
    expect(notice).toContain('Copyright (c) 2022 卜卜口');
    expect(notice).toContain('package.json declares "license": "ISC"');
    expect(notice).toContain('non-commercial webpages only');
    expect(notice).toContain('大伏アオ');
  });

  it('keeps only the active GitHub automation files', () => {
    expect(readdirSync('.github').sort()).toEqual(['dependabot.yml', 'workflows']);
    expect(readdirSync('.github/workflows').sort()).toEqual(['pages-deploy.yml']);
  });

  it('limits TypeScript checking to the Astro project', () => {
    const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf8'));

    expect(tsconfig.include).toContain('src/**/*.astro');
    expect(tsconfig.include).toContain('src/**/*.ts');
    expect(tsconfig.include).toContain('tests/**/*.ts');
    expect(tsconfig.include).toContain('scripts/**/*.ts');
  });

  it('allows only the pinned image repository path', () => {
    expect(astroConfig.image?.remotePatterns).toEqual([
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname: PINNED_IMAGE_PATH
      }
    ]);
  });

  it('does not retain legacy toolchain ignore entries', () => {
    const entries = readFileSync('.gitignore', 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    expect(entries).not.toEqual(expect.arrayContaining([
      '.bundle',
      'vendor',
      'Gemfile.lock',
      '.jekyll-cache',
      '.jekyll-metadata',
      '_site',
      '*.gem',
      '_sass/vendors'
    ]));
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

  it('ships an opaque Giscus dark theme matching the site canvas', () => {
    const theme = readFileSync('src/styles/giscus-dark.css', 'utf8');

    expect(theme).toContain('background: #161a20;');
    expect(theme).toContain('--color-canvas-default: #161a20;');
    expect(theme).not.toContain('@import');
  });

  it('limits Pages write permissions to the deployment job', () => {
    const workflow = readFileSync('.github/workflows/pages-deploy.yml', 'utf8').replaceAll('\r\n', '\n');
    const workflowPermissions = workflow.match(/^permissions:\n((?:  .+\n)+)/m)?.[1];
    const deployJob = workflow.slice(workflow.indexOf('\n  deploy:'));

    expect(workflowPermissions).toBe('  contents: read\n');
    expect(deployJob).toContain('    permissions:\n      pages: write\n      id-token: write\n');
  });
});
