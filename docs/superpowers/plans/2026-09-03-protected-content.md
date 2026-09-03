# Protected Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Astro 静态站增加 frontmatter/路由级加锁、正文和正文图片加密、管理员解锁与七天凭据，并让私有内容仓库的 push 自动触发 GitHub Pages 部署。

**Architecture:** 全部文章源从被忽略的 `.private-content/` 私有仓库读取。构建端用 Argon2id 从管理员 key 派生 AES-256-GCM 密钥，`ProtectedContent.astro` 加密服务端渲染的正文；加锁 Markdown 的本地图片由独立静态端点输出密文。浏览器只收到公开元数据、解锁外壳和密文，正确解锁后把 HTML 和图片恢复到内存。

**Tech Stack:** Astro 7.2、TypeScript 5.9、Node 24 Web Crypto、hash-wasm 4.12、Vitest 4.1、Playwright 1.62、GitHub Actions、GitHub Pages

## Global Constraints

- 保持 Astro `output: 'static'`，不增加服务器、数据库或运行时 API。
- 管理员 key 由用户设置，至少 8 个字符；不得进入 Git、客户端 bundle、构建日志或 `dist/`。
- 加锁文章公开标题、摘要、日期、类型、URL、阅读时间和封面；正文、正文图片和正文内嵌资源加密。
- 保留全部 `/posts/<legacySlug>/` 路径和 Giscus pathname 映射。
- `locked` 省略时为 `false`；`series`/`seriesOrder`、文章类型、图片固定提交等现有约束继续生效。
- 未勾选时凭据只在浏览器会话有效；勾选时同一浏览器资料保存七天。
- 冷却阶梯固定为前两次仅承担 KDF 时间，第 3 次 5 秒、第 4 次 15 秒、第 5 次 60 秒，之后 5 分钟。
- 正文远程图片不得出现在加锁文章中；封面仍可使用已固定 commit 的 jsDelivr URL。
- 不提交 `dist/`、`.astro/`、`reports/`、`test-results/`、Playwright trace 或 `.private-content/`。
- 不修改与本功能无关的代码，不覆盖其他会话的工作。

---

### Task 1: 内容根目录、schema 与公开元数据契约

**Files:**
- Create: `src/config/protected-content.ts`
- Create: `src/lib/content-root.ts`
- Modify: `src/content.config.ts`
- Modify: `src/types/content.ts`
- Modify: `.gitignore`
- Modify: `tests/unit/content-schema.test.ts`
- Create: `tests/unit/protected-content-config.test.ts`

**Interfaces:**
- Produces: `PROTECTED_CONTENT`，包含格式版本、固定盐、Argon2id 参数、七天毫秒数和最短 key 长度。
- Produces: `LOCKED_PAGE_PATHS`、`normalizeRoutePath(path: string): string`、`isConfiguredLockedPage(path: string): boolean`。
- Produces: `contentRoot(...segments: string[]): string`，默认解析 `.private-content/`，测试可用 `HATRIX_CONTENT_DIR` 覆盖。
- Produces: `PostEntry['data']['locked']: boolean`。

- [x] **Step 1: 写失败测试**

`tests/unit/protected-content-config.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  LOCKED_PAGE_PATHS,
  PROTECTED_CONTENT,
  isConfiguredLockedPage,
  normalizeRoutePath
} from '../../src/config/protected-content';

describe('protected content config', () => {
  it('uses the agreed password and KDF floors', () => {
    expect(PROTECTED_CONTENT.minimumKeyLength).toBe(8);
    expect(PROTECTED_CONTENT.argon2.memorySizeKiB).toBeGreaterThanOrEqual(19_456);
    expect(PROTECTED_CONTENT.argon2.iterations).toBeGreaterThanOrEqual(2);
    expect(PROTECTED_CONTENT.rememberForMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('normalizes configured routes without decoding legacy slugs', () => {
    expect(normalizeRoutePath('/about/research')).toBe('/about/research/');
    expect(normalizeRoutePath('/')).toBe('/');
    expect(LOCKED_PAGE_PATHS.every(isConfiguredLockedPage)).toBe(true);
  });
});
```

