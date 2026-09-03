# GitHub Pages Repository Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不修改 DNSPod、GitHub Pages 设置和页面表现的前提下，为生产页面、内容入口、构建产物和发布供应链增加可验证的安全门禁。

**Architecture:** 浏览器策略集中在 `src/config/security.ts`，由公共布局输出，并由构建产物检查器复核。Markdown AST 插件在渲染前拒绝危险原始 HTML 和未批准的远程图片；CI 则固定工具链、Action 引用和可发布 ref。Cloudflare 作为下一阶段，不进入本计划的代码和验收。

**Tech Stack:** Astro 7、TypeScript 5.9、Vitest 4、Playwright 1.62、GitHub Actions、Corepack、pnpm 11.25.0。

## Global Constraints

- Node 版本固定为 24，包管理器使用 Corepack 管理的 pnpm。
- 保持 `output: 'static'`，不增加服务器、数据库、上传或运行时安全服务。
- 保留全部 `/posts/<legacySlug>/` 路径、Giscus pathname 映射和 40 篇已发布文章正文。
- 不修改 DNSPod、远端 Pages 设置、Cloudflare、视觉基线或远端分支。
- CSP 只在生产构建输出，开发服务器继续支持 Vite HMR。
- 保留主题无闪烁初始化、ClientRouter、Giscus、Mermaid、灯箱、Sakana 和音乐播放器。
- 已发布图床 URL 继续固定到 commit `85bc7b2b63bcf294f1079a98edf79ee1c9f41606`。
- 不添加 COOP、COEP、CORP、HSTS preload、全站验证码或全站限流。
- 每个提交只包含当前任务列出的文件；整合前重新同步最新 `master`。

---

### Task 1: Add the production browser policy

**Files:**
- Create: `src/config/security.ts`
- Create: `tests/unit/security-config.test.ts`
- Modify: `src/layouts/BaseLayout.astro:10,37-48`

**Interfaces:**
- Produces: `CONTENT_SECURITY_POLICY: string` and `REFERRER_POLICY: string`.
- Consumes: no new runtime dependency.

- [ ] **Step 1: Write the failing policy test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from '../../src/config/security';

