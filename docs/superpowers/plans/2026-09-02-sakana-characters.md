# Dual Sakana Characters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 当前仓库已去除分类与标签路由。下文的 66 项检查、21 张视觉基线、80 个页面和 4,653 条链接是当时的执行记录；当前验收口径为 91 项检查、18 张视觉基线、67 个页面和 5,352 条链接。

**Goal:** 在博客所有页面显示两个可独立拖拽的 Sakana 角色：左下角为水平镜像的锦木千束，右下角为原方向的井上泷奈。

**Architecture:** `SakanaCharacters.astro` 只负责持久化 DOM、固定定位和响应式缩放，`src/scripts/sakana.ts` 在浏览器空闲时动态导入官方 `sakana` 包并创建两个实例。Astro 客户端导航沿用同一个装饰层；减少动态效果模式通过脚本暂停实例，并由 CSS 禁用拖拽。

**Tech Stack:** Astro 7、TypeScript、`sakana@1.0.8`、pnpm、Vitest、Playwright

## Global Constraints

- 使用 Node 24 和 Corepack 管理的 pnpm。
- 保持 Astro 纯静态输出，不增加服务端代码、数据库或运行时 CDN。
- 使用官方 `itorr/sakana` 对应的 `sakana@1.0.8`，版本精确固定。
- 千束固定在左下，只有人物位图水平镜像，拖动方向与偏转方向一致；泷奈固定在右下且不镜像；禁止角色切换和自动甩动。
- 桌面和平板缩放为 `0.5`；视口宽度不超过 `480px` 时缩放为 `0.32`，手机端仍显示两人。
- 千束锚点在桌面和平板左移 `50px`，手机端左移 `32px`；人物主体贴住视口左边但不裁切。
- 两个 `.sakana-bed` 都隐藏，只保留连接杆和人物。
- 角色层使用 `z-index: 15`，低于导航、搜索、播放器和主题全屏动效。
- 初始配置为 `r: 0`、`y: 0`、`scale: 1`、`canSwitchCharacter: false`。
- 普通模式启用原有拖拽和音效；`prefers-reduced-motion: reduce` 下暂停动画、静音并禁止拖拽。
- 不修改文章正文、旧文章 URL、Giscus pathname、图床规则或站内链接计数。
- 保留用户对 `src/content/posts/2025-07-04-杂货铺.md` 的未提交修改，不把它加入本功能提交。
- 设计依据：`docs/superpowers/specs/2026-09-02-sakana-characters-design.md`。

---

## File Map

- Create `src/components/SakanaCharacters.astro`: 两个挂载点、千束位图镜像、固定定位和响应式样式。
- Create `src/scripts/sakana.ts`: 空闲加载、实例初始化、导航去重和减少动态效果状态。
- Create `src/types/sakana.d.ts`: 当前功能实际使用的 `sakana` 类型。
- Create `tests/e2e/sakana.spec.ts`: 角色、方向、位置、拖拽、锁定和导航持久化测试。
- Modify `src/layouts/BaseLayout.astro`: 全站挂载组件并导入初始化脚本。
- Modify `package.json`: 增加精确版本的运行时依赖。
- Modify `pnpm-lock.yaml`: 锁定 `sakana@1.0.8`。
- Modify `tests/e2e/accessibility.spec.ts`: 检查静态 reduced-motion 状态和焦点隔离。
- Modify `tests/e2e/visual.spec.ts`: 截图前等待两个角色初始化完成。
- Modify `tests/e2e/visual.spec.ts-snapshots/*.png`: 更新现有 21 张 Windows 视觉基线。
- Modify `AGENTS.md`, `README.md`, `docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md`: 将 Playwright 检查数从 63 更新为 66。

---

### Task 1: Add the persistent responsive mounts

**Files:**
- Create: `src/components/SakanaCharacters.astro`
- Modify: `src/layouts/BaseLayout.astro:2-11,69-82`
- Create: `tests/e2e/sakana.spec.ts`

**Interfaces:**
- Produces: `[data-sakana-layer]`, `[data-sakana-anchor="left"]`, `[data-sakana-anchor="right"]`, `[data-sakana-mount="chisato"]`, `[data-sakana-mount="takina"]`。
- Produces: 持久化名称 `sakana-characters`，后续脚本用 `data-sakana-state` 和 `data-sakana-motion` 记录状态。

- [ ] **Step 1: Write the failing layout test**

创建 `tests/e2e/sakana.spec.ts`：