扩展 `tests/unit/content-schema.test.ts`，断言夹具或真实文章省略 `locked` 时为公开，并拒绝非布尔值。

- [x] **Step 2: 运行测试并确认 RED**

Run: `corepack pnpm test:run tests/unit/protected-content-config.test.ts tests/unit/content-schema.test.ts`

Expected: FAIL，原因是配置模块不存在且 schema 尚无 `locked`。

- [x] **Step 3: 写最小配置和 schema**

`src/config/protected-content.ts` 的公开契约：

```ts
export const PROTECTED_CONTENT = {
  formatVersion: 1,
  minimumKeyLength: 8,
  rememberForMs: 7 * 24 * 60 * 60 * 1000,
  saltBase64: '0J9wHDhoJFtpjeM+N1PY+w==',
  argon2: { memorySizeKiB: 19_456, iterations: 2, parallelism: 1, hashLength: 32 }
} as const;

export const LOCKED_PAGE_PATHS: readonly string[] = [];

export function normalizeRoutePath(path: string): string {
  const pathname = new URL(path, 'https://hatrix.site').pathname;
  return pathname === '/' ? '/' : `${pathname.replace(/\/+$/, '')}/`;
}

export function isConfiguredLockedPage(path: string): boolean {
  return LOCKED_PAGE_PATHS.includes(normalizeRoutePath(path));
}
```

实现 `contentRoot()`，把 `HATRIX_CONTENT_DIR` 解析为绝对路径并拒绝空字符串。posts schema 增加 `locked: z.boolean().default(false)`，`PostData` 同步增加字段。

- [x] **Step 4: 验证 GREEN 并提交**

Run: `corepack pnpm test:run tests/unit/protected-content-config.test.ts tests/unit/content-schema.test.ts`

Expected: PASS。

Commit: `feat: define protected content contract`

---

