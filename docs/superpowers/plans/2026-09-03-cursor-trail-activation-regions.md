# Cursor Trail Activation Regions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把鼠标轨迹限制在正文主体高度内的左右留白区，并让每次离区、换侧或同侧重入都从新坐标起笔。

**Architecture:** 横向边界继续读取 `[data-content-boundary]`，纵向边界读取普通页的 `<main>` 或文章页的 `[data-cursor-trail-region]`。纯逻辑函数把指针分类为 `left | right | null`；运行时保存当前区域，区域变化时替换弹簧节点状态，但不清除 Canvas 中已经画出的像素，让旧线自然淡出。

**Tech Stack:** Astro 7、TypeScript 5、Canvas 2D、Vitest 4、Playwright 1.62

## Global Constraints

- Node 版本固定为 24，命令通过 Corepack 管理的 pnpm 执行。
- 保持纯静态输出，不增加依赖，不改文章正文、公开 URL 或视觉基线图片。
- Hero、文章封面、WaveDivider、整个页脚和打开的 PhotoSwipe 都不得生成轨迹。
- 同一侧曲线可以因弹簧弯曲自然伸入正文；禁止的是离区或左右切换造成的节点目标连接线。
- 切区时保留旧 Canvas 像素并让其淡出，不增加多轨迹数组。
- 继续支持 60 FPS 固定步长、DPR、reduced motion、非精细指针和 Astro 客户端导航。
- 另有 Codex 会话使用同一仓库；每次编辑和提交前检查 HEAD/status，禁止覆盖范围外改动。

---

### Task 1: 二维区域分类

**Files:**
- Modify: `src/lib/cursor-trail.ts`
- Modify: `tests/unit/cursor-trail.test.ts`

**Interfaces:**
- Produces: `TrailRegion`、`TrailRegionBounds`、`classifyTrailRegion(clientX, clientY, bounds)`。
- Keeps temporarily: `isPointerInGutter` 继续供尚未迁移的运行时调用，Task 2 完成迁移后再删除。

- [ ] **Step 1: 写失败测试**

把旧的 gutter 布尔测试换成：

```ts
import {
  TRAIL_SETTINGS,
  advanceTrailFrameClock,
  advanceTrailHue,
  classifyTrailRegion,
  createTrailState,
  setTrailTarget,
  updateTrailState,
} from '../../src/lib/cursor-trail';

it('classifies only the vertical content gutters as trail regions', () => {
  const bounds = { left: 130, right: 1310, top: 200, bottom: 800 };

  expect(classifyTrailRegion(129, 200, bounds)).toBe('left');
  expect(classifyTrailRegion(1311, 800, bounds)).toBe('right');
  expect(classifyTrailRegion(130, 400, bounds)).toBeNull();
  expect(classifyTrailRegion(720, 400, bounds)).toBeNull();
  expect(classifyTrailRegion(1310, 400, bounds)).toBeNull();
  expect(classifyTrailRegion(129, 199, bounds)).toBeNull();
  expect(classifyTrailRegion(1311, 801, bounds)).toBeNull();
});
```

- [ ] **Step 2: 确认 RED**

Run: `corepack pnpm vitest run tests/unit/cursor-trail.test.ts`

Expected: FAIL，`classifyTrailRegion` 尚未导出。

- [ ] **Step 3: 实现二维分类**

在 `src/lib/cursor-trail.ts` 末尾增加下面的接口，同时保留现有 `isPointerInGutter`：

```ts
export type TrailRegion = 'left' | 'right' | null;

export type TrailRegionBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function classifyTrailRegion(
  clientX: number,
  clientY: number,
  bounds: TrailRegionBounds,
): TrailRegion {
  if (clientY < bounds.top || clientY > bounds.bottom) return null;
  if (clientX < bounds.left) return 'left';
  if (clientX > bounds.right) return 'right';
  return null;
}
```

- [ ] **Step 4: 确认 GREEN 和全量单测**

Run: `corepack pnpm vitest run tests/unit/cursor-trail.test.ts`

Expected: PASS，7 tests passed。

Run: `corepack pnpm test:run`

Expected: exit 0，所有单测通过。

- [ ] **Step 5: 提交纯逻辑**

```powershell
git add -- src/lib/cursor-trail.ts tests/unit/cursor-trail.test.ts
git commit -m "feat: classify cursor trail activation regions"
```

---

### Task 2: 正文高度门控与独立区域会话

