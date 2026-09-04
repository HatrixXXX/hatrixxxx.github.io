# Cursor Trail Multi-Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让每次鼠标进出或换区产生的轨迹都保留独立物理状态，继续自然收敛和淡出，不因新轨迹出现或单条轨迹收敛而直接消失。

**Architecture:** 运行时保存 `TrailSession[]` 和一个 `activeSession` 引用。结束输入只把当前 session 标成 `retiring`；所有 session 每帧独立更新和绘制，收敛后逐条回收。数组清空后继续 24 个透明度衰减帧，再执行最终清屏。色相使用独立全局时钟，每帧只推进一次。

**Tech Stack:** Astro 7、TypeScript 5、Canvas 2D、Vitest 4、Playwright 1.62

## Global Constraints

- 保留 20 条 tendril × 50 节点、60 FPS、40% `destination-out`、`lighter` 混合与现有弹簧参数。
- 新会话不得连接旧区域；旧会话必须继续物理更新到收敛，不能只保留快速衰减的冻结像素。
- 同一区域可同时存在任意数量的 retiring session，不设未经性能证据支持的硬上限。
- 单个 session 收敛时不得调用整张 Canvas 的 `clearRect`。
- reduced motion、非精细指针、Canvas 替换和实际位图尺寸变化允许硬重置。
- Astro 客户端切页复用同一 Canvas 且尺寸不变时，只 retire 当前 session，不清除已有轨迹。
- 不增加依赖，不改文章正文、公开 URL 或视觉基线。
- 另有 Codex 会话使用同一仓库；编辑和提交前检查 HEAD/status，不覆盖范围外改动。

---

### Task 1: 独立色相时钟与多会话运行时

**Files:**
- Modify: `src/lib/cursor-trail.ts`
- Modify: `src/scripts/cursor-trail.ts`
- Modify: `tests/unit/cursor-trail.test.ts`
- Modify: `tests/e2e/cursor-trail.spec.ts`

**Interfaces:**
- Produces: `TrailHueState`、`createTrailHueState()`，`advanceTrailHue()` 改为接收 `TrailHueState`。
- Runtime owns: `TrailSession[]`、`activeSession`、`retireActiveSession()`、`hardResetTrail()` 和 24 帧尾衰减。

- [ ] **Step 1: 增加可感知透明度测试工具**

在 E2E 中增加与 `alphaPixelsInRect` 使用相同 DPR 换算的 alpha 总和：

```ts
const alphaSumInRect = (
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
  let sum = 0;
  for (let index = 3; index < data.length; index += 4) sum += data[index];
  return sum;
};
```

- [ ] **Step 2: 写用户现象的失败测试**

加强三段同侧测试：第三段产生后等待 350ms，再同时断言三个区域的 `alphaSumInRect` 均大于 0，随后轮询三块为 0。旧实现只保留 raster 像素，前两段会在约 200ms 内降到肉眼不可见，这一步必须 RED。

新增 settled-new-session 回归：

```ts
test('a settled new session never clears an older retiring trail', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  const oldArea = {
    left: 0,
    right: geometry.content.left,
    top: geometry.y - 120,
    bottom: geometry.y + 120
  };

  await page.mouse.move(geometry.leftX, geometry.y - 90);
  await page.mouse.move(geometry.leftX, geometry.y + 90);
  await expect.poll(() => canvas.evaluate(alphaSumInRect, oldArea)).toBeGreaterThan(0);

  await page.mouse.move(geometry.centerX, geometry.y);
  await page.mouse.move(geometry.rightX, geometry.y);
  await page.waitForTimeout(500);
  expect(await canvas.evaluate(alphaSumInRect, oldArea)).toBeGreaterThan(0);
  await expect.poll(() => canvas.evaluate(alphaSumInRect, oldArea), { timeout: 10_000 }).toBe(0);
});
```

右侧只收到一个有效点，会立即处于 settled 状态。旧 singleton 实现会在 250ms 后调用全屏 `clearTrail()`，因此旧区域变为 0。

- [ ] **Step 3: 确认 RED**

Run: `corepack pnpm playwright test tests/e2e/cursor-trail.spec.ts --project=desktop-1440`

Expected: FAIL；旧轨迹 350–500ms 后的 alphaSum 为 0 或远低于可见值。记录切区前和 50/100/200/350ms 的 alphaSum。

- [ ] **Step 4: 拆分独立色相时钟**

在 `src/lib/cursor-trail.ts` 中将 `phase` 从 `TrailState` 移到：