```ts
import { expect, test } from '@playwright/test';

async function readSakanaLayout(page: import('@playwright/test').Page) {
  return page.locator('[data-sakana-layer]').evaluate((layer) => {
    const left = layer.querySelector<HTMLElement>('[data-sakana-anchor="left"]');
    const right = layer.querySelector<HTMLElement>('[data-sakana-anchor="right"]');
    const mirror = layer.querySelector<HTMLElement>('[data-sakana-mirror]');
    if (!left || !right || !mirror) throw new Error('Sakana anchors are missing');

    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height
      };
    };

    return {
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      layerZIndex: getComputedStyle(layer).zIndex,
      mirrorTransform: getComputedStyle(mirror).transform,
      left: rect(left),
      right: rect(right)
    };
  });
}

test('renders mirrored and responsive mounts without horizontal overflow', async ({ page }) => {
  await page.goto('/');

  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  await expect(layer.locator('[data-sakana-anchor]')).toHaveCount(2);
  await expect(layer.locator('[data-sakana-mount="chisato"]')).toHaveCount(1);
  await expect(layer.locator('[data-sakana-mount="takina"]')).toHaveCount(1);

  const desktop = await readSakanaLayout(page);
  expect(desktop.layerZIndex).toBe('15');
  expect(desktop.mirrorTransform).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  expect(desktop.scrollWidth).toBe(desktop.viewportWidth);
  expect(desktop.left.left).toBeCloseTo(0, 1);
  expect(desktop.left.bottom).toBeCloseTo(desktop.viewportHeight, 1);
  expect(desktop.left.width).toBeCloseTo(250, 1);
  expect(desktop.left.height).toBeCloseTo(400, 1);
  expect(desktop.right.right).toBeCloseTo(desktop.viewportWidth, 1);
  expect(desktop.right.bottom).toBeCloseTo(desktop.viewportHeight, 1);
  expect(desktop.right.width).toBeCloseTo(250, 1);
  expect(desktop.right.height).toBeCloseTo(400, 1);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await readSakanaLayout(page);
  expect(mobile.scrollWidth).toBe(mobile.viewportWidth);
  expect(mobile.left.left).toBeCloseTo(0, 1);
  expect(mobile.left.bottom).toBeCloseTo(844, 1);
  expect(mobile.left.width).toBeCloseTo(160, 1);
  expect(mobile.left.height).toBeCloseTo(256, 1);
  expect(mobile.right.right).toBeCloseTo(390, 1);
  expect(mobile.right.bottom).toBeCloseTo(844, 1);
  expect(mobile.right.width).toBeCloseTo(160, 1);
  expect(mobile.right.height).toBeCloseTo(256, 1);
});
```

- [ ] **Step 2: Run the test and confirm the missing layer failure**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440
```

Expected: FAIL because `[data-sakana-layer]` does not exist.

- [ ] **Step 3: Create the component**

创建 `src/components/SakanaCharacters.astro`：

```astro
<aside
  class="sakana-layer"
  data-sakana-layer
  data-sakana-state=""
  data-sakana-motion=""
  aria-hidden="true"
  transition:persist="sakana-characters"
>
  <div class="sakana-anchor" data-sakana-anchor="left">
    <div class="sakana-mirror" data-sakana-mirror>
      <div class="sakana-box" data-sakana-mount="chisato"></div>
    </div>
  </div>
  <div class="sakana-anchor" data-sakana-anchor="right">
    <div class="sakana-box" data-sakana-mount="takina"></div>
  </div>
</aside>

<style is:global>
  [data-sakana-layer] {
    position: fixed;
    z-index: 15;
    inset: 0;
    overflow: clip;
    pointer-events: none;
  }

  [data-sakana-anchor] {
    --sakana-scale: 0.5;
    position: absolute;
    bottom: 0;
    width: 500px;
    height: 800px;
    pointer-events: none;
    transform: scale(var(--sakana-scale));
  }

  [data-sakana-anchor='left'] {
    left: 0;
    transform-origin: left bottom;
  }

  [data-sakana-anchor='right'] {
    right: 0;
    transform-origin: right bottom;
  }

  [data-sakana-mirror] {
    width: 100%;
    height: 100%;
    transform: scaleX(-1);
  }

  @media (max-width: 480px) {
    [data-sakana-anchor] {
      --sakana-scale: 0.32;
    }
  }
</style>
```

- [ ] **Step 4: Mount the component globally**

在 `src/layouts/BaseLayout.astro` 的组件导入区加入：

```astro
import SakanaCharacters from '@/components/SakanaCharacters.astro';
```

在 `<SiteFooter />` 与 `<ThemeTransition />` 之间加入：

```astro
<SakanaCharacters />
```

- [ ] **Step 5: Run the focused test**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440
```

Expected: PASS, 1 test.

- [ ] **Step 6: Commit the responsive shell**

```powershell
git add -- src/components/SakanaCharacters.astro src/layouts/BaseLayout.astro tests/e2e/sakana.spec.ts
git commit -m "feat: add dual sakana mounts"
```

---

