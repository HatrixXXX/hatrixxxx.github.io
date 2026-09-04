# 侧栏鼠标曲线实施计划

> 历史说明：本文记录最初的单会话实现。当前区域门控、多会话自然淡出和博客路由禁用分别以 `2026-09-03-cursor-trail-activation-regions.md`、`2026-09-04-cursor-trail-multi-session.md` 和 `2026-09-04-cursor-trail-blog-exclusion.md` 为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在全站加入参考 `kuroha.vip` 参数的弹簧贝塞尔鼠标尾迹，只允许左右留白区更新目标，同时保留跨正文绘制。

**Architecture:** 一个持久化的全屏 Canvas 负责显示；纯 TypeScript 模块保存 20×50 个节点、色相振荡器和侧栏判定；浏览器脚本只负责 DOM、媒体查询、Canvas 绘制及 Astro 生命周期。Canvas 不裁剪，正文限制只发生在 `pointermove` 的目标更新阶段。

**Tech Stack:** Astro 7、TypeScript 5、Canvas 2D、Vitest 4、Playwright 1.62

## Global Constraints

- Node 版本固定为 24，命令通过 Corepack 管理的 pnpm 执行。
- 保持纯静态输出，不添加运行时依赖、服务端或 3D 公共布局代码。
- Canvas 必须 `pointer-events: none`，层级低于页头、Sakana、音乐播放器和主题切换遮罩。
- `prefers-reduced-motion: reduce` 或非精细指针设备不启动动画。
- 只限制目标采样，不裁剪轨迹；侧栏生成的线条允许跨过正文。
- 不改文章正文、公开 URL、Giscus pathname 或视觉基线图片。

---

### Task 1: 可测试的弹簧链与区域判定

**Files:**
- Create: `src/lib/cursor-trail.ts`
- Create: `tests/unit/cursor-trail.test.ts`

**Interfaces:**
- Produces: `TRAIL_SETTINGS`、`createTrailState(x, y, random?)`、`setTrailTarget(state, x, y)`、`updateTrailState(state)`、`advanceTrailHue(state)`、`isPointerInGutter(clientX, bounds)`。
- `TrailState` 保存 `target`、`tendrils` 与 `huePhase`；Canvas 运行时只读节点并调用这些函数。

- [ ] **Step 1: 写区域、参数和动力学失败测试**

```ts
import { describe, expect, test } from 'vitest';
import {
  TRAIL_SETTINGS,
  advanceTrailHue,
  createTrailState,
  isPointerInGutter,
  setTrailTarget,
  updateTrailState
} from '@/lib/cursor-trail';

describe('cursor trail', () => {
  test('only points outside the content bounds activate a gutter', () => {
    const bounds = { left: 130, right: 1310 };
    expect(isPointerInGutter(129, bounds)).toBe(true);
    expect(isPointerInGutter(1311, bounds)).toBe(true);
    expect(isPointerInGutter(130, bounds)).toBe(false);
    expect(isPointerInGutter(720, bounds)).toBe(false);
    expect(isPointerInGutter(1310, bounds)).toBe(false);
  });

  test('builds the reference-sized tendril bundle at the pointer', () => {
    const state = createTrailState(24, 180, () => 0.5);
    expect(state.tendrils).toHaveLength(TRAIL_SETTINGS.trails);
    expect(state.tendrils.every(({ nodes }) => nodes.length === TRAIL_SETTINGS.size)).toBe(true);
    expect(state.tendrils.flatMap(({ nodes }) => nodes).every(({ x, y }) => x === 24 && y === 180)).toBe(true);
    expect(state.tendrils[0]).toMatchObject({ spring: 0.45, friction: 0.5 });
  });

  test('moves the chain toward a new target and advances the sinusoidal hue', () => {
    const state = createTrailState(0, 0, () => 0.5);
    setTrailTarget(state, 10, 0);
    updateTrailState(state);
    expect(state.tendrils[0].nodes[0].x).toBeCloseTo(2.25);
    expect(advanceTrailHue(state)).toBeCloseTo(
      TRAIL_SETTINGS.hueOffset + Math.sin(TRAIL_SETTINGS.hueFrequency) * TRAIL_SETTINGS.hueAmplitude
    );
  });
});
```

- [ ] **Step 2: 运行测试并确认因模块缺失而失败**

Run: `corepack pnpm vitest run tests/unit/cursor-trail.test.ts`

Expected: FAIL，错误包含 `Failed to load url @/lib/cursor-trail`。

- [ ] **Step 3: 实现最小纯逻辑**

