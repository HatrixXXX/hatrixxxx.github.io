# 非首页 Banner 压缩实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将所有非首页页面的顶部图片统一压缩为桌面和平板 `240px`、手机 `200px`，删除全站波浪分隔，并保持首页 Banner 高度不变。

**Architecture:** 在 `tokens.css` 中维护唯一的非首页 Banner 高度变量，普通页面的 `HeroBanner` 紧凑模式和文章详情页共同引用。文章页把面包屑、摘要和文章信息移到图片下方，图片内只保留标题。删除首页的 `WaveDivider` 调用和不再使用的组件。

**Tech Stack:** Astro 7、TypeScript、CSS、Playwright、Vitest、pnpm

## Global Constraints

- Node 版本固定为 24，命令使用 Corepack 管理的 pnpm。
- 保持纯静态输出，不改文章正文、`legacySlug`、Giscus pathname 映射或导航结构。
- 首页 Banner 高度保持现状，全站不再渲染波浪。
- 不修改与本任务无关的并发工作；每次写入和提交前重新检查目标文件差异。
- 不提交 `dist/`、`.astro/`、`reports/`、`test-results/` 或 Playwright trace。

---

### Task 1: 用 E2E 固定非首页 Banner 契约

**Files:**
- Create: `tests/e2e/banner.spec.ts`

**Interfaces:**
- Consumes: 页面现有的 `[data-hero]`、`.post-hero` 和 `[data-wave-divider]` 标记。
- Produces: 非首页高度、页面间等高、全站波浪移除和首页高度不变的回归保护。

- [ ] **Step 1: 写失败测试**

新增两个 Playwright 测试：

```ts
import { expect, test } from '@playwright/test';

test('home keeps its full hero without a wave divider', async ({ page }) => {
  await page.goto('/');
  expect((await page.locator('[data-hero]').boundingBox())?.height).toBeGreaterThan(240);
  await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
});

test('non-home banners share the compact height without a wave divider', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900, bannerHeight: 240 },
    { width: 390, height: 844, bannerHeight: 200 }
  ]) {
    await page.setViewportSize(viewport);
    const heights: number[] = [];

    for (const route of ['/blog/', '/posts/本科数学大杂烩/']) {
      await page.goto(route);
      const banner = page.locator('[data-hero], .post-hero').first();
      heights.push((await banner.boundingBox())?.height ?? 0);
      await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
    }

    expect(heights).toEqual([viewport.bannerHeight, viewport.bannerHeight]);
  }
});
```

- [ ] **Step 2: 运行测试并确认失败原因**

Run: `corepack pnpm exec playwright test tests/e2e/banner.spec.ts --project=desktop-1440`

Expected: 首页测试因仍有 `[data-wave-divider]` 而失败；非首页测试因 `/blog/` 高于 `240px`，或仍有波浪而失败。

---

### Task 2: 统一普通页面和文章页的图片高度

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/components/HeroBanner.astro`
- Modify: `src/layouts/PostLayout.astro`
- Modify: `src/pages/about.astro`
- Modify: `src/pages/about/[section].astro`
- Modify: `src/pages/archives/index.astro`
- Modify: `src/pages/blog/index.astro`
- Modify: `src/pages/blog/[type].astro`
- Modify: `src/pages/guestbook.astro`
- Modify: `src/pages/page/[page].astro`
- Modify: `src/pages/projects/index.astro`
- Modify: `src/pages/404.astro`
- Modify: `src/pages/index.astro`
- Delete: `src/components/WaveDivider.astro`
- Test: `tests/e2e/banner.spec.ts`

**Interfaces:**
- Consumes: `--header-height`、`HeroBanner` 的 `compact` 属性、现有文章数据和组件。
- Produces: `--inner-page-banner-height`；所有非首页页面在相同视口下使用同一图片高度。

- [ ] **Step 1: 添加共享高度变量**

在 `src/styles/tokens.css` 的 `:root` 中加入：

```css
--inner-page-banner-height: 240px;
```

在文件末尾加入移动端覆盖：

```css
@media (max-width: 768px) {
  :root {
    --inner-page-banner-height: 200px;
  }
}
```

- [ ] **Step 2: 收紧 `HeroBanner` 的紧凑模式**

普通 `.hero` 规则不动。紧凑模式使用共享高度并缩小内容：

```css
.hero--compact {
  height: var(--inner-page-banner-height);
}