### Task 2: Initialize the official Sakana instances once

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/types/sakana.d.ts`
- Create: `src/scripts/sakana.ts`
- Modify: `src/layouts/BaseLayout.astro:76-83`
- Modify: `tests/e2e/sakana.spec.ts`

**Interfaces:**
- Consumes: `data-sakana-mount="chisato"`, `data-sakana-mount="takina"` and the persisted `[data-sakana-layer]` from Task 1.
- Produces: `SakanaInstance.pause()` and `SakanaInstance.destroy()` type declarations.
- Produces: layer states `scheduled | loading | ready | error` and normal motion state `full`.

- [ ] **Step 1: Add the failing initialization and persistence test**

在 `tests/e2e/sakana.spec.ts` 末尾加入：

```ts
test('initializes locked roles once and persists them across client navigation', async ({ page }) => {
  const remoteSakanaRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.hostname !== '127.0.0.1' &&
      (url.pathname.toLowerCase().includes('sakana') || url.hostname === 'lab.magiconch.com')
    ) {
      remoteSakanaRequests.push(request.url());
    }
  });

  await page.goto('/');
  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveAttribute('data-sakana-state', 'ready');
  await expect(layer).toHaveAttribute('data-sakana-motion', 'full');

  const chisato = layer.locator('[data-sakana-mount="chisato"]');
  const takina = layer.locator('[data-sakana-mount="takina"]');
  await expect(chisato.locator('.sakana-character')).toHaveAttribute('data-character', 'chisato');
  await expect(takina.locator('.sakana-character')).toHaveAttribute('data-character', 'takina');
  await expect(layer.locator('canvas')).toHaveCount(2);
  await expect(chisato).not.toHaveAttribute('data-can-switch-character', 'true');
  await expect(takina).not.toHaveAttribute('data-can-switch-character', 'true');

  await chisato.locator('.sakana-bed').dispatchEvent('click');
  await takina.locator('.sakana-bed').dispatchEvent('click');
  await expect(chisato.locator('.sakana-character')).toHaveAttribute('data-character', 'chisato');
  await expect(takina.locator('.sakana-character')).toHaveAttribute('data-character', 'takina');

  await layer.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));
  await page.getByRole('link', { name: '归档', exact: true }).click();
  await expect(page).toHaveURL(/\/archives\/$/);
  await expect(page.locator('[data-sakana-layer]')).toHaveAttribute('data-persist-probe', 'same-node');
  await expect(page.locator('[data-sakana-layer] canvas')).toHaveCount(2);
  expect(remoteSakanaRequests).toEqual([]);
});
```

- [ ] **Step 2: Run the focused test and confirm initialization is absent**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440 -g "initializes locked roles"
```

Expected: FAIL because `data-sakana-state` never becomes `ready`.

- [ ] **Step 3: Install the exact official package**

Run:

```powershell
corepack pnpm add sakana@1.0.8 --save-exact
```

Expected: `package.json` contains `"sakana": "1.0.8"`, and `pnpm-lock.yaml` records the same version.

- [ ] **Step 4: Add the narrow module declaration**

创建 `src/types/sakana.d.ts`：

```ts
declare module 'sakana' {
  export type SakanaCharacter = 'chisato' | 'takina';

  export interface SakanaOptions {
    el: string | HTMLElement;
    character: SakanaCharacter;
    r: number;
    y: number;
    scale: number;
    canSwitchCharacter: boolean;
  }

  export interface SakanaInstance {
    pause(): void;
    play(): void;
    destroy(): void;
  }

  export interface SakanaApi {
    init(options: SakanaOptions): SakanaInstance;
    setMute(muted: boolean): void;
  }

  const Sakana: SakanaApi;
  export default Sakana;
}
```

- [ ] **Step 5: Add idle initialization with deterministic roles**

创建 `src/scripts/sakana.ts`：

```ts
import type { SakanaInstance } from 'sakana';

const IDLE_TIMEOUT_MS = 1_000;
const FALLBACK_DELAY_MS = 200;
let instances: SakanaInstance[] = [];

async function initializeSakanaCharacters(layer: HTMLElement): Promise<void> {
  if (layer.dataset.sakanaState === 'ready' || layer.dataset.sakanaState === 'loading') return;
  layer.dataset.sakanaState = 'loading';

  try {
    const chisatoMount = layer.querySelector<HTMLElement>('[data-sakana-mount="chisato"]');
    const takinaMount = layer.querySelector<HTMLElement>('[data-sakana-mount="takina"]');
    if (!chisatoMount || !takinaMount) throw new Error('Sakana mount points are missing');

    const { default: Sakana } = await import('sakana');
    Sakana.setMute(false);

    const baseOptions = {
      r: 0,
      y: 0,
      scale: 1,
      canSwitchCharacter: false
    } as const;

    instances = [
      Sakana.init({ ...baseOptions, el: chisatoMount, character: 'chisato' }),
      Sakana.init({ ...baseOptions, el: takinaMount, character: 'takina' })
    ];
    instances.forEach((instance) => instance.pause());
    layer.dataset.sakanaMotion = 'full';
    layer.dataset.sakanaState = 'ready';
  } catch (error) {
    instances = [];
    layer.dataset.sakanaState = 'error';
    console.error('Unable to initialize Sakana characters', error);
  }
}

function scheduleSakanaInitialization(): void {
  const layer = document.querySelector<HTMLElement>('[data-sakana-layer]');
  if (!layer || layer.dataset.sakanaState) return;
  layer.dataset.sakanaState = 'scheduled';

  const run = () => {
    if (!layer.isConnected) return;
    void initializeSakanaCharacters(layer);
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
  } else {
    window.setTimeout(run, FALLBACK_DELAY_MS);
  }
}

document.addEventListener('astro:page-load', scheduleSakanaInitialization);
scheduleSakanaInitialization();
```

- [ ] **Step 6: Import the initializer from the global layout**

在 `src/layouts/BaseLayout.astro` 的公共 `<script>` 中加入：

```ts
import '@/scripts/sakana';
```

放在 `music-player` 与 `theme` 等现有导入旁边，不创建第二个脚本标签。

