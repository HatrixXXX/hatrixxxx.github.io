# Compact Legal Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为全站增加一条只含版权、第三方许可和可选备案链接的极简页脚。

**Architecture:** `BaseLayout.astro` 统一挂载 `SiteFooter.astro`。页脚从 `SITE.filings` 读取真实备案信息；数组为空时不生成备案文字或链接。

**Tech Stack:** Astro 7、TypeScript、Playwright、Vitest、pnpm

## Global Constraints

- 保持 Astro 纯静态输出，不增加客户端脚本。
- 不添加虚构 ICP、公安备案号或项目开源许可证。
- 不恢复头像、站点简介、社交链接、随机文章或最近更新。
- Node 版本固定为 24，命令通过 Corepack 管理的 pnpm 执行。
- 不改其他会话正在处理的鼠标拖尾文件。

---

### Task 1: 增加极简法律页脚

**Files:**
- Create: `src/components/SiteFooter.astro`
- Modify: `src/config/site.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `tests/e2e/shell.spec.ts`
- Modify: `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `SITE.author.name` 和 `SITE.filings: readonly { label: string; url: string }[]`。
- Produces: 每个页面一个 `footer[data-site-footer]`，其中始终有第三方许可链接，备案链接标记为 `data-site-filing`。

- [ ] **Step 1: 写出失败的页脚测试**

将 `tests/e2e/shell.spec.ts` 的首个测试改为：

```ts
test('home shell renders the compact legal footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header[data-site-header]')).toBeVisible();
  await expect(page.locator('[data-hero]')).toBeVisible();
  await expect(page.locator('[data-wave-divider]')).toBeVisible();

  const footer = page.locator('footer[data-site-footer]');
  await expect(footer).toHaveCount(1);
  await expect(footer).toContainText(`© 2025–${new Date().getFullYear()} Hatrix`);
  await expect(footer.getByRole('link', { name: '第三方许可' })).toHaveAttribute(
    'href',
    '/third-party-notices.txt'
  );
  await expect(footer.locator('[data-site-filing]')).toHaveCount(0);
});
```

将 `tests/e2e/home.spec.ts` 的页脚测试改为：

```ts
test('site footer stays compact on home and paginated pages', async ({ page }) => {
  for (const path of ['/', '/page/2/']) {
    await page.goto(path);
    const footer = page.locator('footer[data-site-footer]');
    await expect(footer).toBeVisible();
    await expect(footer.locator('section, img, li')).toHaveCount(0);
    const bounds = await footer.boundingBox();
    expect(bounds?.height).toBeLessThan(64);
  }
});
```

- [ ] **Step 2: 运行测试并确认页脚缺失**

Run: `corepack pnpm exec playwright test tests/e2e/shell.spec.ts tests/e2e/home.spec.ts --project desktop-1440`

Expected: FAIL，`footer[data-site-footer]` 的实际数量为 `0`。

- [ ] **Step 3: 增加备案配置**

在 `src/config/site.ts` 的 `socials` 后加入：

```ts
  filings: [] as readonly { label: string; url: string }[],
```

- [ ] **Step 4: 创建页脚组件**

创建 `src/components/SiteFooter.astro`：

```astro
---
import { SITE } from '@/config/site';

const firstYear = 2025;
const currentYear = new Date().getFullYear();
const copyrightYears = currentYear > firstYear ? `${firstYear}–${currentYear}` : `${firstYear}`;
---

<footer data-site-footer class="site-footer">
  <p class="footer-line container">
    <span>© {copyrightYears} {SITE.author.name}</span>
    <span aria-hidden="true">·</span>
    <span>保留所有权利</span>
    <span aria-hidden="true">·</span>
    <a href="/third-party-notices.txt">第三方许可</a>
    {
      SITE.filings.map((filing) => (
        <>
          <span aria-hidden="true">·</span>
          <a href={filing.url} target="_blank" rel="noreferrer" data-site-filing>{filing.label}</a>
        </>
      ))
    }
  </p>
</footer>

<style>
  .site-footer {
    border-top: 1px solid var(--color-line);
    color: var(--color-muted);
  }

  .footer-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    margin-block: 0;
    padding-block: 0.65rem 0.75rem;
    font-size: 0.72rem;
    line-height: 1.5;
    text-align: center;
  }

  a {
    transition: color 160ms ease;
  }

  a:hover {
    color: var(--color-accent);
  }
</style>
```

- [ ] **Step 5: 挂载页脚**

在 `src/layouts/BaseLayout.astro` 导入：

```astro
import SiteFooter from '@/components/SiteFooter.astro';
```

并在 `<slot />` 后挂载：

```astro
<SiteFooter />
```

- [ ] **Step 6: 运行相关 E2E 测试**

Run: `corepack pnpm exec playwright test tests/e2e/shell.spec.ts tests/e2e/home.spec.ts --project desktop-1440`