**Files:**
- Modify: `src/lib/cursor-trail.ts`
- Modify: `src/layouts/PostLayout.astro`
- Modify: `src/scripts/cursor-trail.ts`
- Modify: `tests/e2e/cursor-trail.spec.ts`
- Modify: `tests/unit/cursor-trail.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `classifyTrailRegion` 与 `TrailRegion`。
- Produces: 文章页 `[data-cursor-trail-region]` 纵向探针；普通页读取原生 `<main>`。
- Removes: 运行时迁移完成后删除 `isPointerInGutter` 和临时兼容测试。

- [ ] **Step 1: 增加通用测试坐标和矩形像素工具**

在 E2E 文件中增加可见正文区域坐标。所有需要有效轨迹的旧测试都改用它，不能继续使用 Hero 内的固定 y：

```ts
async function activationGeometry(page: Page) {
  const horizontal = await page.locator('[data-content-boundary]').boundingBox();
  const region = page.locator('main, [data-cursor-trail-region]').first();
  await region.scrollIntoViewIfNeeded();
  const vertical = await region.boundingBox();
  const viewport = page.viewportSize();
  if (!horizontal || !vertical || !viewport) throw new Error('Missing cursor trail geometry');
  const visibleTop = Math.max(0, vertical.y);
  const visibleBottom = Math.min(viewport.height, vertical.y + vertical.height);
  if (visibleBottom <= visibleTop) throw new Error('Cursor trail region is outside the viewport');
  return {
    leftX: Math.max(8, horizontal.x - 24),
    rightX: Math.min(viewport.width - 8, horizontal.x + horizontal.width + 24),
    centerX: horizontal.x + horizontal.width / 2,
    y: (visibleTop + visibleBottom) / 2,
    content: { left: horizontal.x, right: horizontal.x + horizontal.width }
  };
}
```

导入 `type Page`。新增矩形像素 helper：

```ts
const alphaPixelsInRect = (
  canvas: HTMLCanvasElement,
  area: { left: number; right: number; top: number; bottom: number }
) => {
  const context = canvas.getContext('2d');
  if (!context) return -1;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const left = Math.max(0, Math.floor((area.left - rect.left) * scaleX));
  const right = Math.min(canvas.width, Math.ceil((area.right - rect.left) * scaleX));
  const top = Math.max(0, Math.floor((area.top - rect.top) * scaleY));
  const bottom = Math.min(canvas.height, Math.ceil((area.bottom - rect.top) * scaleY));
  const data = context.getImageData(left, top, right - left, bottom - top).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] > 0) count += 1;
  return count;
};
```

该 helper 只读取 CursorTrail Canvas。

- [ ] **Step 2: 写顶部、底部、灯箱和区域切换失败测试**

新增或替换以下场景：

```ts
test('hero and footer gutters do not create trails', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const horizontal = await page.locator('[data-content-boundary]').boundingBox();
  const hero = await page.locator('[data-hero]').boundingBox();
  if (!horizontal || !hero) throw new Error('Missing page regions');
  const x = Math.max(8, horizontal.x - 24);
  await page.mouse.move(x, hero.y + hero.height / 2);
  await page.waitForTimeout(150);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);

  await page.locator('[data-site-footer]').scrollIntoViewIfNeeded();
  const footer = await page.locator('[data-site-footer]').boundingBox();
  if (!footer) throw new Error('Missing footer');
  await page.mouse.move(x, Math.max(8, footer.y + Math.min(footer.height / 2, 120)));
  await page.waitForTimeout(150);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);
});