### Task 2: Argon2id 与 AES-GCM 核心

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/lib/protected-content/encoding.ts`
- Create: `src/lib/protected-content/crypto.ts`
- Create: `src/lib/protected-content/server.ts`
- Create: `tests/unit/protected-crypto.test.ts`

**Interfaces:**
- Produces: `deriveContentKeyBytes(key: string, config?: KdfConfig): Promise<Uint8Array>`。
- Produces: `importContentKey(bytes: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey>`。
- Produces: `encryptEnvelope(plaintext: Uint8Array, key: CryptoKey, aad: string, iv?: Uint8Array): Promise<EncryptedEnvelope>`。
- Produces: `decryptEnvelope(envelope: EncryptedEnvelope, key: CryptoKey, aad: string): Promise<Uint8Array>`。
- Produces: `adminKeyFromEnvironment(): string`，少于 8 个字符时抛出不包含 key 的错误。
- Produces: base64/base64url、UTF-8 编解码函数。

- [x] **Step 1: 安装 Argon2id 实现并写失败测试**

Run: `corepack pnpm add hash-wasm@4.12.0`

测试使用固定 salt、IV 和测试 key，断言同参数派生结果相同、正确 key 往返成功、错误 key 和错误 AAD 均抛出 `OperationError`，并断言环境 key 的 8 字符下限。

```ts
it('authenticates ciphertext with the key and route', async () => {
  const bytes = await deriveContentKeyBytes('remembered-key');
  const cryptoKey = await importContentKey(bytes, ['encrypt', 'decrypt']);
  const envelope = await encryptEnvelope(
    utf8('private body'),
    cryptoKey,
    'page:/posts/private/',
    new Uint8Array(12).fill(7)
  );
  await expect(decryptEnvelope(envelope, cryptoKey, 'page:/posts/private/'))
    .resolves.toEqual(utf8('private body'));
  await expect(decryptEnvelope(envelope, cryptoKey, 'page:/posts/other/'))
    .rejects.toThrow();
});
```

- [x] **Step 2: 运行测试并确认 RED**

Run: `corepack pnpm test:run tests/unit/protected-crypto.test.ts`

Expected: FAIL，原因是 crypto 模块不存在。

- [x] **Step 3: 实现最小密码学模块**

`deriveContentKeyBytes()` 调用 `hash-wasm` 的 `argon2id({ password, salt, memorySize, iterations, parallelism, hashLength: 32, outputType: 'binary' })`。AES-GCM 信封只含 `version`、base64 IV 和 base64 ciphertext；所有加解密必须传入 AAD。服务端仅通过参数接收 key 或从 `astro:env/server` 读取，不导出到客户端常量。

- [x] **Step 4: 验证、检查 bundle 边界并提交**

Run: `corepack pnpm test:run tests/unit/protected-crypto.test.ts`

Expected: PASS。

Run: `corepack pnpm check`

Expected: 0 errors。

Commit: `feat: add protected content cryptography`

---

### Task 3: 加锁 Markdown 和私密正文图片

**Files:**
- Create: `src/lib/protected-content/markdown.ts`
- Create: `src/pages/protected-content/assets/[id].bin.ts`
- Create: `tests/fixtures/protected-content/private-image.png`
- Create: `tests/unit/protected-markdown.test.ts`

**Interfaces:**
- Produces: `ProtectedAsset { id, sourcePath, mediaType, aad, url }`。
- Produces: `renderProtectedMarkdown(post: PostEntry, keyBytes: Uint8Array): Promise<{ html: string; assets: ProtectedAsset[] }>`。
- Produces: `collectProtectedAssets(posts: PostEntry[], keyBytes: Uint8Array): Promise<ProtectedAsset[]>`。
- Static endpoint: `/protected-content/assets/<keyed-id>.bin`，正文解锁前无法读取原图。

- [ ] **Step 1: 写失败测试**

测试创建临时 Markdown 和 PNG，断言渲染 HTML 不含原文件名或图片字节，只含 `data-protected-src`、媒体类型和不可读 ID；远程图片、绝对 public 路径和越出内容根目录的路径必须拒绝。

```ts
it('replaces a local image with an encrypted asset reference', async () => {
  const result = await renderProtectedMarkdown(fixturePost('![secret](./private-image.png)'), keyBytes);
  expect(result.html).toContain('data-protected-src="/protected-content/assets/');
  expect(result.html).not.toContain('private-image.png');
  expect(result.assets).toHaveLength(1);
});

it.each(['![x](https://example.com/x.png)', '![x](/images/x.png)', '![x](../../outside.png)'])
  ('rejects an unprotectable image reference: %s', async (body) => {
    await expect(renderProtectedMarkdown(fixturePost(body), keyBytes)).rejects.toThrow(/加锁文章/);
  });
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `corepack pnpm test:run tests/unit/protected-markdown.test.ts`

Expected: FAIL，原因是 Markdown 保护模块不存在。

- [ ] **Step 3: 实现受保护图片 remark 插件和端点**

复用 `@astrojs/markdown-remark` 的 `createMarkdownProcessor()`、现有 math/KaTeX/Shiki 设置。插件只接受位于当前私有内容根目录内的相对图片，使用内容密钥 HMAC-SHA-256 生成公开 ID，把节点改为透明占位 `src` 加 `data-protected-src` 和 `data-protected-type`。asset endpoint 枚举所有已发布且 `locked` 的文章，读取对应文件后用 AES-GCM 和 `asset:<id>` AAD 输出二进制信封。

- [ ] **Step 4: 验证 GREEN 并提交**

Run: `corepack pnpm test:run tests/unit/protected-markdown.test.ts tests/unit/protected-crypto.test.ts`

Expected: PASS。

Commit: `feat: encrypt protected post images`

---

### Task 4: 服务端正文加密组件和公开 manifest

**Files:**
- Create: `src/components/ProtectedContent.astro`
- Create: `src/pages/protected-content/manifest.json.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/layouts/PostLayout.astro`
- Modify: `src/pages/posts/[slug].astro`
- Create: `tests/unit/protected-routes.test.ts`

**Interfaces:**
- `ProtectedContent.astro` props: `{ locked: boolean; route: string; title: string }`。
- 公开 manifest: `{ version, salt, argon2, rememberForMs, routes, verifier }`。
- DOM: `[data-protected-gate]`、`[data-protected-envelope]`、`[data-protected-mount]`、`[data-unlock-form]`。

- [ ] **Step 1: 写路由和输出契约的失败测试**

测试 `publicProtectedRoutes(posts)` 只返回 `locked && !draft` 的 postPath 和 `LOCKED_PAGE_PATHS`，去重并规范化。增加源码契约测试，要求 BaseLayout 读取普通页面锁配置、PostLayout 只锁正文网格、post route 对加锁文章使用 `renderProtectedMarkdown()`。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `corepack pnpm test:run tests/unit/protected-routes.test.ts`

Expected: FAIL，原因是路由 helper 和组件不存在。

- [ ] **Step 3: 实现组件、manifest 和布局接线**

`ProtectedContent.astro` 在 `locked=false` 时原样输出 `<slot />`；锁定时调用 `Astro.slots.render('default')`，使用服务端内容密钥加密 HTML，只输出解锁表单、base64 信封和空 mount。BaseLayout 仅对 `LOCKED_PAGE_PATHS` 包裹页面 slot；PostLayout 保留公开 Hero，把文章网格包入组件。加锁 post 的 slot 使用受保护 Markdown HTML，公开 post 继续用 Astro 的 `<Content />`。

manifest 使用同一密钥加密固定验证文本；不得返回 key、派生 key 或正文。

- [ ] **Step 4: 验证静态输出并提交**

Run: `$env:HATRIX_ADMIN_KEY='test-admin'; corepack pnpm check`

Expected: 0 errors。

Run: `$env:HATRIX_ADMIN_KEY='test-admin'; corepack pnpm build`

Expected: 构建成功，公开页面不变；未配置真实加锁内容时 manifest routes 为空。

Commit: `feat: render encrypted page shells`

---

### Task 5: 浏览器解锁、七天凭据和失败冷却

**Files:**
- Create: `src/lib/protected-content/state.ts`
- Create: `src/scripts/protected-content.ts`
- Create: `src/styles/protected-content.css`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/SiteHeader.astro`
- Modify: `src/scripts/lightbox.ts`
- Modify: `src/scripts/mermaid.ts`
- Modify: `src/scripts/toc.ts`
- Modify: `src/components/GiscusComments.astro`
- Create: `tests/unit/protected-state.test.ts`
- Create: `src/pages/__tests__/[slug].astro`
- Create: `tests/e2e/protected-content.spec.ts`

**Interfaces:**
- Produces: `cooldownMs(failures: number): number`、`remainingCooldown(until: number, now: number): number`、`credentialExpired(expiresAt, now)`。
- IndexedDB database: `hatrix-protected-content`, store `credentials`，保存不可导出的 AES `CryptoKey`。
- Storage refs: `hatrix-admin-session`（sessionStorage）和 `hatrix-admin-remembered`（localStorage）。
- Custom event: `hatrix:protected-content-ready`。

- [ ] **Step 1: 写状态函数和端到端失败测试**

单元测试覆盖 `0, 0, 5_000, 15_000, 60_000, 300_000` 冷却序列、七天到期边界和旧格式失效。Playwright 测试页只在 `PLAYWRIGHT_TEST=1` 时生成，包含已知测试 key 加密的正文。

E2E 依次断言：游客只见解锁页；空输入和错误 key 有不同提示；第 3 次出现倒计时；正确 key 显示正文；session 模式刷新有效；remember 模式新页面有效；人为过期后恢复游客；退出按钮清除状态；无 JavaScript 不含正文。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `corepack pnpm test:run tests/unit/protected-state.test.ts`

Expected: FAIL，原因是状态模块不存在。

Run: `$env:HATRIX_ADMIN_KEY='test-admin'; corepack pnpm exec playwright test tests/e2e/protected-content.spec.ts --project=desktop-1440`

Expected: FAIL，原因是测试路由和解锁脚本不存在。

- [ ] **Step 3: 实现状态机、IndexedDB 和 DOM 恢复**

脚本在 `astro:page-load` 初始化 gate。提交时先检查冷却，运行 Argon2id，验证 manifest 密文，再解密页面 HTML；成功后按 checkbox 写 session 或七天引用并把不可导出 CryptoKey 存入 IndexedDB。插入 HTML 前解密所有 `data-protected-src` 图片为 Blob URL，全部成功后一次性挂载并发出 ready 事件。

错误文案固定为设计稿中的五种状态。退出按钮清除两类引用、IndexedDB 记录和 Blob URL。页面切换时撤销当前页 URL，但保留有效凭据。

- [ ] **Step 4: 验证 GREEN、无障碍和提交**

Run: `corepack pnpm test:run tests/unit/protected-state.test.ts`

Expected: PASS。

Run: `$env:HATRIX_ADMIN_KEY='test-admin'; corepack pnpm exec playwright test tests/e2e/protected-content.spec.ts --project=desktop-1440`

Expected: PASS。

Commit: `feat: add administrator unlock flow`

---

### Task 6: 列表标识、搜索、RSS、sitemap 与泄漏审计

**Files:**
- Modify: `src/components/PostCard.astro`
- Modify: `src/layouts/PostLayout.astro`
- Modify: `src/pages/archives/index.astro`
- Modify: `src/components/SiteFooter.astro`
- Modify: `src/lib/search.ts`
- Modify: `src/pages/search-index.json.ts`
- Modify: `src/pages/rss.xml.ts`
- Modify: `astro.config.ts`
- Create: `scripts/check-protected-output.ts`
- Modify: `package.json`
- Create: `tests/unit/check-protected-output.test.ts`
- Modify: `tests/e2e/index-pages.spec.ts`

**Interfaces:**
- Search document 增加 `locked: boolean`；加锁文档的 `text` 只由公开 metadata 组成。
- `check:protected` 接收内容根目录和 `dist`，检测 Markdown 正文片段、原始资源名/字节和禁止的远程正文图片。
- 加锁链接使用 `data-locked-link` 和可见/可访问的锁图标。

- [ ] **Step 1: 写失败测试**

扩展 search 单元测试，证明加锁文章的独有正文词不进入文档。审计脚本测试构造临时 `dist`：存在私密正文、原图字节或原资源名时失败，只有 AES-GCM 密文时通过。E2E 断言卡片锁标记、RSS 无正文、搜索结果只含公开摘要。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `corepack pnpm test:run tests/unit/content-utils.test.ts tests/unit/check-protected-output.test.ts`

Expected: FAIL，原因是 search 未裁剪且审计脚本不存在。

- [ ] **Step 3: 实现公开面和审计**

所有已知 post 链接根据 `post.data.locked` 增加锁标识；不靠图标承担安全。search 对 locked post 不调用正文提取。RSS 继续使用公开 description。sitemap filter 排除 manifest 中的静态锁路由，并为加锁页面输出 `noindex, nofollow`。

`build` 在 `astro build` 后运行 `check:protected`，审计失败返回非零退出码且只报告文件和规则，不回显私密正文。

- [ ] **Step 4: 验证 GREEN 并提交**

Run: `corepack pnpm test:run tests/unit/content-utils.test.ts tests/unit/check-protected-output.test.ts`

Expected: PASS。

Commit: `feat: prevent protected content metadata leaks`

---

### Task 7: 私有内容迁移与跨仓库部署

**Files:**
- Move locally: `src/content/posts/*.md` -> `.private-content/posts/*.md`
- Modify: `.github/workflows/pages-deploy.yml`
- Create in local private repository: `.private-content/.github/workflows/notify-site.yml`
- Create: `tests/fixtures/private-content/posts/public.md`
- Create: `tests/fixtures/private-content/posts/locked.md`
- Modify: `tests/unit/project-config.test.ts`
- Modify: `scripts/check-images.ts`
- Modify: `scripts/check-built-site.ts`

**Interfaces:**
- Public workflow triggers: `push` on `master`, `workflow_dispatch`, `repository_dispatch` type `content-updated`, `pull_request` fixture validation.
- Production secrets: `HATRIX_ADMIN_KEY` and read-only `HATRIX_CONTENT_TOKEN`。
- Private repository secret: fine-grained `HATRIX_SITE_DISPATCH_TOKEN`，只允许向公开仓库发送 dispatch。
- Dispatch payload: `{ content_sha: github.sha }`。

- [ ] **Step 1: 写 workflow 和内容根目录失败测试**

`tests/unit/project-config.test.ts` 断言公开 workflow 的生产 job 检出 `.private-content` 指定 SHA、只在非 PR 使用正式 secrets、PR 使用 `tests/fixtures/private-content`、dispatch 后仍走 Pages deploy。断言私有内容目录被忽略，公开 posts 目录不再包含文章正文。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `corepack pnpm test:run tests/unit/project-config.test.ts tests/unit/content-schema.test.ts`

Expected: FAIL，原因是 workflow 和内容路径尚未迁移。

- [ ] **Step 3: 安全迁移本地内容并更新脚本**

先复制 40 篇文章到 `.private-content/posts/`，逐文件校验 SHA-256 和数量一致，再在 `.private-content` 初始化独立 Git 仓库并提交。只有私有仓库本地提交成功后，才从公开分支删除 `src/content/posts/*.md`。图片预检、schema 测试和 built-site 检查统一通过 `contentRoot()` 读取。

公开 workflow 的 PR job 不接触任何正式 secret；正式 job 对缺失 secret 立即失败。私有 workflow 使用 `repository_dispatch` 传递精确内容 SHA。不得在本任务中推送、部署或创建远端仓库。

- [ ] **Step 4: 验证迁移和 workflow 测试并提交**

Run: `corepack pnpm test:run tests/unit/project-config.test.ts tests/unit/content-schema.test.ts tests/unit/check-images.test.ts`

Expected: PASS，40 篇本地私有内容均可读，公开分支没有文章源文件。

Commit in private local repo: `content: import existing posts`

Commit in public feature branch: `build: load posts from private content repository`

---

### Task 8: 文档、全量验证和本地预览

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-03-protected-content-design.md`
- Modify: `docs/superpowers/plans/2026-09-03-protected-content.md`
- Modify as required by measured output: `scripts/check-built-site.ts`
- Modify if rendered UI changes: `tests/e2e/visual.spec.ts-snapshots/*`

**Interfaces:**
- README 写作流程只要求在 `.private-content` 中编辑、提交和 push。
- README 列出三个 secret 名称、私有仓库目录结构、key 更换和构建失败排查。
- AGENTS 增加禁止把私密内容复制回公开仓库、locked 正文远程图片和直接更新密文基线的规则。

- [ ] **Step 1: 按 humanizer-zh 更新长期文档**

文档给出完整 frontmatter：`locked: false`，说明封面公开、正文图片必须相对引用私有仓库文件，说明 `.env.local` 的 `HATRIX_ADMIN_KEY` 不得提交，并记录自动部署链路和纯静态限制。

- [ ] **Step 2: 运行全量验证**

Run: `corepack pnpm test:run`

Expected: 所有 Vitest 测试通过。

Run: `corepack pnpm check`

Expected: 0 errors。

Run: `corepack pnpm check:images`

Expected: 图片 inventory 通过。

Run: `corepack pnpm build`

Expected: 构建完成且 `check:protected` 通过。

Run: `corepack pnpm check:site`

Expected: 所有旧路径、CNAME、notice 和实际站内链接计数通过。

Run: `corepack pnpm test:e2e`

Expected: 全部 Chromium 项目通过；视觉差异仅在已审查的锁 UI 基线中出现。

- [ ] **Step 3: 做规格覆盖自审和代码审查**

逐条核对设计文档的内容仓库、加密、图片、错误反馈、冷却、直达 URL、凭据、索引、部署和限制。运行 `git diff --check`，确认 feature branch 没有 `.env.local`、key、`.private-content`、`dist` 或报告文件。

- [ ] **Step 4: 提交文档并启动预览**

Commit: `docs: document protected content workflow`

Run: `$env:HATRIX_ADMIN_KEY='本机至少八字符的测试值'; corepack pnpm dev --host 127.0.0.1`

Expected: `http://127.0.0.1:4321/` 可访问，进程保持运行。