Expected: PASS，页脚高度低于 64 像素，且没有旧页脚内容。

- [ ] **Step 7: 提交功能改动**

```powershell
git add -- src/components/SiteFooter.astro src/config/site.ts src/layouts/BaseLayout.astro tests/e2e/shell.spec.ts tests/e2e/home.spec.ts
git commit -m "feat: add compact legal footer"
```

### Task 2: 同步构建统计和视觉基线

**Files:**
- Modify: `scripts/check-built-site.ts`
- Modify: `tests/e2e/visual.spec.ts-snapshots/*.png`

**Interfaces:**
- Consumes: Task 1 生成的页脚和 `/third-party-notices.txt` 链接。
- Produces: 与极简页脚一致的站内链接统计和 18 张 Windows 视觉基线。

- [ ] **Step 1: 执行静态检查和构建**

Run: `corepack pnpm test:run`

Expected: PASS。

Run: `corepack pnpm check`

Expected: PASS，0 errors。

Run: `corepack pnpm build`

Expected: PASS，生成 67 个 HTML 页面并保留 `dist/third-party-notices.txt`。

- [ ] **Step 2: 确认旧链接总数断言失败**

Run: `corepack pnpm check:site`

Expected: FAIL，报告 `Expected 3961 local links, found 4028.`，且不报告断链。

- [ ] **Step 3: 更新精确链接总数**

将 `scripts/check-built-site.ts` 中的常量改为：

```ts
const EXPECTED_LOCAL_LINKS = 4028;
```

- [ ] **Step 4: 重跑站点检查**

Run: `corepack pnpm check:site`

Expected: PASS，输出 `Checked 4028 local links`。

- [ ] **Step 5: 更新并验证视觉基线**

Run: `corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots`

Expected: PASS，更新 18 张无平台后缀的 Windows 基线。

Run: `corepack pnpm test:e2e`

Expected: PASS，当次收集到的全部测试均无失败。

- [ ] **Step 6: 检查改动边界并提交**

Run: `git diff --check`

Expected: 无输出，退出码为 0。

只暂存链接统计和 18 张视觉基线：

```powershell
git add -- scripts/check-built-site.ts tests/e2e/visual.spec.ts-snapshots
git commit -m "test: update compact footer baselines"
```

### Task 3: 从页脚移除第三方许可入口

**Files:**
- Modify: `src/components/SiteFooter.astro`
- Modify: `tests/e2e/shell.spec.ts`
- Modify: `scripts/check-built-site.ts`
- Modify: `tests/e2e/visual.spec.ts-snapshots/*.png`

**Interfaces:**
- Consumes: 已发布的 `/third-party-notices.txt` 文件。
- Produces: 页脚不再链接说明文件，但构建产物仍包含该文件。

- [ ] **Step 1: 写出失败的链接移除测试**

将 `tests/e2e/shell.spec.ts` 中的第三方许可链接断言替换为：

```ts
await expect(footer.getByRole('link', { name: '第三方许可' })).toHaveCount(0);
const notices = await page.request.get('/third-party-notices.txt');
expect(notices.ok()).toBe(true);
```

- [ ] **Step 2: 确认测试因现有链接而失败**

Run: `corepack pnpm exec playwright test tests/e2e/shell.spec.ts --project desktop-1440`

Expected: FAIL，“第三方许可”链接的实际数量为 `1`。

- [ ] **Step 3: 删除页脚链接**

从 `src/components/SiteFooter.astro` 删除：

```astro
<span aria-hidden="true">·</span>
<a href="/third-party-notices.txt">第三方许可</a>
```

- [ ] **Step 4: 运行相关测试**

Run: `corepack pnpm exec playwright test tests/e2e/shell.spec.ts tests/e2e/home.spec.ts --project desktop-1440`

Expected: PASS，页脚没有第三方许可链接，说明文件仍可请求。

- [ ] **Step 5: 同步构建统计与视觉基线**

Run: `corepack pnpm test:run`

Expected: PASS。

Run: `corepack pnpm check`

Expected: PASS，0 errors。

Run: `corepack pnpm build`

Expected: PASS，构建 67 个页面。

将 `scripts/check-built-site.ts` 中的链接总数改回：

```ts
const EXPECTED_LOCAL_LINKS = 3961;
```

Run: `corepack pnpm check:site`

Expected: PASS，输出 `Checked 3961 local links`。

Run: `corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots`

Expected: PASS，更新 18 张视觉基线。

Run: `corepack pnpm test:e2e`

Expected: PASS，当次收集的全部测试均无失败。

- [ ] **Step 6: 提交**

```powershell
git add -- src/components/SiteFooter.astro tests/e2e/shell.spec.ts scripts/check-built-site.ts tests/e2e/visual.spec.ts-snapshots
git commit -m "refactor: hide third-party notice link"
```