```ts
export const TRAIL_SETTINGS = {
  trails: 20,
  size: 50,
  friction: 0.5,
  dampening: 0.25,
  tension: 0.98,
  hueOffset: 285,
  hueAmplitude: 85,
  hueFrequency: 0.0015
} as const;

export interface TrailNode { x: number; y: number; vx: number; vy: number }
export interface Tendril { spring: number; friction: number; nodes: TrailNode[] }
export interface TrailState {
  target: { x: number; y: number };
  tendrils: Tendril[];
  huePhase: number;
}

export function isPointerInGutter(clientX: number, bounds: { left: number; right: number }): boolean {
  return clientX < bounds.left || clientX > bounds.right;
}

export function createTrailState(x: number, y: number, random = Math.random): TrailState {
  const tendrils = Array.from({ length: TRAIL_SETTINGS.trails }, (_, index) => ({
    spring: 0.45 + 0.025 * (index / TRAIL_SETTINGS.trails) + (random() * 0.1 - 0.05),
    friction: TRAIL_SETTINGS.friction + (random() * 0.01 - 0.005),
    nodes: Array.from({ length: TRAIL_SETTINGS.size }, () => ({ x, y, vx: 0, vy: 0 }))
  }));
  return { target: { x, y }, tendrils, huePhase: 0 };
}

export function setTrailTarget(state: TrailState, x: number, y: number): void {
  state.target.x = x;
  state.target.y = y;
}

export function updateTrailState(state: TrailState): void {
  for (const tendril of state.tendrils) {
    let spring = tendril.spring;
    const first = tendril.nodes[0];
    first.vx += (state.target.x - first.x) * spring;
    first.vy += (state.target.y - first.y) * spring;
    for (let index = 0; index < tendril.nodes.length; index += 1) {
      const node = tendril.nodes[index];
      const previous = tendril.nodes[index - 1];
      if (previous) {
        node.vx += (previous.x - node.x) * spring + previous.vx * TRAIL_SETTINGS.dampening;
        node.vy += (previous.y - node.y) * spring + previous.vy * TRAIL_SETTINGS.dampening;
      }
      node.vx *= tendril.friction;
      node.vy *= tendril.friction;
      node.x += node.vx;
      node.y += node.vy;
      spring *= TRAIL_SETTINGS.tension;
    }
  }
}

export function advanceTrailHue(state: TrailState): number {
  state.huePhase += TRAIL_SETTINGS.hueFrequency;
  return TRAIL_SETTINGS.hueOffset + Math.sin(state.huePhase) * TRAIL_SETTINGS.hueAmplitude;
}
```

- [ ] **Step 4: 运行单元测试并确认通过**

Run: `corepack pnpm vitest run tests/unit/cursor-trail.test.ts`

Expected: PASS，3 tests passed。

- [ ] **Step 5: 提交纯逻辑**

```powershell
git add -- src/lib/cursor-trail.ts tests/unit/cursor-trail.test.ts
git commit -m "feat: add cursor trail physics"
```

---

### Task 2: 持久化 Canvas 和侧栏门控

**Files:**
- Create: `src/components/CursorTrail.astro`
- Create: `src/scripts/cursor-trail.ts`
- Create: `tests/e2e/cursor-trail.spec.ts`
- Modify: `src/components/SiteHeader.astro`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: Task 1 的 `TrailState` 和更新函数。
- Produces: `[data-cursor-trail]` Canvas、`[data-content-boundary]` 内容带探针及全站鼠标尾迹运行时。

- [ ] **Step 1: 写 Canvas 布局、正文静默、两侧触发、跨正文、减少动态效果和持久化的失败测试**

