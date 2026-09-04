# Cursor Trail Blog Exclusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/blog/` 菜单页和全部文章类型二级页隐藏并禁用鼠标轨迹，同时保留其他页面的现有多会话行为。

**Architecture:** 纯逻辑函数按 pathname 判断整个 `/blog` 路由树。运行时把路径禁用加入能力判断，并在 `astro:page-load` 同步 Canvas 的 `hidden` 状态；进入禁用路由时硬清，离开后显示空 Canvas。组件继续全站挂载，避免 Astro persisted Canvas 在条件渲染时产生生命周期歧义。

**Tech Stack:** Astro 7、TypeScript 5、Canvas 2D、Vitest 4、Playwright 1.62

## Global Constraints

- 禁用范围是 `/blog`、`/blog/` 和所有 `/blog/...` 路径；`/posts/...`、`/page/...`、`/projects/` 与其他页面不受影响。
- 博客禁用页不得显示旧轨迹，也不得接受新输入；进入时允许立即硬清。
- 离开博客页后只恢复空 Canvas，不能自动生成轨迹。
- 其他允许页面之间的多会话、350ms 可见度、24 帧尾衰减、区域门控、DPR 和无障碍逻辑保持不变。
- 不条件移除 `CursorTrail.astro`，不增加依赖，不修改视觉基线。
- 另有 Codex 会话使用同一仓库；编辑和提交前检查 HEAD/status，不覆盖范围外改动。

---

### Task 1: 禁用博客路由树

**Files:**
- Modify: `src/lib/cursor-trail.ts`
- Modify: `src/scripts/cursor-trail.ts`
- Modify: `tests/unit/cursor-trail.test.ts`
- Modify: `tests/e2e/cursor-trail.spec.ts`

**Interfaces:**
- Produces: `isCursorTrailExcludedPathname(pathname: string): boolean`。
- Runtime consumes: `location.pathname` on every capability check and `astro:page-load`。

- [ ] **Step 1: 写 pathname 失败测试**

```ts
it('excludes the blog menu tree without excluding posts or other pages', () => {
  expect(isCursorTrailExcludedPathname('/blog')).toBe(true);
  expect(isCursorTrailExcludedPathname('/blog/')).toBe(true);
  expect(isCursorTrailExcludedPathname('/blog/tech-notes/')).toBe(true);
  expect(isCursorTrailExcludedPathname('/blog/essays/')).toBe(true);
  expect(isCursorTrailExcludedPathname('/posts/example/')).toBe(false);
  expect(isCursorTrailExcludedPathname('/page/2/')).toBe(false);
  expect(isCursorTrailExcludedPathname('/projects/')).toBe(false);
  expect(isCursorTrailExcludedPathname('/blogger/')).toBe(false);
});
```

在现有 import 中加入 `isCursorTrailExcludedPathname`。

- [ ] **Step 2: 写真实页面失败测试**

从 `src/config/navigation.ts` 导入 `POST_TYPE_LINKS`，建立：

```ts
const disabledBlogRoutes = ['/blog/', ...POST_TYPE_LINKS.map(({ href }) => href)];
```

新增测试：

```ts
test('blog menu routes hide and disable the cursor trail', async ({ page }) => {
  for (const path of disabledBlogRoutes) {
    await page.goto(path);
    const canvas = page.locator('[data-cursor-trail]');
    await expect(canvas).toBeHidden();
    const horizontal = await page.locator('[data-content-boundary]').boundingBox();
    const main = await page.locator('main').boundingBox();
    const viewport = page.viewportSize();
    if (!horizontal || !main || !viewport) throw new Error(`Missing geometry for ${path}`);
    const visibleTop = Math.max(8, main.y);
    const visibleBottom = Math.min(viewport.height - 8, main.y + main.height);
    const y = (visibleTop + visibleBottom) / 2;
    const x = Math.max(8, horizontal.x - 24);
    await page.mouse.move(x, y - 40);
    await page.mouse.move(x, y + 40);
    await waitForAnimationFrames(page);
    expect(await canvas.evaluate(alphaPixels)).toBe(0);
  }

  await page.goto('/projects/');
  const canvas = page.locator('[data-cursor-trail]');
  await expect(canvas).toBeVisible();
  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels)).toBeGreaterThan(0);
});

test('entering a blog menu clears existing trails until an allowed route resumes', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const oldGeometry = await activationGeometry(page);
  await page.mouse.move(oldGeometry.leftX, oldGeometry.y - 80);
  await page.mouse.move(oldGeometry.leftX, oldGeometry.y + 80);
  await expect.poll(() => canvas.evaluate(alphaPixels)).toBeGreaterThan(0);

  await Promise.all([
    page.waitForURL(/\/blog\/$/),
    page.getByRole('link', { name: '博客文章', exact: true }).click()
  ]);
  await expect(page.locator('[data-blog-total]')).toHaveText('40');
  await expect(canvas).toBeHidden();
  expect(await canvas.evaluate(alphaPixels)).toBe(0);

  await Promise.all([
    page.waitForURL((url) => url.pathname === '/'),
    page.getByRole('link', { name: '首页', exact: true }).click()
  ]);
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate(alphaPixels)).toBe(0);
  const resumedGeometry = await activationGeometry(page);
  await page.mouse.move(resumedGeometry.rightX, resumedGeometry.y - 40);
  await page.mouse.move(resumedGeometry.rightX, resumedGeometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels)).toBeGreaterThan(0);
});
```