- [ ] **Step 7: Verify initialization, type checking and the original layout test**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440
corepack pnpm check
```

Expected: 2 Playwright tests pass; Astro reports 0 errors.

- [ ] **Step 8: Commit the runtime integration**

```powershell
git add -- package.json pnpm-lock.yaml src/types/sakana.d.ts src/scripts/sakana.ts src/layouts/BaseLayout.astro tests/e2e/sakana.spec.ts
git commit -m "feat: initialize dual sakana characters"
```

---

### Task 3: Cover drag isolation and reduced motion

**Files:**
- Modify: `src/components/SakanaCharacters.astro`
- Modify: `src/scripts/sakana.ts`
- Modify: `tests/e2e/sakana.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts:21-34`

**Interfaces:**
- Consumes: module-level `instances` and the layer states from Task 2.
- Produces: `data-sakana-motion="full|reduced"`, updated when the media query changes.
- Produces: reduced-motion CSS that overrides Sakana's injected pointer styles.

- [ ] **Step 1: Add the failing isolated-drag test**

在 `tests/e2e/sakana.spec.ts` 末尾加入：

```ts
test('dragging one character moves only that instance', async ({ page }) => {
  await page.goto('/');
  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveAttribute('data-sakana-state', 'ready');

  const chisato = layer.locator('[data-sakana-mount="chisato"] .sakana-character');
  const takina = layer.locator('[data-sakana-mount="takina"] .sakana-character');
  const initial = {
    chisato: await chisato.getAttribute('style'),
    takina: await takina.getAttribute('style')
  };
  const box = await chisato.boundingBox();
  if (!box) throw new Error('Chisato is not visible');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.35);

  const draggedStyle = await chisato.getAttribute('style');
  expect(draggedStyle).not.toBe(initial.chisato);
  expect(await takina.getAttribute('style')).toBe(initial.takina);

  await page.mouse.up();
  await expect.poll(() => chisato.getAttribute('style')).not.toBe(draggedStyle);
});
```

- [ ] **Step 2: Extend the reduced-motion accessibility test**

在 `tests/e2e/accessibility.spec.ts` 的 `decorative motion stops when reduced motion is requested` 测试末尾加入：

```ts
  const sakanaLayer = page.locator('[data-sakana-layer]');
  await expect(sakanaLayer).toHaveAttribute('data-sakana-state', 'ready');
  await expect(sakanaLayer).toHaveAttribute('data-sakana-motion', 'reduced');
  await expect(sakanaLayer.locator('a, button, input, [tabindex]')).toHaveCount(0);

  const characters = sakanaLayer.locator('.sakana-character');
  await expect(characters).toHaveCount(2);
  const before = await characters.evaluateAll((elements) =>
    elements.map((element) => ({
      pointerEvents: getComputedStyle(element).pointerEvents,
      transform: element.getAttribute('style')
    }))
  );
  await page.waitForTimeout(250);
  const after = await characters.evaluateAll((elements) =>
    elements.map((element) => ({
      pointerEvents: getComputedStyle(element).pointerEvents,
      transform: element.getAttribute('style')
    }))
  );
  expect(before.every(({ pointerEvents }) => pointerEvents === 'none')).toBe(true);
  expect(after).toEqual(before);
```

- [ ] **Step 3: Run both focused tests and confirm reduced-motion failure**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts tests/e2e/accessibility.spec.ts --project=desktop-1440
```

Expected: the drag test passes; the accessibility test fails because the layer still reports `full` and Sakana remains interactive.

- [ ] **Step 4: Disable Sakana interaction under reduced motion**

在 `src/components/SakanaCharacters.astro` 的样式末尾加入：

```css
  @media (prefers-reduced-motion: reduce) {
    [data-sakana-layer] .sakana-character,
    [data-sakana-layer] .sakana-bed {
      pointer-events: none !important;
    }
  }
```

- [ ] **Step 5: Replace the initializer with media-query-aware behavior**

将 `src/scripts/sakana.ts` 替换为：

```ts
import type { SakanaApi, SakanaInstance } from 'sakana';

const IDLE_TIMEOUT_MS = 1_000;
const FALLBACK_DELAY_MS = 200;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let instances: SakanaInstance[] = [];
let sakanaApi: SakanaApi | undefined;

function applyMotionPreference(reduce: boolean): void {
  const layer = document.querySelector<HTMLElement>('[data-sakana-layer]');
  if (layer) layer.dataset.sakanaMotion = reduce ? 'reduced' : 'full';
  sakanaApi?.setMute(reduce);
  if (reduce) instances.forEach((instance) => instance.pause());
}

async function initializeSakanaCharacters(layer: HTMLElement): Promise<void> {
  if (layer.dataset.sakanaState === 'ready' || layer.dataset.sakanaState === 'loading') return;
  layer.dataset.sakanaState = 'loading';

  try {
    const chisatoMount = layer.querySelector<HTMLElement>('[data-sakana-mount="chisato"]');
    const takinaMount = layer.querySelector<HTMLElement>('[data-sakana-mount="takina"]');
    if (!chisatoMount || !takinaMount) throw new Error('Sakana mount points are missing');

    const { default: Sakana } = await import('sakana');
    sakanaApi = Sakana;

    const baseOptions = {
      r: 0,
      y: 0,
      scale: 1,
      canSwitchCharacter: false
    } as const;

    instances = [
      Sakana.init({ ...baseOptions, el: chisatoMount, character: 'chisato' }),
      Sakana.init({ ...baseOptions, el: takinaMount, character: 'takina' })
    ];
    instances.forEach((instance) => instance.pause());
    layer.dataset.sakanaState = 'ready';
    applyMotionPreference(reducedMotion.matches);
  } catch (error) {
    instances = [];
    sakanaApi = undefined;
    layer.dataset.sakanaState = 'error';
    console.error('Unable to initialize Sakana characters', error);
  }
}

function scheduleSakanaInitialization(): void {
  const layer = document.querySelector<HTMLElement>('[data-sakana-layer]');
  if (!layer || layer.dataset.sakanaState) return;
  layer.dataset.sakanaState = 'scheduled';

  const run = () => {
    if (!layer.isConnected) return;
    void initializeSakanaCharacters(layer);
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
  } else {
    window.setTimeout(run, FALLBACK_DELAY_MS);
  }
}

reducedMotion.addEventListener('change', (event) => applyMotionPreference(event.matches));
document.addEventListener('astro:page-load', scheduleSakanaInitialization);
scheduleSakanaInitialization();
```

