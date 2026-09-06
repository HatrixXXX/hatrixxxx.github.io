# 横向文章栏滑动阻尼实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or **superpowers:executing-plans** to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** 为博客横向文章栏加入滚轮阻尼和拖拽松手惯性，同时保留边界放行、键盘操作、无 JavaScript 降级与 reduced-motion 行为。

**Architecture:** 将时间相关的阻尼和惯性计算放在无 DOM 的 \`src/lib/post-rail-motion.ts\`，让单元测试直接验证数值行为。 \`src/scripts/post-rail.ts\` 只负责事件委托、指针状态和把纯运动结果写回 \`scrollLeft\`；每个 rail 用 \`WeakMap\` 保存自己的目标、速度和动画帧。

**Tech Stack:** Astro、TypeScript、Vitest、Playwright、浏览器 \`requestAnimationFrame\` 和 \`matchMedia\`。

## Global Constraints

- 不新增依赖，保持纯静态输出。
- 不改变文章卡片结构、文章 URL、Giscus pathname、键盘行为和无 JavaScript 原生横向滚动。
- 不使用 \`scroll-snap\`、轮播按钮或自动播放。
- \`prefers-reduced-motion: reduce\` 下不播放平滑滚动和拖拽惯性。
- 只修改本功能涉及的脚本和测试，不覆盖工作区内其他会话的未提交改动。

---

### Task 1: 建立可测试的文章栏运动模型

**Files:**
- Create: \`src/lib/post-rail-motion.ts\`
- Create: \`tests/unit/post-rail-motion.test.ts\`

**Interfaces:**
- Produces \`clampRailPosition(value: number, maximum: number): number\`。
- Produces \`stepDampedMotion(state: DampedMotionState, deltaMs: number, maximum: number): DampedMotionState\`，用于滚轮目标追赶。
- Produces \`stepInertialMotion(state: InertialMotionState, deltaMs: number, maximum: number): InertialMotionState\`，用于拖拽松手后的速度衰减。
- Produces \`createMotionState(position: number, target?: number, velocity?: number): DampedMotionState\`，保证测试和脚本使用同一初始状态结构。

- [ ] **Step 1: 写运动模型的失败测试**

在 \`tests/unit/post-rail-motion.test.ts\` 覆盖以下可观察行为：

~~~ts
import { describe, expect, it } from 'vitest';
import {
  clampRailPosition,
  createMotionState,
  stepDampedMotion,
  stepInertialMotion
} from '../../src/lib/post-rail-motion';

describe('post rail motion', () => {
  it('clamps positions to the scrollable range', () => {
    expect(clampRailPosition(-10, 500)).toBe(0);
    expect(clampRailPosition(700, 500)).toBe(500);
    expect(clampRailPosition(120, 500)).toBe(120);
  });

  it('moves toward a wheel target without jumping directly to it', () => {
    const next = stepDampedMotion(createMotionState(0, 300), 16, 600);
    expect(next.position).toBeGreaterThan(0);
    expect(next.position).toBeLessThan(300);
    expect(next.target).toBe(300);
  });

  it('settles close to the target after repeated damped frames', () => {
    let state = createMotionState(0, 300);
    for (let index = 0; index < 120; index += 1) {
      state = stepDampedMotion(state, 16, 600);
    }
    expect(state.position).toBeCloseTo(300, 1);
    expect(state.target).toBe(300);
    expect(state.velocity).toBe(0);
  });

  it('decays release velocity and stops at the rail edge', () => {
    let state = { ...createMotionState(500, 500, 1.2), velocity: 1.2 };
    for (let index = 0; index < 240; index += 1) {
      state = stepInertialMotion(state, 16, 600);
    }
    expect(state.position).toBeLessThanOrEqual(600);
    expect(Math.abs(state.velocity)).toBe(0);
  });

  it('stops inertial motion when it hits either edge', () => {
    const next = stepInertialMotion({ ...createMotionState(590, 590, 20), velocity: 20 }, 16, 600);
    expect(next.position).toBe(600);
    expect(next.velocity).toBe(0);
  });
});
~~~

- [ ] **Step 2: 运行单元测试，确认模型尚未存在**

Run: \`corepack pnpm exec vitest run tests/unit/post-rail-motion.test.ts\`

Expected: FAIL because \`src/lib/post-rail-motion.ts\` does not exist yet.

- [ ] **Step 3: 写最小纯函数实现**

在 \`src/lib/post-rail-motion.ts\` 定义：

~~~ts
export interface DampedMotionState {
  position: number;
  target: number;
  velocity: number;
}

export interface InertialMotionState extends DampedMotionState {
  velocity: number;
}

const DAMPING_PER_FRAME = 0.2;
const INERTIA_DECAY_PER_FRAME = 0.9;
const MIN_VELOCITY = 0.01;

export function clampRailPosition(value: number, maximum: number): number {
  return Math.min(Math.max(value, 0), Math.max(0, maximum));
}

export function createMotionState(
  position: number,
  target = position,
  velocity = 0
): DampedMotionState {
  return { position, target, velocity };
}

export function stepDampedMotion(
  state: DampedMotionState,
  deltaMs: number,
  maximum: number
): DampedMotionState {
  const frameScale = Math.min(Math.max(deltaMs, 0), 32) / 16;
  const target = clampRailPosition(state.target, maximum);
  const position = state.position + (target - state.position) * (1 - Math.pow(DAMPING_PER_FRAME, frameScale));
  const settled = Math.abs(target - position) < 0.1;
  return {
    position: settled ? target : clampRailPosition(position, maximum),
    target,
    velocity: settled ? 0 : target - position
  };
}

export function stepInertialMotion(
  state: InertialMotionState,
  deltaMs: number,
  maximum: number
): InertialMotionState {
  const frameScale = Math.min(Math.max(deltaMs, 0), 32) / 16;
  const velocity = state.velocity * Math.pow(INERTIA_DECAY_PER_FRAME, frameScale);
  const position = clampRailPosition(state.position + velocity * frameScale, maximum);
  const hitEdge = position === 0 || position === Math.max(0, maximum);
  return {
    position,
    target: position,
    velocity: hitEdge || Math.abs(velocity) < MIN_VELOCITY ? 0 : velocity
  };
}
~~~

若测试暴露数值不稳定，调整常量或步进公式，但保持“首帧不直达目标、重复帧收敛、边界速度归零”的接口契约，不把 DOM 逻辑移入该文件。

- [ ] **Step 4: 运行单元测试确认通过**

Run: \`corepack pnpm exec vitest run tests/unit/post-rail-motion.test.ts\`

Expected: PASS with all motion model tests passing.

- [ ] **Step 5: Commit the isolated motion model**

~~~bash
git add src/lib/post-rail-motion.ts tests/unit/post-rail-motion.test.ts
git commit -m "test: add post rail motion model"
~~~

### Task 2: 接入滚轮阻尼、拖拽惯性和 reduced-motion

**Files:**
- Modify: \`src/scripts/post-rail.ts\`
- Test: \`tests/e2e/blog-index.spec.ts\`

**Interfaces:**
- Consumes \`clampRailPosition\`, \`createMotionState\`, \`stepDampedMotion\` and \`stepInertialMotion\` from Task 1。
- Keeps document-level \`wheel\`, \`pointerdown\`, \`pointermove\`, \`pointerup\`, \`pointercancel\`, \`dragstart\` and capture-phase \`click\` handlers。
- Produces no new public DOM API; existing \`[data-post-rail]\`, \`data-dragging\` and \`scrollLeft\` behavior remain the integration surface。

- [ ] **Step 1: 写失败的博客 E2E 行为检查**

在 \`tests/e2e/blog-index.spec.ts\` 的滚轮和拖拽测试附近增加：

~~~ts
test('wheel movement eases toward its target before settling', async ({ page }) => {
  await page.goto('/blog/');
  const rail = page.locator('[data-post-rail]');
  const box = await rail.boundingBox();
  if (!box) throw new Error('Missing post rail bounds');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await rail.evaluate((element) => { element.scrollLeft = 0; });
  await page.mouse.wheel(0, 280);
  const firstFrame = await rail.evaluate((element) => element.scrollLeft);
  expect(firstFrame).toBeGreaterThan(0);
  expect(firstFrame).toBeLessThan(280);
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(firstFrame);
  await page.waitForTimeout(450);
  const settled = await rail.evaluate((element) => element.scrollLeft);
  expect(settled).toBeGreaterThan(firstFrame);
});

test('drag release continues with inertia and then settles', async ({ page }) => {
  await page.goto('/blog/');
  const rail = page.locator('[data-post-rail]');
  const box = await rail.boundingBox();
  if (!box) throw new Error('Missing post rail bounds');

  await page.mouse.move(box.x + 180, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 3 });
  const atRelease = await rail.evaluate((element) => element.scrollLeft);
  await page.mouse.up();
  await page.waitForTimeout(60);
  const afterRelease = await rail.evaluate((element) => element.scrollLeft);
  expect(afterRelease).toBeGreaterThan(atRelease);
  await page.waitForTimeout(500);
  const settled = await rail.evaluate((element) => element.scrollLeft);
  expect(settled).toBeGreaterThanOrEqual(afterRelease);
});

test('reduced motion skips wheel easing and drag inertia', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blog/');
  const rail = page.locator('[data-post-rail]');
  const box = await rail.boundingBox();
  if (!box) throw new Error('Missing post rail bounds');
  await page.mouse.move(box.x + 180, box.y + box.height / 2);
  await page.mouse.wheel(0, 280);
  const wheelPosition = await rail.evaluate((element) => element.scrollLeft);
  expect(wheelPosition).toBeGreaterThan(0);
  await page.waitForTimeout(100);
  expect(await rail.evaluate((element) => element.scrollLeft)).toBeCloseTo(wheelPosition, 0);
});
~~~

Keep the existing edge handoff and link-drag assertions; these new checks only add timing behavior.

- [ ] **Step 2: 运行新增 E2E，确认当前脚本不满足阻尼断言**

Run: \`corepack pnpm exec playwright test tests/e2e/blog-index.spec.ts --grep "eases|inertia|reduced motion"\`

Expected: FAIL because wheel movement is currently immediate and pointer release has no inertia.

- [ ] **Step 3: 为每个 rail 增加 motion state 和 animation frame**

在 \`src/scripts/post-rail.ts\` 引入 Task 1 的函数，添加 \`WeakMap<HTMLElement, RailRuntimeState>\`。运行帧必须：

~~~ts
interface RailRuntimeState {
  motion: DampedMotionState;
  animationFrame: number | null;
  lastFrameTime: number | null;
  reducedMotion: boolean;
  dragSamples: Array<{ time: number; x: number }>;
}
~~~

实现 \`runtimeFor(rail)\`, \`cancelAnimation(rail)\`, \`startDampedAnimation(rail)\`, \`startInertialAnimation(rail)\` 和 \`syncMotionPosition(rail)\`。每帧把 \`scrollLeft\` 写为纯函数返回的 \`position\`，时间差限制在 32 ms；运动停止后取消帧并清空 \`lastFrameTime\`。

- [ ] **Step 4: 把滚轮增量接到目标位置**

保留现有 \`wheelDelta\` 和首尾 \`canMove\` 判断。允许拦截时，将 \`state.motion.target\` 设置为 \`clampRailPosition(currentTarget + delta, maximum)\`；reduced-motion 时直接写目标并清空速度，否则启动阻尼帧。不要在边界外拦截事件。

- [ ] **Step 5: 记录拖拽速度并在释放时启动惯性**

拖拽开始前取消该 rail 的旧动画并同步当前位置。拖拽移动时直接设置 \`scrollLeft\`，每次移动保留最近约 100 ms 的采样，按最早和最新采样计算速度；松手时 reduced-motion 或速度低于阈值则停止，否则把速度转换为 \`scrollLeft\` 每帧位移并启动惯性帧。保留现有 4 px 阈值、指针捕获、\`data-dragging\` 和点击抑制。

- [ ] **Step 6: 运行博客 E2E 确认通过**

Run: \`corepack pnpm exec playwright test tests/e2e/blog-index.spec.ts\`

Expected: PASS for existing layout, keyboard, edge handoff and drag-link tests plus the new damping tests.

- [ ] **Step 7: Commit the integration**

~~~bash
git add src/scripts/post-rail.ts tests/e2e/blog-index.spec.ts
git commit -m "feat: add damped post rail scrolling"
~~~

### Task 3: 完成项目级验证和本地预览

**Files:**
- Modify: none unless a test exposes a direct regression in Task 1 or Task 2.
- Verify: \`src/scripts/post-rail.ts\`, \`src/lib/post-rail-motion.ts\`, \`tests/unit/post-rail-motion.test.ts\`, \`tests/e2e/blog-index.spec.ts\`。

**Interfaces:**
- Consumes the committed motion model and rail integration from Tasks 1-2。
- Produces verified project state and a running local preview at \`http://127.0.0.1:4321/\`。

- [ ] **Step 1: 运行完整单元和 Astro 检查**

Run: \`corepack pnpm test:run\`; \`corepack pnpm check\`

Expected: both commands exit 0.

- [ ] **Step 2: 运行图片、保护内容、构建和站内链接检查**

Run: \`corepack pnpm check:images\`; \`corepack pnpm build\`; \`corepack pnpm check:protected\`; \`corepack pnpm check:site\`

Expected: all commands exit 0 and no private content appears in \`dist/\`.

- [ ] **Step 3: 启动并确认本地预览**

Run: \`corepack pnpm astro dev --background --host 127.0.0.1 --port 4321\`; then \`corepack pnpm astro dev status\` and \`Invoke-WebRequest http://127.0.0.1:4321/ -UseBasicParsing\`。

Expected: dev server reports running, HTTP response is successful, and the preview remains running for handoff.

- [ ] **Step 4: 检查最终工作区**

Run: \`git status --short\`

Expected: only the intended motion implementation, tests and plan/spec commits are present; pre-existing changes from other sessions remain untouched.