.hero--compact .hero-content {
  padding-block: calc(var(--header-height) + 1rem) 1rem;
}

.hero--compact h1 {
  font-size: clamp(1.8rem, 5vw, 3.2rem);
}
```

- [ ] **Step 3: 普通非首页启用紧凑模式并删除波浪**

为博客列表和文章类型页补上 `compact`。从所有页面删除 `WaveDivider` 导入与 `<WaveDivider />`，然后删除不再使用的组件。

- [ ] **Step 4: 压缩文章详情图片并移动辅助信息**

文章图片 Header 增加 `data-hero`，图片中只保留标题：

```astro
<header class="post-hero" data-hero>
  <img src={post.data.cover} alt="" width="1600" height="900" decoding="async" />
  <div class="post-hero-overlay"></div>
  <div class="post-hero-content container">
    <h1>{post.data.title}</h1>
  </div>
</header>
<div class="post-intro container">
  <Breadcrumbs title={post.data.title} />
  <p>{post.data.description}</p>
  <PostMeta post={post} />
</div>
```

对应样式：

```css
.post-hero {
  height: var(--inner-page-banner-height);
  min-height: 0;
}

.post-hero-content {
  padding-block: calc(var(--header-height) + 1rem) 1rem;
}

.post-intro {
  padding-top: 1.5rem;
  text-align: center;
}

.post-intro > p {
  max-width: 720px;
  margin: 0.75rem auto;
  color: var(--color-muted);
}

.post-intro :global(.breadcrumbs ol),
.post-intro :global(.post-meta) {
  color: var(--color-muted);
}
```

- [ ] **Step 5: 运行目标 E2E 并确认转绿**

Run: `corepack pnpm exec playwright test tests/e2e/banner.spec.ts tests/e2e/post.spec.ts tests/e2e/index-pages.spec.ts --project=desktop-1440`

Expected: 全部通过。

- [ ] **Step 6: 检查并发差异后提交功能**

先运行 `git status --short` 和本任务文件的 `git diff`。确认无误后只暂存 Task 2 列出的代码和测试文件，提交信息使用 `style: compact inner page banners`。

---

### Task 3: 更新视觉基线并完成全量验证

**Files:**
- Modify: `tests/e2e/visual.spec.ts-snapshots/-blog--*.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/-posts-本科数学大杂烩--*.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/-archives--*.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/-projects--*.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/-404-html-*.png`

**Interfaces:**
- Consumes: Task 2 完成后的页面布局。
- Produces: 桌面、平板和手机下共 18 张视觉基线，首页截图反映波浪移除，其他页面反映窄 Banner。

- [ ] **Step 1: 更新视觉基线**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Expected: 更新 18 张截图，包括移除首页波浪后的 `home-*.png`。

- [ ] **Step 2: 检查截图差异**

逐张查看桌面、平板和手机截图。图片应等高，正文不被遮挡，文章标题不溢出，非首页不再出现波浪。

- [ ] **Step 3: 运行完整验证**

依次运行：

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm build
corepack pnpm check:site
corepack pnpm test:e2e
```

Expected: 所有命令退出码为 `0`。若站内链接总数只因其他会话的并发改动变化，先核对对方改动，不在本任务中擅自修改期望值。

- [ ] **Step 4: 提交视觉基线**

检查 `git status --short`，只暂存本任务改变的 18 张图片，提交信息使用 `test: update compact banner snapshots`。

- [ ] **Step 5: 启动本地预览**

Run: `corepack pnpm dev --host 127.0.0.1`

Expected: Astro 在 `http://127.0.0.1:4321/` 提供开发预览，并在交付后保持运行。