- [ ] **Step 6: Run interaction, accessibility and type checks**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts tests/e2e/accessibility.spec.ts --project=desktop-1440
corepack pnpm check
```

Expected: 6 focused Playwright tests pass; Astro reports 0 errors.

- [ ] **Step 7: Commit motion behavior**

```powershell
git add -- src/components/SakanaCharacters.astro src/scripts/sakana.ts tests/e2e/sakana.spec.ts tests/e2e/accessibility.spec.ts
git commit -m "feat: respect reduced motion for sakana"
```

---

### Task 4: Keep mirrored Chisato aligned with pointer movement

**Files:**
- Modify: `src/components/SakanaCharacters.astro`
- Modify: `tests/e2e/sakana.spec.ts`

**Interfaces:**
- Consumes: Task 2 动态生成的 `.sakana-character`、`.sakana-bed` 和两个固定角色 mount。
- Produces: 千束背景位图的 `::before` 镜像；承载物理 `transform` 的 `.sakana-character` 不再处于反射坐标系。
- Produces: 桌面/平板 `left: -50px`、手机 `left: -32px`，两个底座 `display: none`。

- [ ] **Step 1: Replace the layout probe with final artwork and offset checks**

将 `tests/e2e/sakana.spec.ts` 中的 `readSakanaLayout` 替换为：

```ts
async function readSakanaLayout(page: import('@playwright/test').Page) {
  return page.locator('[data-sakana-layer]').evaluate((layer) => {
    const left = layer.querySelector<HTMLElement>('[data-sakana-anchor="left"]');
    const right = layer.querySelector<HTMLElement>('[data-sakana-anchor="right"]');
    const chisato = layer.querySelector<HTMLElement>(
      '[data-sakana-mount="chisato"] .sakana-character'
    );
    const takina = layer.querySelector<HTMLElement>(
      '[data-sakana-mount="takina"] .sakana-character'
    );
    const beds = [...layer.querySelectorAll<HTMLElement>('.sakana-bed')];
    if (!left || !right || !chisato || !takina || beds.length !== 2) {
      throw new Error('Sakana layout is incomplete');
    }

    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height
      };
    };

    return {
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      layerZIndex: getComputedStyle(layer).zIndex,
      chisatoArtworkTransform: getComputedStyle(chisato, '::before').transform,
      takinaArtworkTransform: getComputedStyle(takina, '::before').transform,
      bedDisplays: beds.map((bed) => getComputedStyle(bed).display),
      left: rect(left),
      right: rect(right),
      chisato: rect(chisato)
    };
  });
}
```

将第一个测试替换为：

```ts
test('renders mirrored artwork and responsive mounts without horizontal overflow', async ({ page }) => {
  await page.goto('/');

  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  await expect(layer).toHaveAttribute('data-sakana-state', 'ready');
  await expect(layer.locator('[data-sakana-anchor]')).toHaveCount(2);
  await expect(layer.locator('[data-sakana-mount="chisato"]')).toHaveCount(1);
  await expect(layer.locator('[data-sakana-mount="takina"]')).toHaveCount(1);

  const desktop = await readSakanaLayout(page);
  expect(desktop.layerZIndex).toBe('15');
  expect(desktop.chisatoArtworkTransform).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  expect(desktop.takinaArtworkTransform).toBe('none');
  expect(desktop.bedDisplays).toEqual(['none', 'none']);
  expect(desktop.scrollWidth).toBe(desktop.viewportWidth);
  expect(desktop.left.left).toBeCloseTo(-50, 1);
  expect(desktop.left.bottom).toBeCloseTo(desktop.viewportHeight, 1);
  expect(desktop.left.width).toBeCloseTo(250, 1);
  expect(desktop.left.height).toBeCloseTo(400, 1);
  expect(desktop.chisato.left).toBeCloseTo(0, 1);
  expect(desktop.right.right).toBeCloseTo(desktop.viewportWidth, 1);
  expect(desktop.right.bottom).toBeCloseTo(desktop.viewportHeight, 1);
  expect(desktop.right.width).toBeCloseTo(250, 1);
  expect(desktop.right.height).toBeCloseTo(400, 1);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await readSakanaLayout(page);
  expect(mobile.scrollWidth).toBe(mobile.viewportWidth);
  expect(mobile.left.left).toBeCloseTo(-32, 1);
  expect(mobile.left.bottom).toBeCloseTo(844, 1);
  expect(mobile.left.width).toBeCloseTo(160, 1);
  expect(mobile.left.height).toBeCloseTo(256, 1);
  expect(mobile.chisato.left).toBeCloseTo(0, 1);
  expect(mobile.right.right).toBeCloseTo(390, 1);
  expect(mobile.right.bottom).toBeCloseTo(844, 1);
  expect(mobile.right.width).toBeCloseTo(160, 1);
  expect(mobile.right.height).toBeCloseTo(256, 1);
});
```

- [ ] **Step 2: Require both generated bases to stay hidden**

在初始化与导航测试中，用以下断言替换两个底座的 `dispatchEvent('click')` 和重复角色断言：

```ts
  await expect(chisato.locator('.sakana-bed')).toBeHidden();
  await expect(takina.locator('.sakana-bed')).toBeHidden();
