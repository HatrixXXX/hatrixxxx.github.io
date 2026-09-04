import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import astroConfig from '../../astro.config';
import playwrightConfig from '../../playwright.config';

const PINNED_IMAGE_PATH =
  '/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/**';

function workflowJob(workflow: string, name: string): string {
  const start = workflow.indexOf(`\n  ${name}:`);
  expect(start, `workflow job ${name}`).toBeGreaterThanOrEqual(0);
  const remainder = workflow.slice(start + 1);
  const next = remainder.slice(1).search(/\n  [a-z][a-z0-9-]*:\n/);
  return next === -1 ? remainder : remainder.slice(0, next + 1);
}

function workflowStep(job: string, name: string): string {
  const start = job.indexOf(`\n      - name: ${name}\n`);
  expect(start, `workflow step ${name}`).toBeGreaterThanOrEqual(0);
  const remainder = job.slice(start + 1);
  const next = remainder.slice(1).search(/\n      - name: /);
  return next === -1 ? remainder : remainder.slice(0, next + 1);
}

describe('Astro project tooling', () => {
  it('enables Node environment proxy support for image checks and the entire build', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.scripts['check:images']).toBe(
      'cross-env NODE_USE_ENV_PROXY=1 tsx scripts/check-images.ts'
    );
    expect(packageJson.scripts.build).toBe(
      'cross-env-shell NODE_USE_ENV_PROXY=1 "tsx scripts/check-images.ts && astro build && tsx scripts/check-protected-output.ts"'
    );
    expect(packageJson.scripts['check:protected']).toBe('tsx scripts/check-protected-output.ts');
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

  it('keeps private content ignored and article sources out of the public tree', () => {
    const entries = readFileSync('.gitignore', 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim());
    const publicSources = existsSync('src/content/posts')
      ? readdirSync('src/content/posts').filter((file) => /\.mdx?$/.test(file))
      : [];

    expect(entries).toContain('.private-content/');
    expect(publicSources).toEqual([]);
    expect(readdirSync('tests/fixtures/private-content/posts').sort()).toEqual([
      'locked.md',
      'public.md'
    ]);
  });

  it('keeps the local administrator key file out of the public repository', () => {
    const entries = readFileSync('.gitignore', 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim());

    expect(entries).toContain('.env.local');
  });

  it('documents the private repository as the only published article authoring location', () => {
    const readme = readFileSync('README.md', 'utf8');
    const agents = readFileSync('AGENTS.md', 'utf8');

    expect(readme).toContain('`.private-content/posts/`：已发布文章');
    expect(readme).toContain('`.private-content/` 是独立的私有 Git 仓库');
    expect(readme).toContain('公开仓库不跟踪任何已发布文章的 Markdown');
    expect(readme).toContain('在 `.private-content/posts/` 新建 Markdown 或 MDX 文件');
    expect(readme).not.toContain('`src/content/posts/`：已发布文章');
    expect(readme).not.toContain('在 `src/content/posts/` 新建');

    expect(agents).toContain('`.private-content/posts/`：40 篇已发布文章');
    expect(agents).toContain('`.private-content/` 是独立的私有 Git 仓库');
    expect(agents).toContain('公开仓库不跟踪文章 Markdown');
    expect(agents).not.toContain('`src/content/posts/`：40 篇已发布文章');
  });

  it('documents Astro build state as secret-bearing and never safe to persist', () => {
    const readme = readFileSync('README.md', 'utf8');
    const agents = readFileSync('AGENTS.md', 'utf8');

    expect(readme).toContain('生产构建生成的 `.astro/` 是带密构建状态');
    expect(readme).toContain('不得缓存、上传或提交');
    expect(agents).toContain('生产构建生成的 `.astro/` 是带密构建状态');
    expect(agents).toContain('不得缓存、上传或提交');
  });

  it('documents that browser credential managers remain outside application control', () => {
    const readme = readFileSync('README.md', 'utf8');

    expect(readme).toContain('浏览器或扩展是否保存、自动填写 key 不受站点控制');
  });

  it('starts the Playwright server through the project package manager', () => {
    expect(playwrightConfig.webServer).toMatchObject({
      command: 'corepack pnpm dev --host 127.0.0.1 --port 4322',
      env: { ASTRO_DEV_BACKGROUND: '0' }
    });
  });

  it('allows concurrent worktrees to select another Playwright port', async () => {
    vi.stubEnv('PLAYWRIGHT_PORT', '4323');
    vi.resetModules();
    try {
      const overriddenConfig = (await import('../../playwright.config')).default;
      expect(overriddenConfig.use?.baseURL).toBe('http://127.0.0.1:4323');
      expect(overriddenConfig.webServer).toMatchObject({
        command: 'corepack pnpm dev --host 127.0.0.1 --port 4323',
        url: 'http://127.0.0.1:4323'
      });
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
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

  it('isolates pull request validation from production content and secrets', () => {
    const workflow = readFileSync('.github/workflows/pages-deploy.yml', 'utf8').replaceAll('\r\n', '\n');
    const pullRequestJob = workflowJob(workflow, 'validate-pr');

    expect(workflow).toContain('  pull_request:');
    expect(pullRequestJob).toContain("if: github.event_name == 'pull_request'");
    expect(pullRequestJob).toContain('HATRIX_CONTENT_DIR: tests/fixtures/private-content');
    expect(pullRequestJob).toContain('HATRIX_ADMIN_KEY: test-admin');
    expect(pullRequestJob).toContain('run: corepack pnpm test:run');
    expect(pullRequestJob).toContain('run: corepack pnpm check');
    expect(pullRequestJob).toContain('run: corepack pnpm build');
    expect(pullRequestJob).not.toContain('secrets.');
    expect(pullRequestJob).not.toContain('.private-content');
    expect(pullRequestJob).not.toContain('upload-pages-artifact');
    expect(pullRequestJob).not.toContain('deploy-pages');
  });

  it('defaults the protected output audit to the private content root', () => {
    const script = readFileSync('scripts/check-protected-output.ts', 'utf8');

    expect(script).toContain("import { contentRoot } from '../src/lib/content-root';");
    expect(script).toContain('const sourceRoot = resolve(args[0] ?? contentRoot());');
    expect(script).toContain('inspectProtectedOutput(sourceRoot, distRoot)');
    expect(script).not.toContain("process.env.HATRIX_CONTENT_DIR ?? 'src/content'");
  });

  it('checks out an exact private content commit for every production deployment', () => {
    const workflow = readFileSync('.github/workflows/pages-deploy.yml', 'utf8').replaceAll('\r\n', '\n');
    const productionJob = workflowJob(workflow, 'build-production');
    const deployJob = workflowJob(workflow, 'deploy');
    const dispatchValidation = workflowStep(productionJob, 'Validate dispatched content SHA');
    const dispatchCheckout = workflowStep(productionJob, 'Checkout dispatched private content');
    const defaultBranchCheckout = workflowStep(productionJob, 'Checkout latest private content');
    const provenance = workflowStep(productionJob, 'Record private content SHA');

    expect(workflow).toContain('  push:\n    branches: [master]');
    expect(workflow).toContain('  workflow_dispatch:');
    expect(workflow).toContain('  repository_dispatch:\n    types: [content-updated]');
    expect(productionJob).toContain("if: github.event_name != 'pull_request'");
    expect(productionJob).toContain('HATRIX_ADMIN_KEY: ${{ secrets.HATRIX_ADMIN_KEY }}');
    expect(productionJob.slice(0, productionJob.indexOf('\n    steps:'))).not.toContain('secrets.');
    expect(productionJob).toContain(
      '      - name: Build site\n' +
      '        env:\n' +
      '          HATRIX_ADMIN_KEY: ${{ secrets.HATRIX_ADMIN_KEY }}\n' +
      '        run: corepack pnpm build'
    );
    expect(productionJob).toContain('Required secret HATRIX_ADMIN_KEY is not configured.');
    expect(productionJob).not.toContain('gh api');
    expect(productionJob).not.toContain('GH_TOKEN');
    expect(productionJob.match(/HATRIX_CONTENT_TOKEN/g)).toHaveLength(2);
    expect(dispatchValidation).toContain("if: github.event_name == 'repository_dispatch'");
    expect(dispatchValidation).toContain('DISPATCH_CONTENT_SHA: ${{ github.event.client_payload.content_sha }}');
    expect(dispatchCheckout).toContain("if: github.event_name == 'repository_dispatch'");
    expect(dispatchCheckout).toContain('repository: HatrixXXX/hatrix-content');
    expect(dispatchCheckout).toContain('token: ${{ secrets.HATRIX_CONTENT_TOKEN }}');
    expect(dispatchCheckout).toContain('ref: ${{ github.event.client_payload.content_sha }}');
    expect(dispatchCheckout).toContain('path: .private-content');
    expect(defaultBranchCheckout).toContain("if: github.event_name != 'repository_dispatch'");
    expect(defaultBranchCheckout).toContain('repository: HatrixXXX/hatrix-content');
    expect(defaultBranchCheckout).toContain('token: ${{ secrets.HATRIX_CONTENT_TOKEN }}');
    expect(defaultBranchCheckout).toContain('path: .private-content');
    expect(defaultBranchCheckout).not.toContain('ref:');
    expect(provenance).toContain('content_sha="$(git -C .private-content rev-parse HEAD)"');
    expect(provenance).toContain('"$content_sha" != "$DISPATCH_CONTENT_SHA"');
    expect(provenance).toContain('echo "sha=$content_sha" >> "$GITHUB_OUTPUT"');
    expect(productionJob).toContain('run: corepack pnpm check:site');
    expect(productionJob).not.toContain('tests/fixtures/private-content');
    expect(deployJob).toContain("if: github.event_name != 'pull_request'");
    expect(deployJob).toContain('needs: build-production');
    expect(deployJob).toContain('uses: actions/deploy-pages@v5');
  });

  it('never persists secret-bearing Astro state from a Pages build', () => {
    const workflow = readFileSync('.github/workflows/pages-deploy.yml', 'utf8').replaceAll('\r\n', '\n');
    const productionJob = workflowJob(workflow, 'build-production');
    const cleanup = workflowStep(productionJob, 'Remove secret-bearing Astro build state');
    const packageCache = workflowStep(productionJob, 'Restore pnpm store');
    const upload = workflowStep(productionJob, 'Upload Pages artifact');

    expect(workflow).not.toContain('path: .astro');
    expect(workflow).not.toContain('key: astro-');
    expect(workflow.match(/uses: actions\/cache@v6/g)).toHaveLength(2);
    expect(productionJob.match(/uses: actions\/cache@v6/g)).toHaveLength(1);
    expect(packageCache).toContain('path: ${{ env.STORE_PATH }}');
    expect(cleanup).toContain('if: always()');
    expect(cleanup).toContain('run: rm -rf -- .astro');
    expect(upload).toContain('path: dist');
    expect(upload).not.toContain('.astro');
    expect(productionJob.indexOf('Remove secret-bearing Astro build state')).toBeGreaterThan(
      productionJob.indexOf('Check built site')
    );
    expect(productionJob.indexOf('Remove secret-bearing Astro build state')).toBeLessThan(
      productionJob.indexOf('Upload Pages artifact')
    );
  });
});