```ts
import { expect, test } from '@playwright/test';

const alphaPixels = (canvas: HTMLCanvasElement, left = 0, right = canvas.width) => {
  const context = canvas.getContext('2d');
  if (!context) return -1;
  const width = Math.max(0, right - left);
  const data = context.getImageData(left, 0, width, canvas.height).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] > 0) count += 1;
  return count;
};

const contentAlphaPixels = (
  canvas: HTMLCanvasElement,
  bounds: { left: number; right: number }
) => {
  const context = canvas.getContext('2d');
  if (!context) return -1;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const left = Math.floor((bounds.left - rect.left) * scaleX);
  const right = Math.ceil((bounds.right - rect.left) * scaleX);
  const data = context.getImageData(left, 0, right - left, canvas.height).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] > 0) count += 1;
  return count;
};

test('cursor trail is a non-interactive fixed viewport layer', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  expect(await canvas.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      position: style.position,
      pointerEvents: style.pointerEvents,
      width: style.width,
      height: style.height
    };
  })).toEqual({ position: 'fixed', pointerEvents: 'none', width: '1440px', height: '900px' });
});

test('moving only inside the content band leaves the canvas transparent', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const bounds = await page.locator('[data-content-boundary]').boundingBox();
  if (!bounds) throw new Error('Missing content boundary');
  await page.mouse.move(bounds.x + bounds.width / 2, 320);
  await page.waitForTimeout(150);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);
});

for (const side of ['left', 'right'] as const) {
  test(`${side} gutter creates a visible trail`, async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('[data-cursor-trail]');
    const bounds = await page.locator('[data-content-boundary]').boundingBox();
    if (!bounds) throw new Error('Missing content boundary');
    const x = side === 'left' ? Math.max(8, bounds.x - 24) : Math.min(1432, bounds.x + bounds.width + 24);
    for (let step = 0; step < 6; step += 1) await page.mouse.move(x, 180 + step * 42);
    await expect.poll(() => canvas.evaluate(alphaPixels)).toBeGreaterThan(0);
  });
}

test('a gutter trail can cross the protected content band', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const box = await page.locator('[data-content-boundary]').boundingBox();
  if (!box) throw new Error('Missing content boundary');
  await page.mouse.move(Math.max(8, box.x - 24), 260);
  await page.mouse.move(Math.min(1432, box.x + box.width + 24), 620);
  const bounds = { left: box.x, right: box.x + box.width };
  await expect.poll(() => canvas.evaluate(contentAlphaPixels, bounds)).toBeGreaterThan(0);
});

test('reduced motion disables drawing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const bounds = await page.locator('[data-content-boundary]').boundingBox();
  if (!bounds) throw new Error('Missing content boundary');
  await page.mouse.move(Math.max(8, bounds.x - 24), 260);
  await page.waitForTimeout(150);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);
});

test('the canvas persists once across client navigation', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  await canvas.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));
  await page.getByRole('link', { name: '博客文章', exact: true }).click();
  await expect(page.locator('[data-cursor-trail]')).toHaveCount(1);
  await expect(page.locator('[data-cursor-trail]')).toHaveAttribute('data-persist-probe', 'same-node');
});
```

- [ ] **Step 2: 运行 Playwright 测试并确认因 Canvas 缺失而失败**

Run: `corepack pnpm playwright test tests/e2e/cursor-trail.spec.ts --project=desktop-1440`

Expected: FAIL，`[data-cursor-trail]` count 为 0。

- [ ] **Step 3: 添加组件、边界探针和全局挂载**

`CursorTrail.astro` 只包含下面的全屏叠层：

```astro
<canvas data-cursor-trail aria-hidden="true" transition:persist="cursor-trail"></canvas>

<style is:global>
  [data-cursor-trail] {
    position: fixed;
    z-index: 10;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
  }
</style>
```

在 `SiteHeader.astro` 的 `.header-inner.container` 上增加 `data-content-boundary`。在 `BaseLayout.astro` 导入并挂载 `CursorTrail`，并在现有脚本块中导入 `@/scripts/cursor-trail`。

- [ ] **Step 4: 实现 Canvas 运行时**

创建 `src/scripts/cursor-trail.ts`：

```ts
import {
  advanceTrailHue,
  createTrailState,
  isPointerInGutter,
  setTrailTarget,
  updateTrailState,
  type Tendril,
  type TrailState
} from '@/lib/cursor-trail';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const FRAME_INTERVAL_MS = 1000 / 60;

let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let state: TrailState | undefined;
let animationFrame = 0;
let lastFrame = 0;

function clearTrail(): void {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  lastFrame = 0;
  state = undefined;
  if (canvas && context) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    canvas.dataset.cursorTrailState = 'idle';
  }
}

function isEnabled(): boolean {
  return !reducedMotion.matches && finePointer.matches;
}

function drawTendril(tendril: Tendril): void {
  if (!context || tendril.nodes.length < 2) return;
  const nodes = tendril.nodes;
  context.beginPath();
  context.moveTo(nodes[0].x, nodes[0].y);
  let index = 1;
  for (; index < nodes.length - 2; index += 1) {
    const node = nodes[index];
    const next = nodes[index + 1];
    context.quadraticCurveTo(node.x, node.y, (node.x + next.x) / 2, (node.y + next.y) / 2);
  }
  const node = nodes[index];
  const next = nodes[index + 1];
  context.quadraticCurveTo(node.x, node.y, next.x, next.y);
  context.stroke();
}

function render(time: number): void {
  if (!canvas || !context || !state || !isEnabled()) {
    clearTrail();
    return;
  }
  animationFrame = requestAnimationFrame(render);
  if (time - lastFrame < FRAME_INTERVAL_MS) return;
  lastFrame = time;
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = 'rgb(0 0 0 / 40%)';
  context.fillRect(0, 0, innerWidth, innerHeight);
  context.globalCompositeOperation = 'lighter';
  updateTrailState(state);
  context.strokeStyle = `hsl(${Math.round(advanceTrailHue(state))} 90% 50% / 25%)`;
  context.lineWidth = 1;
  for (const tendril of state.tendrils) drawTendril(tendril);
}

function startTrail(): void {
  if (!animationFrame) animationFrame = requestAnimationFrame(render);
}

function resizeCanvas(): void {
  if (!canvas) return;
  clearTrail();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  context = canvas.getContext('2d');
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function syncCanvas(): void {
  const nextCanvas = document.querySelector<HTMLCanvasElement>('[data-cursor-trail]');
  if (!nextCanvas) {
    clearTrail();
    canvas = null;
    context = null;
    return;
  }
  if (canvas !== nextCanvas) {
    clearTrail();
    canvas = nextCanvas;
    context = canvas.getContext('2d');
  }
  resizeCanvas();
}

function handlePointerMove(event: PointerEvent): void {
  if (!canvas || !context || !isEnabled()) return;
  const boundary = document.querySelector<HTMLElement>('[data-content-boundary]');
  if (!boundary || !isPointerInGutter(event.clientX, boundary.getBoundingClientRect())) return;
  if (state) setTrailTarget(state, event.clientX, event.clientY);
  else state = createTrailState(event.clientX, event.clientY);
  canvas.dataset.cursorTrailState = 'active';
  startTrail();
}

function handleCapabilityChange(): void {
  clearTrail();
}

window.addEventListener('pointermove', handlePointerMove, { passive: true });
window.addEventListener('resize', resizeCanvas, { passive: true });
reducedMotion.addEventListener('change', handleCapabilityChange);
finePointer.addEventListener('change', handleCapabilityChange);
document.addEventListener('astro:page-load', syncCanvas);
syncCanvas();
```