test('switching gutters starts a new trail without a content bridge', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: 0, right: geometry.content.left }))
    .toBeGreaterThan(0);

  await page.mouse.move(geometry.rightX, geometry.y - 40);
  await page.mouse.move(geometry.rightX, geometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: geometry.content.right, right: 1440 }))
    .toBeGreaterThan(0);
  expect(await canvas.evaluate(contentAlphaPixels, geometry.content)).toBe(0);
});
```

文章灯箱测试：

```ts
test('an open image lightbox blocks the trail', async ({ page }) => {
  await page.goto('/posts/本科数学大杂烩/');
  const canvas = page.locator('[data-cursor-trail]');
  await page.locator('article img').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
  const horizontal = await page.locator('[data-content-boundary]').boundingBox();
  const viewport = page.viewportSize();
  if (!horizontal || !viewport) throw new Error('Missing lightbox geometry');
  const x = Math.max(8, horizontal.x - 24);
  await page.mouse.move(x, viewport.height / 2 - 40);
  await page.mouse.move(x, viewport.height / 2 + 40);
  await page.waitForTimeout(150);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('.pswp')).toBeHidden();
  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: 0, right: geometry.content.left }))
    .toBeGreaterThan(0);
});
```

同侧离区重入测试：

```ts
test('leaving and re-entering one gutter starts a disconnected trail', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 80);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: 0, right: geometry.content.left }))
    .toBeGreaterThan(0);

  await page.mouse.move(geometry.centerX, geometry.y);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await page.mouse.move(geometry.leftX, geometry.y + 80);
  await expect.poll(() => canvas.evaluate(alphaPixelsInRect, {
    left: geometry.leftX - 12,
    right: geometry.leftX + 12,
    top: geometry.y + 35,
    bottom: geometry.y + 85
  })).toBeGreaterThan(0);
  expect(await canvas.evaluate(alphaPixelsInRect, {
    left: geometry.leftX - 12,
    right: geometry.leftX + 12,
    top: geometry.y - 20,
    bottom: geometry.y + 20
  })).toBe(0);
});
```

- [ ] **Step 3: 确认 E2E RED**

Run: `corepack pnpm playwright test tests/e2e/cursor-trail.spec.ts --project=desktop-1440`

Expected: FAIL。Hero/footer 当前会绘制；左侧直接跳右侧会在正文带留下像素；文章页缺少纵向探针。

- [ ] **Step 4: 标记文章正文区域**

在 `PostLayout.astro` 只修改 `.post-grid` 开始标签：

```astro
<div class="post-grid container" data-cursor-trail-region>
```

- [ ] **Step 5: 实现区域状态转换**

把运行时导入改为 `classifyTrailRegion` 和 `type TrailRegion`，删除 `isPointerInGutter`。增加：

```ts
let activeRegion: TrailRegion = null;

function pointerRegion(event: PointerEvent): TrailRegion {
  if (document.querySelector('.pswp--open')) return null;
  const horizontal = document.querySelector<HTMLElement>('[data-content-boundary]');
  const vertical = document.querySelector<HTMLElement>('main, [data-cursor-trail-region]');
  if (!horizontal || !vertical) return null;
  const horizontalBounds = horizontal.getBoundingClientRect();
  const verticalBounds = vertical.getBoundingClientRect();
  return classifyTrailRegion(event.clientX, event.clientY, {
    left: horizontalBounds.left,
    right: horizontalBounds.right,
    top: verticalBounds.top,
    bottom: verticalBounds.bottom
  });
}
```

`clearTrail()` 同时执行 `activeRegion = null`。指针处理改成：

```ts
function handlePointerMove(event: PointerEvent): void {
  if (!canvas || !context || !isEnabled()) return;
  const nextRegion = pointerRegion(event);
  if (nextRegion === null) {
    activeRegion = null;
    return;
  }
  if (!state || activeRegion !== nextRegion) state = createTrailState(event.clientX, event.clientY);
  else setTrailTarget(state, event.clientX, event.clientY);
  activeRegion = nextRegion;
  lastPointerInput = performance.now();
  canvas.dataset.cursorTrailState = 'active';
  startTrail();
}
```

换区时不能调用 `clearTrail()`，否则旧残影会突然消失。旧 state 被替换后不再重画，已有像素由 `destination-out` 淡出。

- [ ] **Step 6: 确认专用测试 GREEN**

Run: `corepack pnpm playwright test tests/e2e/cursor-trail.spec.ts --project=desktop-1440`

Expected: exit 0。旧的“跨正文连接”断言已删除；Hero、footer、PhotoSwipe、左右独立、同侧重入与全部既有能力测试通过。

- [ ] **Step 7: 运行类型和全量验证**

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm build
corepack pnpm check:site
corepack pnpm test:e2e
```

Expected: 所有命令 exit 0；图片仍为 254/254，构建 67 页，站内链接总数按当前主分支检查器通过，视觉 PNG 无修改。

- [ ] **Step 8: 提交区域门控**

```powershell
git add -- src/layouts/PostLayout.astro src/scripts/cursor-trail.ts tests/e2e/cursor-trail.spec.ts
git commit -m "fix: isolate cursor trail activation regions"
```

- [ ] **Step 9: 重启本地预览**

运行 `corepack pnpm dev --host 127.0.0.1`，保持 `http://127.0.0.1:4321/` 可访问。