```

保留 `data-can-switch-character` 不为 `true` 的断言，继续验证角色被锁定。

- [ ] **Step 3: Make drag direction observable in both horizontal directions**

将拖拽测试替换为：

```ts
test('dragging Chisato follows the pointer and moves only that instance', async ({ page }) => {
  for (const deltaX of [60, -60]) {
    await page.goto('/');
    const layer = page.locator('[data-sakana-layer]');
    await expect(layer).toHaveAttribute('data-sakana-state', 'ready');

    const chisato = layer.locator('[data-sakana-mount="chisato"] .sakana-character');
    const takina = layer.locator('[data-sakana-mount="takina"] .sakana-character');
    const initialTakinaStyle = await takina.getAttribute('style');
    const initialBox = await chisato.boundingBox();
    if (!initialBox) throw new Error('Chisato is not visible');
    const initialCenterX = initialBox.x + initialBox.width / 2;
    const centerY = initialBox.y + initialBox.height / 2;

    await page.mouse.move(initialCenterX, centerY);
    await page.mouse.down();
    await page.mouse.move(initialCenterX + deltaX, centerY - initialBox.height * 0.15);

    const draggedStyle = await chisato.getAttribute('style');
    const draggedBox = await chisato.boundingBox();
    if (!draggedBox) throw new Error('Chisato disappeared while dragging');
    const visualDeltaX = draggedBox.x + draggedBox.width / 2 - initialCenterX;
    expect(Math.sign(visualDeltaX)).toBe(Math.sign(deltaX));
    expect(await takina.getAttribute('style')).toBe(initialTakinaStyle);

    await page.mouse.up();
    await expect.poll(() => chisato.getAttribute('style')).not.toBe(draggedStyle);
  }
});
```

- [ ] **Step 4: Run the Sakana tests and observe the three regressions**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440
```

Expected: FAIL because the left anchor is still at `0`, both bases are visible, the artwork pseudo-element is not mirrored, and a rightward drag produces a negative visual delta under the whole-widget mirror.

- [ ] **Step 5: Mirror only the bitmap, hide bases and shift Chisato left**

将 `src/components/SakanaCharacters.astro` 替换为：

```astro
<aside
  class="sakana-layer"
  data-sakana-layer
  data-sakana-state=""
  data-sakana-motion=""
  aria-hidden="true"
  transition:persist="sakana-characters"
>
  <div class="sakana-anchor" data-sakana-anchor="left">
    <div class="sakana-box" data-sakana-mount="chisato"></div>
  </div>
  <div class="sakana-anchor" data-sakana-anchor="right">
    <div class="sakana-box" data-sakana-mount="takina"></div>
  </div>
</aside>

<style is:global>
  [data-sakana-layer] {
    position: fixed;
    z-index: 15;
    inset: 0;
    overflow: clip;
    pointer-events: none;
  }

  [data-sakana-anchor] {
    --sakana-scale: 0.5;
    position: absolute;
    bottom: 0;
    width: 500px;
    height: 800px;
    pointer-events: none;
    transform: scale(var(--sakana-scale));
  }

  [data-sakana-anchor='left'] {
    left: -50px;
    transform-origin: left bottom;
  }

  [data-sakana-anchor='right'] {
    right: 0;
    transform-origin: right bottom;
  }

  [data-sakana-mount='chisato'] .sakana-character {
    background-size: 0 0 !important;
  }

  [data-sakana-mount='chisato'] .sakana-character::before {
    position: absolute;
    inset: 0;
    background-image: inherit;
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    content: '';
    pointer-events: none;
    transform: scaleX(-1);
  }

  [data-sakana-layer] .sakana-bed {
    display: none !important;
  }

  @media (max-width: 480px) {
    [data-sakana-anchor] {
      --sakana-scale: 0.32;
    }

    [data-sakana-anchor='left'] {
      left: -32px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [data-sakana-layer] .sakana-character,
    [data-sakana-layer] .sakana-bed {
      pointer-events: none !important;
    }
  }
</style>
```