- [ ] **Step 5: 运行专用 E2E 测试并修正到通过**

Run: `corepack pnpm playwright test tests/e2e/cursor-trail.spec.ts --project=desktop-1440`

Expected: PASS；正文静默、左右触发、跨正文、reduced-motion 和客户端导航断言全部通过。

- [ ] **Step 6: 运行类型检查和单元测试**

Run: `corepack pnpm check`

Expected: exit 0，0 errors。

Run: `corepack pnpm test:run`

Expected: exit 0，全部单元测试通过。

- [ ] **Step 7: 提交交互实现**

```powershell
git add -- src/components/CursorTrail.astro src/components/SiteHeader.astro src/layouts/BaseLayout.astro src/scripts/cursor-trail.ts tests/e2e/cursor-trail.spec.ts
git commit -m "feat: add sidebar cursor trail"
```

---

### Task 3: 视觉隔离、全量验证和本地预览

**Files:**
- Modify: `tests/e2e/visual.spec.ts`

**Interfaces:**
- Consumes: Task 2 的 `[data-content-boundary]` 和 Canvas。
- Produces: 不受鼠标尾迹影响的稳定视觉截图流程。

- [ ] **Step 1: 把视觉测试鼠标位置移入内容带**

用下列逻辑替换 `page.mouse.move(0, 0)`，保证截图准备阶段不触发侧栏采样：

```ts
const contentBounds = await page.locator('[data-content-boundary]').boundingBox();
if (!contentBounds) throw new Error('Missing content boundary');
const viewport = page.viewportSize();
const belowHeader = contentBounds.y + contentBounds.height + 24;
await page.mouse.move(
  contentBounds.x + contentBounds.width / 2,
  Math.min(belowHeader, (viewport?.height ?? belowHeader + 1) - 1)
);
```

- [ ] **Step 2: 运行视觉结构测试，确认基线无需更新**

Run: `corepack pnpm playwright test tests/e2e/visual.spec.ts`

Expected: 18 tests passed，现有 PNG 文件无变更。

- [ ] **Step 3: 运行完整项目验证**

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm build
corepack pnpm check:site
corepack pnpm test:e2e
```

Expected: 所有命令 exit 0；构建检查保留 `dist/CNAME`、`dist/third-party-notices.txt` 和预期站内链接总数。

- [ ] **Step 4: 用浏览器检查交互观感**

启动开发服务器后，在 1440×900 视口依次检查：正文中心不生成轨迹；左右留白均可生成；快速从左侧移到右侧时线束可穿过正文；色相缓慢变化；停止移动后残影消退；切换主题和客户端路由后不出现重复 Canvas；reduced-motion 下不绘制。

- [ ] **Step 5: 提交视觉测试保护**

```powershell
git add -- tests/e2e/visual.spec.ts
git commit -m "test: isolate cursor trail from visual snapshots"
```

- [ ] **Step 6: 启动并保留本地开发预览**

Run: `corepack pnpm dev --host 127.0.0.1`

Expected: Astro 监听 `http://127.0.0.1:4321/`，最终回复提供可点击链接，除非用户明确要求停止，否则进程保持运行。