- [ ] **Step 3: 调整允许路由间的 persisted 测试**

现有测试不能再从 `/` 导航到 `/blog/` 后要求旧轨迹保留。把目标改成 `/projects/`：

```ts
await Promise.all([
  page.waitForURL(/\/projects\/$/),
  page.getByRole('link', { name: '作品橱窗', exact: true }).click()
]);
await expect(page.locator('main.projects-main')).toBeVisible();
```

其余同节点、旧 alpha 保留并自然归零、新页面重新绘制断言继续保留。

- [ ] **Step 4: 确认 RED**

Run: `corepack pnpm vitest run tests/unit/cursor-trail.test.ts`

Expected: FAIL，路径函数尚未导出。

Run: `corepack pnpm playwright test tests/e2e/cursor-trail.spec.ts --project=desktop-1440`

Expected: FAIL；博客页 Canvas 当前可见且能生成轨迹，从首页进入博客后旧轨迹仍保留。

- [ ] **Step 5: 实现纯路径判定**

在 `src/lib/cursor-trail.ts` 增加：

```ts
export function isCursorTrailExcludedPathname(pathname: string): boolean {
  return pathname === '/blog' || pathname.startsWith('/blog/');
}
```

- [ ] **Step 6: 接入运行时**

导入路径函数，并把 `isEnabled()` 改为同时要求当前路径未被禁用：

```ts
function isRouteExcluded(): boolean {
  return isCursorTrailExcludedPathname(location.pathname);
}

function isEnabled(): boolean {
  return !isRouteExcluded() && !reducedMotion.matches && finePointer.matches;
}
```

`syncCanvas()` 先处理节点替换，再同步路由：

```ts
const routeExcluded = isRouteExcluded();
nextCanvas.hidden = routeExcluded;
if (routeExcluded) {
  hardResetTrail();
  return;
}
```

允许路由必须执行 `nextCanvas.hidden = false`。同一 Canvas 从博客页进入允许页时继续走现有 `resizeCanvas()`；由于博客页已硬清，恢复后保持空白直到新输入。

- [ ] **Step 7: 确认 GREEN**

```powershell
corepack pnpm vitest run tests/unit/cursor-trail.test.ts
corepack pnpm playwright test tests/e2e/cursor-trail.spec.ts --project=desktop-1440
corepack pnpm check
corepack pnpm test:run
```

Expected: 全部 exit 0；博客六个路径均禁用，允许页面多会话与导航保留测试继续通过。

- [ ] **Step 8: 项目验证与提交**

```powershell
corepack pnpm build
corepack pnpm check:site
```

Expected: 构建和站点检查通过；无视觉 PNG 修改。

提交：

```powershell
git add -- src/lib/cursor-trail.ts src/scripts/cursor-trail.ts tests/unit/cursor-trail.test.ts tests/e2e/cursor-trail.spec.ts
git commit -m "feat: disable cursor trails on blog menus"
```

- [ ] **Step 9: 预览验收**

保持 `http://127.0.0.1:4321/` 运行，确认 `/blog/` 与五个类型页没有轨迹，首页、文章页、作品页仍按原区域规则工作。