```ts
export type TrailHueState = { phase: number };

export function createTrailHueState(): TrailHueState {
  return { phase: 0 };
}

export function advanceTrailHue(state: TrailHueState): number {
  state.phase += TRAIL_SETTINGS.hueFrequency;
  return TRAIL_SETTINGS.hueOffset + Math.sin(state.phase) * TRAIL_SETTINGS.hueAmplitude;
}
```

`createTrailState()` 只返回 `target` 与 `tendrils`。单元测试改为用 `createTrailHueState()` 验证 370、200、285 三个色相点，并断言新建多个物理 state 不改变 hue phase。

- [ ] **Step 5: 建立多会话状态**

在 runtime 增加：

```ts
type ActiveTrailRegion = Exclude<TrailRegion, null>;
type TrailSession = {
  state: TrailState;
  region: ActiveTrailRegion;
  status: 'active' | 'retiring';
  lastInput: number;
};

const FADE_TAIL_FRAMES = 24;
const hueState = createTrailHueState();
let sessions: TrailSession[] = [];
let activeSession: TrailSession | undefined;
let activeRegion: TrailRegion = null;
let fadeFramesRemaining = 0;
```

`isTrailSettled` 必须接收显式 state：

```ts
function isTrailSettled(trail: TrailState): boolean {
  return trail.tendrils.every(({ nodes }) => nodes.every((node) => (
    Math.hypot(node.x - trail.target.x, node.y - trail.target.y) < SETTLED_DISTANCE_PX
    && Math.hypot(node.vx, node.vy) < SETTLED_VELOCITY_PX_PER_FRAME
  )));
}
```

结束输入只 retire：

```ts
function retireActiveSession(): void {
  if (activeSession) activeSession.status = 'retiring';
  activeSession = undefined;
  activeRegion = null;
  if (sessions.length > 0 && canvas) canvas.dataset.cursorTrailState = 'fading';
}
```

有效 pointermove 只有在 active session 与区域相同时更新 target；否则先 retire，再创建并 push 一个新 session。新 session 出现时把 `fadeFramesRemaining` 归零。

- [ ] **Step 6: 改写渲染和逐条回收**

每个实际渲染帧按下面顺序执行：

1. `destination-out` 全局衰减一次。
2. 当前 active session 在输入空闲 250ms 且已 settled 时转为 retiring。
3. 色相时钟只调用一次 `advanceTrailHue(hueState)`，所有 session 共用这个 strokeStyle。
4. 对每个 session 执行 `updateTrailState(session.state)` 和 draw。
5. 只过滤掉 `status === 'retiring' && isTrailSettled(session.state)` 的 session；不能清 Canvas。
6. sessions 从非空变为空时设置 `fadeFramesRemaining = 24`。后续只做全局衰减；计数归零后再 hard reset。

`hardResetTrail()` 只用于能力禁用、真实 resize/Canvas 替换与尾衰减结束。它取消 RAF、清 sessions/active 引用并执行 `clearRect`。

- [ ] **Step 7: 避免客户端导航无条件清屏**

`resizeCanvas()` 先计算目标 backing-store 宽高。若 Canvas、context、宽高都未变化，直接返回，不触发 hard reset。`syncCanvas()` 在复用同一 persisted Canvas 时调用 `retireActiveSession()`，然后执行无变化即返回的 resize；只有节点被替换或尺寸改变才 hard reset。

- [ ] **Step 8: 确认 GREEN**

Run: `corepack pnpm vitest run tests/unit/cursor-trail.test.ts`

Expected: PASS。

Run: `corepack pnpm playwright test tests/e2e/cursor-trail.spec.ts --project=desktop-1440`

Expected: PASS。旧轨迹在 350–500ms 后仍可见，三段 session 可同时存在，最后各自归零；区域、lightbox、reduced/coarse、导航和无 mask 用例保持通过。

- [ ] **Step 9: 运行项目验证并提交**

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm build
corepack pnpm check:site
```

Expected: 所有命令 exit 0。若 jsDelivr 只出现随机超时，保留失败报告并按项目规则重试，不改内容或测试绕过。

提交：

```powershell
git add -- src/lib/cursor-trail.ts src/scripts/cursor-trail.ts tests/unit/cursor-trail.test.ts tests/e2e/cursor-trail.spec.ts
git commit -m "fix: preserve concurrent cursor trail sessions"
```

- [ ] **Step 10: 浏览器验收和预览**

在同一区域连续进出三次，并左右切换；确认旧轨迹不会在新轨迹出现时跳变或突然消失，三段至少在 350ms 后仍清晰可见，随后各自自然收敛。保持 `http://127.0.0.1:4321/` 运行。