describe('browser security policy', () => {
  it('uses the reviewed CSP directives', () => {
    expect(CONTENT_SECURITY_POLICY).toBe([
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' data: https://giscus.app",
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline' https://giscus.app",
      "img-src 'self' data: blob: https://cdn.jsdelivr.net",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' data: blob:",
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
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `corepack pnpm vitest run tests/unit/security-config.test.ts`

Expected: FAIL because `src/config/security.ts` does not exist.

- [ ] **Step 3: Add the policy constants and layout metadata**

Create `src/config/security.ts`:

```ts
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' data: https://giscus.app",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://giscus.app",
  "img-src 'self' data: blob: https://cdn.jsdelivr.net",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' data: blob:",
  'frame-src https://giscus.app',
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'"
].join('; ');

export const REFERRER_POLICY = 'strict-origin-when-cross-origin';
```

Import the constants in `BaseLayout.astro`:

```astro
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from '@/config/security';
```

Make the beginning of `<head>`:

```astro
<head>
  {
    import.meta.env.PROD && (
      <meta http-equiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
    )
  }
  <meta name="referrer" content={REFERRER_POLICY} />
  <script is:inline>
```

- [ ] **Step 4: Run the focused test and type check**

Run: `corepack pnpm vitest run tests/unit/security-config.test.ts`

Expected: PASS, 2 tests.

Run: `corepack pnpm check`

Expected: exit 0 with no Astro or TypeScript errors.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- src/config/security.ts src/layouts/BaseLayout.astro tests/unit/security-config.test.ts
git commit -m "feat: add production browser security policy"
```

---

### Task 2: Reject dangerous content and unsafe project URLs

**Files:**
- Create: `src/plugins/remark-content-security.ts`
- Create: `src/lib/safe-url.ts`
- Create: `tests/unit/content-security.test.ts`
- Modify: `astro.config.ts:5,23-25`
- Modify: `src/content.config.ts:1-42`
- Modify: `src/scripts/mermaid.ts:5`

**Interfaces:**
- Produces: default `remarkContentSecurity()` transformer and `isHttpsUrl(value: string): boolean`.
- Consumes: the immutable image prefix already required by `astro.config.ts` and image inventory tests.

- [ ] **Step 1: Write failing tests for AST validation, URL schemes and Mermaid mode**

```ts
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
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `corepack pnpm vitest run tests/unit/content-security.test.ts`

Expected: FAIL because both imported modules are missing and Mermaid does not set `securityLevel`.

- [ ] **Step 3: Implement the content transformer and HTTPS predicate**

Create `src/plugins/remark-content-security.ts`:

```ts
const IMMUTABLE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/';
const FORBIDDEN_TAG =
  /<\s*\/?\s*(?:script|iframe|object|embed|base|meta|link|style|form|input|button|textarea|select|option|svg|math)\b/i;
const FORBIDDEN_ATTRIBUTE = /\s(?:on[a-z0-9_-]+|srcdoc|formaction)\s*=/i;
const UNSAFE_SCHEME = /^\s*(?:javascript|vbscript|data\s*:\s*(?:text\/html|application\/xhtml\+xml|image\/svg\+xml))/i;
const URL_ATTRIBUTE =
  /\b(?:href|src|action|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/gi;
const RAW_IMAGE =
  /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))[^>]*>/gi;
const REMOTE_URL = /^https?:\/\//i;

type ContentNode = {
  type: string;
  url?: string;
  value?: string;
  children?: ContentNode[];
};

type FileLike = { path?: string };

function fail(file: FileLike, reason: string): never {
  throw new Error(`[remark-content-security] ${file.path ?? 'content'}: ${reason}`);
}

function validateRemoteImage(url: string, file: FileLike): void {
  if (REMOTE_URL.test(url) && !url.startsWith(IMMUTABLE_IMAGE_PREFIX)) {
    fail(file, 'unapproved remote image');
  }
}

function validateHtml(value: string, file: FileLike): void {
  if (FORBIDDEN_TAG.test(value)) fail(file, 'forbidden raw HTML tag');
  if (FORBIDDEN_ATTRIBUTE.test(value)) fail(file, 'forbidden raw HTML attribute');

  for (const match of value.matchAll(URL_ATTRIBUTE)) {
    const url = match[1] ?? match[2] ?? match[3] ?? '';
    if (UNSAFE_SCHEME.test(url)) fail(file, 'unsafe URL in raw HTML');
  }
  for (const match of value.matchAll(RAW_IMAGE)) {
    validateRemoteImage(match[1] ?? match[2] ?? match[3] ?? '', file);
  }
}

function visit(node: ContentNode, file: FileLike): void {
  if ((node.type === 'link' || node.type === 'image') && node.url) {
    if (UNSAFE_SCHEME.test(node.url)) fail(file, 'unsafe URL');
    if (node.type === 'image') validateRemoteImage(node.url, file);
  }
  if (node.type === 'html' && node.value) validateHtml(node.value, file);
  for (const child of node.children ?? []) visit(child, file);
}

export default function remarkContentSecurity() {
  return (tree: ContentNode, file: FileLike = {}) => visit(tree, file);
}
```

Create `src/lib/safe-url.ts`:

```ts
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
```

Add the plugin before `remarkImageStatus` in `astro.config.ts`:

```ts
import remarkContentSecurity from './src/plugins/remark-content-security';

markdown: {
  remarkPlugins: [remarkMath, remarkContentSecurity, remarkImageStatus],
```

Use the predicate in `src/content.config.ts`:

```ts
import { isHttpsUrl } from './lib/safe-url';

links: z.array(z.object({
  label: z.string(),
  url: z.string().refine(isHttpsUrl, { message: 'project links must use https' })
})).default([]),
```

Pin Mermaid explicitly:

```ts
mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
```

- [ ] **Step 4: Run focused tests and validate all current content**

Run: `corepack pnpm vitest run tests/unit/content-security.test.ts tests/unit/check-images.test.ts tests/unit/content-schema.test.ts`

Expected: PASS; the 40 published posts and 254-image inventory remain valid.

Run: `corepack pnpm check`

Expected: exit 0 with no Astro or TypeScript errors.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- astro.config.ts src/content.config.ts src/lib/safe-url.ts src/plugins/remark-content-security.ts src/scripts/mermaid.ts tests/unit/content-security.test.ts
git commit -m "feat: reject unsafe published content"
```

---

### Task 3: Enforce security in built HTML

**Files:**
- Modify: `scripts/check-built-site.ts:6-164`
- Modify: `tests/unit/check-built-site.test.ts:7-97`

**Interfaces:**
- Consumes: `CONTENT_SECURITY_POLICY`, `REFERRER_POLICY`, `SITE_ORIGIN` and the immutable image prefix.
- Produces: `securityErrorsForHtml(html: string, route: string): string[]`.

- [ ] **Step 1: Write failing built-output tests**

Add to `tests/unit/check-built-site.test.ts`:

```ts
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from '../../src/config/security';

const secureHead = `<head><meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}"><meta name="referrer" content="${REFERRER_POLICY}"></head>`;

it('accepts the reviewed metadata and safe external resources', () => {
  const html = `<html>${secureHead}<body><img src="https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/a.png"><a href="https://example.com" target="_blank" rel="noreferrer">external</a><script src="https://giscus.app/client.js"></script></body></html>`;

  expect(securityErrorsForHtml(html, '/safe/')).toEqual([]);
});

it('reports missing or late metadata and unsafe HTML attributes', () => {
  const html = `<html><head><script src="/early.js"></script>${secureHead}</head><body><a href="javascript:alert(1)" target="_blank">bad</a><img src="https://evil.example/tracker.png" onerror="alert(1)"></body></html>`;

  expect(securityErrorsForHtml(html, '/unsafe/')).toEqual(expect.arrayContaining([
    expect.stringContaining('CSP must appear before every script'),
    expect.stringContaining('unsafe URL scheme'),
    expect.stringContaining('inline event attribute'),
    expect.stringContaining('missing noopener protection'),
    expect.stringContaining('unapproved remote image')
  ]));
});
```

Update the import from the checker:

```ts
import {
  inspectBuiltSite,
  inspectProjectBuiltSite,
  securityErrorsForHtml
} from '../../scripts/check-built-site';
```

Use `secureHead` in the synthetic valid site’s `index.html`, post HTML and `404.html` fixtures so its expected error list remains empty.

- [ ] **Step 2: Run the test and confirm RED**

Run: `corepack pnpm vitest run tests/unit/check-built-site.test.ts`

Expected: FAIL because `securityErrorsForHtml` is not exported.

- [ ] **Step 3: Implement generated HTML inspection**

Add to `scripts/check-built-site.ts`:

```ts
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from '../src/config/security';

const IMMUTABLE_IMAGE_PREFIX =
  'https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image@85bc7b2b63bcf294f1079a98edf79ee1c9f41606/img/';

function decodeAttribute(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&#x22;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&amp;', '&');
}

function attributeValue(tag: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(
    new RegExp(`\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i')
  );
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === undefined ? undefined : decodeAttribute(value);
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function externalUrl(value: string, route: string): URL | undefined {
  try {
    const url = new URL(value, `${SITE_ORIGIN}${route}`);
    return url.origin === SITE_ORIGIN ? undefined : url;
  } catch {
    return undefined;
  }
}

export function securityErrorsForHtml(html: string, route: string): string[] {
  const errors: string[] = [];
  const metaTags = tags(html, 'meta');
  const cspTags = metaTags.filter(
    (tag) => attributeValue(tag, 'http-equiv')?.toLowerCase() === 'content-security-policy'
  );
  const referrerTags = metaTags.filter(
    (tag) => attributeValue(tag, 'name')?.toLowerCase() === 'referrer'
  );

  if (cspTags.length !== 1 || attributeValue(cspTags[0] ?? '', 'content') !== CONTENT_SECURITY_POLICY) {
    errors.push(`Invalid Content Security Policy in ${route}.`);
  }
  if (referrerTags.length !== 1 || attributeValue(referrerTags[0] ?? '', 'content') !== REFERRER_POLICY) {
    errors.push(`Invalid Referrer Policy in ${route}.`);
  }
  const firstScript = html.search(/<script\b/i);
  const cspPosition = cspTags.length === 1 ? html.indexOf(cspTags[0]) : -1;
  if (firstScript >= 0 && (cspPosition < 0 || cspPosition > firstScript)) {
    errors.push(`CSP must appear before every script in ${route}.`);
  }
  if (/<[^>]*\son[a-z0-9_-]+\s*=/i.test(html)) {
    errors.push(`Found inline event attribute in ${route}.`);
  }
  if (/\b(?:href|src|action|formaction)\s*=\s*(?:["']\s*)?(?:javascript|vbscript):/i.test(html)) {
    errors.push(`Found unsafe URL scheme in ${route}.`);
  }
  if (/\b(?:href|src|action|formaction)\s*=\s*(?:["']\s*)?data:(?:text\/html|application\/xhtml\+xml|image\/svg\+xml)/i.test(html)) {
    errors.push(`Found dangerous data document in ${route}.`);
  }

  for (const anchor of tags(html, 'a')) {
    if (attributeValue(anchor, 'target')?.toLowerCase() !== '_blank') continue;
    const rel = new Set((attributeValue(anchor, 'rel') ?? '').toLowerCase().split(/\s+/));
    if (!rel.has('noopener') && !rel.has('noreferrer')) {
      errors.push(`External-window link is missing noopener protection in ${route}.`);
    }
  }
  for (const script of tags(html, 'script')) {
    const src = attributeValue(script, 'src');
    const url = src ? externalUrl(src, route) : undefined;
    if (url && url.href !== 'https://giscus.app/client.js') {
      errors.push(`Unapproved external script in ${route}: ${url.origin}`);
    }
  }
  for (const iframe of tags(html, 'iframe')) {
    const src = attributeValue(iframe, 'src');
    const url = src ? externalUrl(src, route) : undefined;
    if (url && url.origin !== 'https://giscus.app') {
      errors.push(`Unapproved external frame in ${route}: ${url.origin}`);
    }
  }
  for (const image of tags(html, 'img')) {
    const src = attributeValue(image, 'src');
    if (src && /^https?:\/\//i.test(src) && !src.startsWith(IMMUTABLE_IMAGE_PREFIX)) {
      errors.push(`Unapproved remote image in ${route}.`);
    }
  }
  return errors;
}
```

Inside the existing HTML loop, read each file once and merge security errors before checking links:

```ts
for (const htmlFile of files.filter((file) => file.endsWith('.html'))) {
  const sourceRoute = routeForHtmlFile(root, htmlFile);
  const html = await readFile(htmlFile, 'utf8');
  errors.push(...securityErrorsForHtml(html, sourceRoute));
  for (const link of localLinks(html)) {
```

- [ ] **Step 4: Run focused tests and a production build**

Run: `corepack pnpm vitest run tests/unit/check-built-site.test.ts tests/unit/security-config.test.ts`

Expected: PASS.

Run: `corepack pnpm build && corepack pnpm check:site`

Expected: build exits 0 and all generated HTML passes the security inspection.

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- scripts/check-built-site.ts tests/unit/check-built-site.test.ts
git commit -m "test: enforce built site security policy"
```

---

### Task 4: Harden the Pages workflow and pin the package manager

**Files:**
- Modify: `.github/workflows/pages-deploy.yml:15-89`
- Modify: `package.json:1-40`
- Modify: `tests/unit/project-config.test.ts:9-115`

**Interfaces:**
- Consumes: pnpm `11.25.0` and the reviewed Action tag heads recorded below.
- Produces: immutable workflow references and deployment-source checks.

- [ ] **Step 1: Write failing workflow tests**

Add inside `describe('Astro project tooling')` in `tests/unit/project-config.test.ts`:

```ts
it('pins Corepack and every GitHub Action to immutable versions', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const workflow = readFileSync('.github/workflows/pages-deploy.yml', 'utf8');
  const actionRefs = [...workflow.matchAll(/^\s+uses:\s+[^@\s]+@([^\s#]+)/gm)].map(
    (match) => match[1]
  );

  expect(packageJson.packageManager).toBe('pnpm@11.25.0');
  expect(actionRefs.length).toBeGreaterThan(0);
  expect(actionRefs.every((ref) => /^[a-f0-9]{40}$/.test(ref))).toBe(true);
});

it('does not persist checkout credentials or deploy a manually selected non-master ref', () => {
  const workflow = readFileSync('.github/workflows/pages-deploy.yml', 'utf8').replaceAll('\r\n', '\n');

  expect(workflow).toContain('persist-credentials: false');
  expect(workflow).toContain("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/master'");
  expect(workflow).toContain('timeout-minutes: 15');
  expect(workflow).toContain('timeout-minutes: 10');
  expect(workflow).toContain('corepack pnpm audit --prod --audit-level high');
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `corepack pnpm vitest run tests/unit/project-config.test.ts`

Expected: FAIL because `packageManager` is absent, Actions use moving tags, and workflow guards are missing.

- [ ] **Step 3: Pin tools and restrict the deployment workflow**

Add to `package.json` after `"private": true`:

```json
"packageManager": "pnpm@11.25.0",
```

Use these immutable Action references, retaining the version comments:

```yaml
actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6
actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6
actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5
actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5
```

Add to the build job:

```yaml
build:
  runs-on: ubuntu-latest
  timeout-minutes: 15
```

Add to checkout `with`:

```yaml
persist-credentials: false
```

After dependency installation add:

```yaml
- name: Audit production dependencies
  run: corepack pnpm audit --prod --audit-level high
```

Restrict artifact upload:

```yaml
if: >-
  (github.event_name == 'push' && github.ref == 'refs/heads/master') ||
  (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/master')
```

Restrict deploy and set its timeout:

```yaml
deploy:
  if: >-
    (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/master') ||
    (github.event_name == 'push' && github.ref == 'refs/heads/master')
  needs: build
  runs-on: ubuntu-latest
  timeout-minutes: 10
```

- [ ] **Step 4: Run focused tests and dependency audit**

Run: `corepack pnpm vitest run tests/unit/project-config.test.ts`

Expected: PASS.

Run: `corepack pnpm audit --prod --audit-level high`

Expected: exit 0 with no high or critical production dependency advisories.

- [ ] **Step 5: Commit Task 4**

```powershell
git add -- .github/workflows/pages-deploy.yml package.json tests/unit/project-config.test.ts
git commit -m "ci: harden Pages deployment supply chain"
```

---

### Task 5: Document, reconcile and verify the complete change

**Files:**
- Modify: `README.md:121-145`
- Do not modify: `tests/e2e/visual.spec.ts-snapshots/*.png`

**Interfaces:**
- Consumes: the browser policy, content validator, built-output checks and CI constraints from Tasks 1-4.
- Produces: documented maintenance rules, complete verification evidence and a running local preview.

- [ ] **Step 1: Add concise maintenance documentation**

Add a `## 安全边界` section before `## 部署` in `README.md`:

```markdown
## 安全边界

生产页面通过 HTML CSP 限制脚本、框架、图片和其他资源来源，并使用 `strict-origin-when-cross-origin` Referrer Policy。CSP 只在生产构建输出，开发服务器仍使用 Vite HMR。新增第三方脚本、框架、远程图片或媒体来源时，先更新安全策略和构建产物测试，不能只放宽 `default-src`。

已发布 Markdown 会在构建期拒绝可执行原始 HTML、事件属性、危险 URL scheme 和未固定的远程图片。检查失败时修改内容或明确更新允许边界，不要用 sanitizer 静默删除正文。

GitHub Pages 无法由仓库配置 HSTS、`nosniff`、`frame-ancestors`、WAF、限流或可控 DDoS 防护。这些项目留给后续 Cloudflare 阶段；当前流量仍由 DNSPod 直接指向 GitHub Pages。

Pages workflow 的 Action 必须固定到完整 commit SHA，checkout 不保留凭据，手动部署只能使用 `master`。升级 Action 时同时更新版本注释和项目配置测试。
```

- [ ] **Step 2: Run the full local gate**

Run each command separately and keep the complete exit status:

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
corepack pnpm check:site
corepack pnpm test:e2e
```

Expected: all commands exit 0; visual tests do not modify any baseline. If the legitimate link inventory changes, inspect `dist` before adjusting only the verified count in `scripts/check-built-site.ts`.

- [ ] **Step 3: Verify the production CSP in a browser**

Run production preview on an unused port:

```powershell
corepack pnpm preview --host 127.0.0.1 --port 4322
```

Using the browser automation skill, open `http://127.0.0.1:4322/`, `/posts/本科数学大杂烩/`, `/posts/FPGA开发(3)AXI协议/` and `/guestbook/`. Record any `securitypolicyviolation` events and verify theme switching, search, client navigation, Giscus fallback/mount, Mermaid and lightbox behavior. Stop only this port-4322 preview after inspection.

- [ ] **Step 4: Reconcile concurrent branches and rerun affected gates**

Fetch the current main-worktree state without resetting either worktree. Rebase or merge `feat/security-hardening` onto the latest local `master`, resolving only overlapping security lines. Preserve protected-content and horizontal-rail changes. Rerun focused tests for every resolved file, then rerun the full gate from Step 2.

- [ ] **Step 5: Commit documentation and verified integration adjustments**

```powershell
git add -- README.md
git commit -m "docs: record static site security boundaries"
```

The security metadata adds no local links, so `EXPECTED_LOCAL_LINKS` must remain unchanged. Any conflict resolution is committed before this documentation commit and may include only files already named in Tasks 1-4. Never stage unrelated worktree files.

- [ ] **Step 6: Start the required development preview**

Run `corepack pnpm dev --host 127.0.0.1` on `127.0.0.1:4321`. If another process already owns the port, verify whether it serves the final commit before reusing it; do not terminate a preview owned by another session without identifying it.

Expected: `http://127.0.0.1:4321/` returns the final site and the process remains running.
