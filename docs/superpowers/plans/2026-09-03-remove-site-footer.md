# Remove Site Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除全站页脚及其文章列表逻辑，不保留替代页脚。

**Architecture:** `BaseLayout.astro` 是页脚的唯一挂载点。移除该挂载点并删除 `SiteFooter.astro` 后，所有静态页面都不再生成页脚；测试改为直接断言全局页脚不存在。

**Tech Stack:** Astro 7、TypeScript、Playwright、Vitest、pnpm

## Global Constraints

- 保持 Astro 纯静态输出。
- 保留全部文章 URL 和 Giscus pathname 映射。
- 不改正文、导航、社交链接配置和其他会话的未提交修改。
- Node 版本固定为 24，命令通过 Corepack 管理的 pnpm 执行。

---

### Task 1: 删除页脚实现并建立回归测试

**Files:**
- Modify: `tests/e2e/shell.spec.ts`
- Modify: `tests/e2e/home.spec.ts`
- Modify: `tests/e2e/visual.spec.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Delete: `src/components/SiteFooter.astro`

**Interfaces:**
- Consumes: `BaseLayout.astro` 的全站页面骨架。
- Produces: 所有页面均不含 `footer[data-site-footer]`，也不再读取文章集合生成页脚列表。

- [ ] **Step 1: 写出失败的全站页脚断言**

将 `tests/e2e/shell.spec.ts` 的首个测试改为：

```ts
test('home shell omits the removed site footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header[data-site-header]')).toBeVisible();
  await expect(page.locator('[data-hero]')).toBeVisible();
  await expect(page.locator('[data-wave-divider]')).toBeVisible();
  await expect(page.locator('footer[data-site-footer]')).toHaveCount(0);
});
```

- [ ] **Step 2: 运行测试并确认它因现有页脚而失败**

Run: `corepack pnpm exec playwright test tests/e2e/shell.spec.ts --project desktop-1440`

Expected: FAIL，`footer[data-site-footer]` 的实际数量为 `1`。

- [ ] **Step 3: 删除最小实现和失效断言**

从 `src/layouts/BaseLayout.astro` 删除：

```astro
import SiteFooter from '@/components/SiteFooter.astro';
```

以及：

```astro
<SiteFooter />
```

删除 `src/components/SiteFooter.astro`。将 `tests/e2e/home.spec.ts` 中的 `footer exposes stable random and newest article lists` 测试替换为：

```ts
test('site footer is absent from home and paginated pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer[data-site-footer]')).toHaveCount(0);

  await page.goto('/page/2/');
  await expect(page.locator('footer[data-site-footer]')).toHaveCount(0);
});
```

删除 `tests/e2e/visual.spec.ts` 中的以下页脚随机列表断言：

```ts
const randomFooter = page.locator('[data-footer-random]');
await expect(randomFooter).toHaveAttribute('data-test-seed', 'playwright-fixed');
await expect(randomFooter.locator('li')).toHaveCount(10);
```

- [ ] **Step 4: 运行相关 E2E 测试**

Run: `corepack pnpm exec playwright test tests/e2e/shell.spec.ts tests/e2e/home.spec.ts --project desktop-1440`

Expected: PASS。

- [ ] **Step 5: 提交功能改动**

```powershell
git add -- src/layouts/BaseLayout.astro src/components/SiteFooter.astro tests/e2e/shell.spec.ts tests/e2e/home.spec.ts tests/e2e/visual.spec.ts
git commit -m "refactor: remove site footer"
```

### Task 2: 同步构建统计和视觉基线

**Files:**
- Modify: `scripts/check-built-site.ts`
- Modify: `tests/e2e/visual.spec.ts-snapshots/*.png`

**Interfaces:**
- Consumes: Task 1 生成的不含页脚的静态页面。
- Produces: 与新页面结构一致的站内链接总数和 18 张 Windows 视觉基线。

- [ ] **Step 1: 执行静态检查和构建**

Run: `corepack pnpm test:run`

Expected: PASS。

Run: `corepack pnpm check`

Expected: PASS，0 errors。

Run: `corepack pnpm build`

Expected: PASS，并生成 `dist/`。

- [ ] **Step 2: 确认旧链接总数断言失败**

Run: `corepack pnpm check:site`

Expected: FAIL，报告 `Expected 5368 local links, found 3961.`，且不报告断链。

- [ ] **Step 3: 更新精确链接总数**

将 `scripts/check-built-site.ts` 中的常量改为：

```ts
const EXPECTED_LOCAL_LINKS = 3961;
```

- [ ] **Step 4: 重跑站点检查**

Run: `corepack pnpm check:site`

Expected: PASS，输出 `Checked 3961 local links`。

- [ ] **Step 5: 更新并验证视觉基线**

Run: `corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots`

Expected: PASS，更新 18 张无平台后缀的 Windows 基线。

Run: `corepack pnpm test:e2e`

Expected: PASS，92 项检查没有失败。

- [ ] **Step 6: 检查改动边界并提交**

Run: `git diff --check`

Expected: 无输出，退出码为 0。

只暂存 `scripts/check-built-site.ts` 和 18 张视觉基线，再提交：

```powershell
git commit -m "test: update footerless site baselines"
```