- [ ] **Step 6: Run focused behavior and type checks**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440
corepack pnpm exec playwright test tests/e2e/accessibility.spec.ts --project=desktop-1440
corepack pnpm check
```

Expected: 3 Sakana tests and 3 accessibility tests pass; Astro reports 0 errors.

- [ ] **Step 7: Commit the corrected mirror interaction**

```powershell
git add -- src/components/SakanaCharacters.astro tests/e2e/sakana.spec.ts
git commit -m "fix: align mirrored sakana drag direction"
```

---

### Task 5: Stabilize visual coverage and documentation counts

**Files:**
- Modify: `tests/e2e/visual.spec.ts:16-23`
- Modify: `tests/e2e/visual.spec.ts-snapshots/*.png`
- Modify: `AGENTS.md:39`
- Modify: `README.md:138`
- Modify: `docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md:264`

**Interfaces:**
- Consumes: `data-sakana-state="ready"` from Task 2.
- Produces: 66 Playwright checks in 9 files and 21 updated Windows visual baselines.

- [ ] **Step 1: Wait for Sakana before every visual capture**

在 `tests/e2e/visual.spec.ts` 的 `await page.goto(path);` 后加入：

```ts
    await expect(page.locator('[data-sakana-layer]')).toHaveAttribute('data-sakana-state', 'ready');
```

- [ ] **Step 2: Prove the old visual baselines detect the feature**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/visual.spec.ts
```

Expected: existing snapshots fail because both corner characters are new; structural assertions, including `scrollWidth === clientWidth`, still pass.

- [ ] **Step 3: Regenerate the 21 Windows baselines**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Expected: 21 visual tests pass and the existing 21 PNG files are updated without platform suffixes.

- [ ] **Step 4: Inspect representative desktop, tablet and mobile images**

检查以下文件，确认千束只出现在左下且面朝右，泷奈只出现在右下且面朝左，两者没有遮住导航或产生裁切异常：

```text
tests/e2e/visual.spec.ts-snapshots/home-desktop-1440.png
tests/e2e/visual.spec.ts-snapshots/home-tablet-768.png
tests/e2e/visual.spec.ts-snapshots/home-mobile-390.png
```

- [ ] **Step 5: Update current test-count documentation**

在 `AGENTS.md` 中将对应句子改为：

```markdown
- Playwright 有 66 项检查和 21 张 Windows 视觉基线，命名不含平台后缀。Pages workflow 不运行视觉套件。
```

在 `README.md` 的命令表中将对应单元格改为：

```markdown
Chromium 的桌面、平板和手机检查，共 66 项；其中 21 张视觉快照在 Windows 生成，文件名不含平台后缀
```

在 `docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md` 中将对应句子改为：

```markdown
- 静态构建生成 80 个 HTML 页面；Playwright 共 66 项检查和 21 张 Windows 视觉基线，快照名不含平台后缀。Pages workflow 不运行视觉套件。
```

- [ ] **Step 6: Verify the discovered test and snapshot counts**

Run:

```powershell
corepack pnpm exec playwright test --list
git ls-files 'tests/e2e/visual.spec.ts-snapshots/*.png' | Measure-Object
```

Expected: `Total: 66 tests in 9 files`; the PNG count remains 21.

- [ ] **Step 7: Commit visual coverage and count updates**

```powershell
git add -- tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots AGENTS.md README.md docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md
git commit -m "test: cover dual sakana visuals"
```

---

### Task 6: Run the completion gates and keep a local preview open

**Files:**
- Verify only; do not add `dist/`, `.astro/`, `reports/`, `test-results/` or Playwright traces.

**Interfaces:**
- Consumes: all implementation and tests from Tasks 1-5.
- Produces: command evidence for every acceptance criterion and a local preview at `http://127.0.0.1:4321/`.

- [ ] **Step 1: Run unit and type checks**

```powershell
corepack pnpm test:run
corepack pnpm check
```

Expected: all Vitest tests pass; Astro reports 0 errors.

- [ ] **Step 2: Validate remote article images and build the static site**

```powershell
corepack pnpm check:images
corepack pnpm build
```

Expected: image inventory passes; Astro builds 80 HTML pages and includes `dist/CNAME`.

- [ ] **Step 3: Validate built links**

```powershell
corepack pnpm check:site
```

Expected: the existing 4,653 internal-link checks pass because the component adds no links.

- [ ] **Step 4: Run all 66 Playwright checks**

```powershell
corepack pnpm test:e2e
```

Expected: 66 tests pass, including 21 visual comparisons.

- [ ] **Step 5: Check the Sakana delivery path and relevant gzip budget**

Run:

```powershell
rg -n --glob '*.html' "cdn\.jsdelivr\.net/npm/sakana|lab\.magiconch\.com/sakana" dist
node -e 'const fs=require("fs"),path=require("path"),z=require("zlib");const dir="dist/_astro";const html=fs.readFileSync("dist/index.html","utf8");const js=fs.readdirSync(dir).filter(f=>f.endsWith(".js"));const direct=[...html.matchAll(/<script[^>]+src="\/_astro\/([^"]+\.js)"/g)].map(m=>m[1]);const marked=js.filter(f=>{const s=fs.readFileSync(path.join(dir,f),"utf8");return s.includes("data-sakana-layer")||s.includes("chin~a~na~go")});const chosen=[...new Set([...direct,...marked])];const total=chosen.reduce((n,f)=>n+z.gzipSync(fs.readFileSync(path.join(dir,f)),{level:9}).length,0);console.log({files:chosen,totalGzipBytes:total,limit:160*1024});if(total>160*1024)process.exit(1)'
```

Expected: `rg` exits 1 because no built HTML loads Sakana from a remote URL. The bundled JavaScript may retain the upstream project homepage as a `console` message; the runtime request assertion in `tests/e2e/sakana.spec.ts` verifies that it is not fetched. The selected base router, Sakana initializer and Sakana payload stay at or below 163,840 gzip bytes. The upstream Sakana payload measured before implementation is 83,651 gzip bytes.

- [ ] **Step 6: Inspect final repository state**

```powershell
git status --short
git log -5 --oneline
```

Expected: the isolated feature worktree is clean; the user's unrelated edits remain untouched in the original `master` worktree. Generated build, report and test artifacts are ignored.

- [ ] **Step 7: Start the required local preview**

```powershell
$preview = Start-Process -FilePath 'corepack.cmd' -ArgumentList 'pnpm','dev','--host','127.0.0.1' -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$preview.Id
```

Poll `http://127.0.0.1:4321/` until it returns HTTP 200. Keep the process running for the user.

- [ ] **Step 8: Verify the live page in a browser**

Open `http://127.0.0.1:4321/` at desktop and mobile widths. Confirm both characters, orientation, drag behavior, fixed corners, theme-overlay stacking and the absence of horizontal scrolling. Save screenshots only under ignored test output directories, not the repository root.

---

### Task 7: Scope the empty-player audio regression and close verification

**Files:**
- Modify: `tests/e2e/interactions.spec.ts:317-382`

**Interfaces:**
- Consumes: `sakana@1.0.8` 创建的两条 `data:audio/x-m4a;base64` 内嵌语音。
- Produces: `window.__audioSources` 测试探针，用来源而不是全局构造次数区分 Sakana 语音与歌单音频。
- Verifies: built HTML has no remote Sakana URL, runtime has no remote Sakana request, and all 66 E2E checks pass.

- [ ] **Step 1: Reproduce the stale global-Audio assertion**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/interactions.spec.ts --project=desktop-1440 -g "empty music player"
```

Expected: FAIL at the final `__audioConstructed === 0` assertion with actual value 2. Both constructor arguments are `data:audio/x-m4a;base64` Sakana voices, while `mediaRequests` remains empty.

- [ ] **Step 2: Record audio sources instead of attributing every Audio to the player**

将测试名称改为：

```ts
test('empty music player persists without constructing track audio or requesting media', async ({ page }) => {
```

将 `page.addInitScript` 替换为：

```ts
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const trackedWindow = window as Window & { __audioSources?: string[] };
    Object.defineProperty(trackedWindow, '__audioSources', { value: [] });
    window.Audio = new Proxy(NativeAudio, {
      construct(target, args) {
        trackedWindow.__audioSources?.push(String(args[0] ?? ''));
        return Reflect.construct(target, args);
      }
    });
  });
```

将最终的 `__audioConstructed` 断言替换为：

```ts
  const audioSources = await page.evaluate(
    () => (window as Window & { __audioSources?: string[] }).__audioSources ?? []
  );
  expect(audioSources).toHaveLength(2);
  expect(audioSources.every((source) => source.startsWith('data:audio/x-m4a;base64,'))).toBe(true);
```

保留 `expect(mediaRequests).toEqual([])`，继续证明页面没有发出媒体请求。

- [ ] **Step 3: Run the corrected focused test**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/interactions.spec.ts --project=desktop-1440 -g "empty music player"
```

Expected: PASS, 1 test. The probe sees exactly two embedded Sakana voices and no track/network media.

- [ ] **Step 4: Stop the ordinary preview and rerun the full E2E suite**

```powershell
corepack pnpm exec astro dev stop
corepack pnpm test:e2e
```

Expected: Playwright starts its own `PLAYWRIGHT_TEST=1` server; all 66 tests pass, including 21 visual comparisons.

- [ ] **Step 5: Recheck HTML delivery and runtime request coverage**

```powershell
rg -n --glob '*.html' "cdn\.jsdelivr\.net/npm/sakana|lab\.magiconch\.com/sakana" dist
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440 -g "initializes locked roles"
```

Expected: `rg` exits 1 with no built-HTML matches. The focused browser test passes and its request listener records no remote Sakana request. The upstream JavaScript's `console` homepage constant is allowed because it is not loaded as a resource.

- [ ] **Step 6: Commit the corrected regression scope**

```powershell
git add -- tests/e2e/interactions.spec.ts
git commit -m "test: distinguish sakana voices from track audio"
```

- [ ] **Step 7: Restore the user-facing preview**

```powershell
$preview = Start-Process -FilePath 'corepack.cmd' -ArgumentList 'pnpm','dev','--host','127.0.0.1' -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$preview.Id
```

Poll `http://127.0.0.1:4321/` until it returns HTTP 200. Record the listening `node.exe` PID and keep it running.
