# 首页首屏原子呈现 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页人物和播放器只在最终状态就绪后出现，恢复金句与 `Hatrix` 名称，并把 29 张人物分块优化为裁边透明 WebP。

**Architecture:** 人物组件和播放器各自维护可观察的就绪状态，页面加载器只等待这些状态与背景图，不再读取组件内部的单张资源。人物图片通过可重复运行的 Sharp 脚本裁边并生成带坐标的类型化清单；首页布局恢复金句面板，并在等级圆环右侧增加独立名称面板。

**Tech Stack:** Astro 7、TypeScript、Sharp、Vitest、Playwright、Astro ClientRouter、CSS `prefers-reduced-motion`。

## Global Constraints

- 人物 29 个分块全部加载并解码后才能整体显示；不能使用逐块淡入或 stagger。
- 任一分块失败或等待超过 8 秒时，加载遮罩可以结束，但人物保持隐藏。
- 首页进度在背景、人物和播放器结束前最高为 85%，之后才到 100%。
- 播放器首次可见帧必须是首页左下角的最终几何，不播放位置校正动画。
- 等级圆环必须保留；`Hatrix` 名称放到圆环右侧，设计画布间距至少 12px。
- 金句每 15 秒自动切换，保留双击、键盘和暂停控制；减少动态效果时默认暂停。
- 裁切后的 29 张无损透明 WebP 总大小不超过 1.25 MiB，理论 RGBA 解码量不超过 22 MiB。
- 保留播放器 `transition:persist` 与同一个 Audio，不改右侧面板、人物骨骼层级和动作幅度。
- 无 JavaScript 时显示静态人物、名称和金句；播放器可以保持非交互状态。
- 不启动或遗留后台预览服务；浏览器验证使用 Playwright 自带的临时服务器。

## File Map

- `scripts/optimize-character-parts.ts`：从源码 PNG 计算 alpha 边界、生成无损 WebP 和类型化偏移清单。
- `src/assets/home/character-parts-source/*.png`：不发布的 29 张原始人物分块。
- `public/character-parts/*.webp`：浏览器实际加载的裁边分块。
- `src/data/character-parts.ts`：生成的 `src/x/y/width/height` 清单。
- `src/lib/image-readiness.ts`：等待图片 load、decode、失败和超时的可测试逻辑。
- `src/components/CharacterIdle.astro`、`src/scripts/character-idle.ts`：人物资源定位和整体状态门控。
- `src/components/MusicPlayer.astro`、`src/scripts/music-player.ts`：播放器首帧布局状态和持久化模式同步。
- `src/scripts/page-loader.ts`：首页背景、人物和播放器的统一完成条件。
- `src/pages/index.astro`、`src/scripts/home-dashboard.ts`、`src/data/home-quotes.ts`：恢复名称与金句。
- `tests/unit/character-parts.test.ts`、`tests/unit/image-readiness.test.ts`、`tests/unit/music-player.test.ts`：资源、状态与播放器单元测试。
- `tests/e2e/home-loading.spec.ts`、`tests/e2e/home.spec.ts`、`tests/e2e/no-js.spec.ts`：首屏时序、交互和降级测试。

---

### Task 1: 生成裁边透明 WebP 与偏移清单

**Files:**
- Create: `scripts/optimize-character-parts.ts`
- Create: `src/data/character-parts.ts`（由脚本生成）
- Create: `tests/unit/character-parts.test.ts`
- Move: `public/character-parts/*.png` → `src/assets/home/character-parts-source/*.png`
- Create: `public/character-parts/*.webp`
- Modify: `package.json`

**Interfaces:**
- Produces: `CHARACTER_CANVAS`、`CHARACTER_PARTS`、`CharacterPartName`、`CharacterPart`。
- Consumers: Task 2 的 `CharacterIdle.astro` 和资源预算测试。

- [ ] **Step 1: 写资源清单失败测试**

Create `tests/unit/character-parts.test.ts`:

```ts
import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifestPath = 'src/data/character-parts.ts';

describe('character part assets', () => {
  it('publishes 29 cropped WebP layers within the original canvas and budgets', async () => {
    expect(existsSync(manifestPath)).toBe(true);
    if (!existsSync(manifestPath)) return;

    const { CHARACTER_CANVAS, CHARACTER_PARTS } = await import('../../src/data/character-parts');
    const parts = Object.values(CHARACTER_PARTS);
    const publicFiles = readdirSync('public/character-parts');
    const webpFiles = publicFiles.filter((file) => file.endsWith('.webp'));
    const pngFiles = publicFiles.filter((file) => file.endsWith('.png'));
    const encodedBytes = webpFiles.reduce(
      (total, file) => total + statSync(`public/character-parts/${file}`).size,
      0,
    );
    const decodedBytes = parts.reduce((total, part) => total + part.width * part.height * 4, 0);

    expect(parts).toHaveLength(29);
    expect(webpFiles).toHaveLength(29);
    expect(pngFiles).toHaveLength(0);
    expect(encodedBytes).toBeLessThanOrEqual(1.25 * 1024 * 1024);
    expect(decodedBytes).toBeLessThanOrEqual(22 * 1024 * 1024);
    for (const part of parts) {
      expect(existsSync(`public${part.src}`)).toBe(true);
      expect(part.x).toBeGreaterThanOrEqual(0);
      expect(part.y).toBeGreaterThanOrEqual(0);
      expect(part.width).toBeGreaterThan(0);
      expect(part.height).toBeGreaterThan(0);
      expect(part.x + part.width).toBeLessThanOrEqual(CHARACTER_CANVAS.width);
      expect(part.y + part.height).toBeLessThanOrEqual(CHARACTER_CANVAS.height);
    }
  });
});
```

- [ ] **Step 2: 运行测试并确认缺少清单**

Run:

```powershell
corepack pnpm exec vitest run tests/unit/character-parts.test.ts
```

Expected: FAIL at `existsSync(manifestPath)`.

- [ ] **Step 3: 建立可重复运行的转换脚本**

Create `scripts/optimize-character-parts.ts`:

```ts
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceRoot = resolve(root, 'src/assets/home/character-parts-source');
const outputRoot = resolve(root, 'public/character-parts');
const manifestPath = resolve(root, 'src/data/character-parts.ts');

type Bounds = { x: number; y: number; width: number; height: number };

function alphaBounds(data: Buffer, width: number, height: number): Bounds {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0 || maxY < 0) throw new Error('Character part is fully transparent');
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  const existing = await readdir(outputRoot);
  await Promise.all(
    existing
      .filter((file) => /\.(?:png|webp)$/i.test(file))
      .map((file) => rm(join(outputRoot, file))),
  );

  const files = (await readdir(sourceRoot)).filter((file) => file.endsWith('.png')).sort();
  if (files.length !== 29) throw new Error(`Expected 29 source PNGs, found ${files.length}`);

  const parts: Record<string, { src: string } & Bounds> = {};
  for (const file of files) {
    const input = join(sourceRoot, file);
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 1024 || info.height !== 1536 || info.channels !== 4) {
      throw new Error(`${file} must be a 1024x1536 RGBA image`);
    }
    const bounds = alphaBounds(data, info.width, info.height);
    const name = basename(file, '.png');
    const output = join(outputRoot, `${name}.webp`);
    await sharp(input)
      .extract({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height })
      .webp({ lossless: true, effort: 6 })
      .toFile(output);
    parts[name] = { src: `/character-parts/${name}.webp`, ...bounds };
  }

  const source = `export interface CharacterPart {\n  src: string;\n  x: number;\n  y: number;\n  width: number;\n  height: number;\n}\n\nexport const CHARACTER_CANVAS = { width: 1024, height: 1536 } as const;\n\nexport const CHARACTER_PARTS = ${JSON.stringify(parts, null, 2)} as const satisfies Record<string, CharacterPart>;\n\nexport type CharacterPartName = keyof typeof CHARACTER_PARTS;\n`;
  await writeFile(manifestPath, source, 'utf8');
}

void main();
```

Add to `package.json`:

```json
"optimize:character": "tsx scripts/optimize-character-parts.ts"
```

- [ ] **Step 4: 安全移动源文件并生成资源**

Run from the repository root after verifying both resolved paths remain inside the repository:

```powershell
$sourceDir = Resolve-Path -LiteralPath 'public/character-parts'
$targetDir = Join-Path (Get-Location) 'src/assets/home/character-parts-source'
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Get-ChildItem -LiteralPath $sourceDir -File -Filter '*.png' | Move-Item -Destination $targetDir
corepack pnpm optimize:character
```

Expected: 29 source PNGs under `src/assets/home/character-parts-source/`, 29 WebPs under `public/character-parts/`, and a generated TypeScript manifest.

- [ ] **Step 5: 运行资源测试**

Run:

```powershell
corepack pnpm exec vitest run tests/unit/character-parts.test.ts
```

Expected: PASS with 29 files, encoded size ≤ 1.25 MiB, decoded RGBA budget ≤ 22 MiB.

- [ ] **Step 6: 提交资源优化**

```powershell
git add -- package.json scripts/optimize-character-parts.ts src/assets/home/character-parts-source src/data/character-parts.ts public/character-parts tests/unit/character-parts.test.ts
git commit -m "perf: optimize homepage character layers"
```

---

### Task 2: 给人物增加整体加载与解码门控

**Files:**
- Create: `src/lib/image-readiness.ts`
- Create: `tests/unit/image-readiness.test.ts`
- Modify: `src/components/CharacterIdle.astro`
- Modify: `src/scripts/character-idle.ts`

**Interfaces:**
- Produces: `waitForImages(images, timeoutMs, signal): Promise<'ready' | 'error'>`。
- Produces DOM state: `[data-char-rig][data-character-state='loading|ready|error']` and `hatrix:character-state`.
- Consumers: Task 4 的页面加载器和 Task 6 的浏览器测试。

- [ ] **Step 1: 写图片等待失败测试**

Create `tests/unit/image-readiness.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForImages, type ReadinessImage } from '../../src/lib/image-readiness';

class FakeImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  loading = 'lazy';
  decode = vi.fn(async () => undefined);
}

describe('image readiness', () => {
  afterEach(() => vi.useRealTimers());

  it('waits for every successful image and decode', async () => {
    const first = new FakeImage();
    const second = new FakeImage();
    const result = waitForImages([first, second] as ReadinessImage[], 8_000);
    first.complete = true;
    first.naturalWidth = 100;
    first.dispatchEvent(new Event('load'));
    second.complete = true;
    second.naturalWidth = 100;
    second.dispatchEvent(new Event('load'));
    await expect(result).resolves.toBe('ready');
    expect(first.loading).toBe('eager');
    expect(second.loading).toBe('eager');
    expect(first.decode).toHaveBeenCalledOnce();
    expect(second.decode).toHaveBeenCalledOnce();
  });

  it('returns error for a failed image', async () => {
    const image = new FakeImage();
    const result = waitForImages([image] as ReadinessImage[], 8_000);
    image.dispatchEvent(new Event('error'));
    await expect(result).resolves.toBe('error');
  });

  it('returns error at the eight-second deadline', async () => {
    vi.useFakeTimers();
    const image = new FakeImage();
    const result = waitForImages([image] as ReadinessImage[], 8_000);
    await vi.advanceTimersByTimeAsync(8_000);
    await expect(result).resolves.toBe('error');
  });
});
```

- [ ] **Step 2: 运行测试并确认模块不存在**

Run:

```powershell
corepack pnpm exec vitest run tests/unit/image-readiness.test.ts
```

Expected: FAIL because `src/lib/image-readiness.ts` does not exist.

- [ ] **Step 3: 实现可取消的图片等待逻辑**

Create `src/lib/image-readiness.ts`:

```ts
export type ReadinessImage = EventTarget & {
  complete: boolean;
  naturalWidth: number;
  loading: string;
  decode(): Promise<void>;
};

function waitForLoad(image: ReadinessImage, signal: AbortSignal): Promise<boolean> {
  image.loading = 'eager';
  if (image.complete) return Promise.resolve(image.naturalWidth > 0);
  return new Promise((resolve) => {
    const finish = (value: boolean) => resolve(value);
    image.addEventListener('load', () => finish(image.naturalWidth > 0), { once: true, signal });
    image.addEventListener('error', () => finish(false), { once: true, signal });
    signal.addEventListener('abort', () => finish(false), { once: true });
  });
}

export async function waitForImages(
  images: ReadinessImage[],
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<'ready' | 'error'> {
  const controller = new AbortController();
  parentSignal?.addEventListener('abort', () => controller.abort(), { once: true });
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<false>((resolve) => {
    timeout = globalThis.setTimeout(() => resolve(false), timeoutMs);
  });
  const settled = Promise.all(images.map(async (image) => {
    if (!(await waitForLoad(image, controller.signal))) return false;
    try {
      await image.decode();
      return image.naturalWidth > 0;
    } catch {
      return false;
    }
  })).then((results) => results.every(Boolean));
  const ready = await Promise.race([settled, deadline]);
  globalThis.clearTimeout(timeout);
  controller.abort();
  return ready ? 'ready' : 'error';
}
```

- [ ] **Step 4: 让 CharacterIdle 使用裁切清单和整体状态**

In `src/components/CharacterIdle.astro`, import the manifest and add a helper:

```astro
---
import { CHARACTER_PARTS, type CharacterPartName } from '@/data/character-parts';

const part = (name: CharacterPartName) => {
  const value = CHARACTER_PARTS[name];
  return {
    src: value.src,
    width: value.width,
    height: value.height,
    style: `left:${value.x}px;top:${value.y}px;width:${value.width}px;height:${value.height}px`
  };
};
---
```

Change the outer node and retain the existing bone hierarchy:

```astro
<div class="char-rig-outer" data-char-rig data-character-state="loading" aria-hidden="true">
  <img {...part('coat_back_R')} class="char-layer" data-part="coat_back_R" alt="" draggable="false" loading="lazy" decoding="async" />
</div>
<noscript><style is:global>[data-char-rig] { visibility: visible !important; }</style></noscript>
```

Apply these exact source substitutions to the existing 29 image nodes; keep their current order, wrapper and class names:

```text
/character-parts/cable_cuff_connector.png  -> {...part('cable_cuff_connector')}
/character-parts/cable_upper.png           -> {...part('cable_upper')}
/character-parts/cable_waist_connector.png -> {...part('cable_waist_connector')}
/character-parts/coat_back_R.png           -> {...part('coat_back_R')}
/character-parts/coat_back_center.png      -> {...part('coat_back_center')}
/character-parts/coat_front_purple.png     -> {...part('coat_front_purple')}
/character-parts/coat_front_white.png      -> {...part('coat_front_white')}
/character-parts/cuff_L.png                -> {...part('cuff_L')}
/character-parts/cuff_R.png                -> {...part('cuff_R')}
/character-parts/foot_L.png                -> {...part('foot_L')}
/character-parts/foot_R.png                -> {...part('foot_R')}
/character-parts/forearm_L.png             -> {...part('forearm_L')}
/character-parts/gauntlet_R.png            -> {...part('gauntlet_R')}
/character-parts/hand_L.png                -> {...part('hand_L')}
/character-parts/hand_R.png                -> {...part('hand_R')}
/character-parts/harness_chest.png          -> {...part('harness_chest')}
/character-parts/head.png                   -> {...part('head')}
/character-parts/inner_cloth.png            -> {...part('inner_cloth')}
/character-parts/leg_device_L.png           -> {...part('leg_device_L')}
/character-parts/leg_device_R.png           -> {...part('leg_device_R')}
/character-parts/neck.png                   -> {...part('neck')}
/character-parts/pants_L.png                -> {...part('pants_L')}
/character-parts/pants_R.png                -> {...part('pants_R')}
/character-parts/sleeve_L.png               -> {...part('sleeve_L')}
/character-parts/sleeve_R.png               -> {...part('sleeve_R')}
/character-parts/torso_jacket.png            -> {...part('torso_jacket')}
/character-parts/waist_belt.png              -> {...part('waist_belt')}
/character-parts/waist_device_inner.png      -> {...part('waist_device_inner')}
/character-parts/waist_device_outer.png      -> {...part('waist_device_outer')}
```

Replace the full-canvas `.char-layer` sizing with:

```css
.char-rig-outer { visibility: hidden; }
.char-rig-outer[data-character-state='ready'] { visibility: visible; }
.char-rig-outer:not([data-character-state='ready']) .bone-wrapper {
  animation-play-state: paused;
}
.char-layer {
  position: absolute;
  display: block;
  max-width: none;
}
```

- [ ] **Step 5: 在人物脚本中设置状态并派发事件**

Add to `src/scripts/character-idle.ts` after locating the rig:

```ts
import { waitForImages, type ReadinessImage } from '@/lib/image-readiness';

async function prepareCharacter(rig: HTMLElement, signal: AbortSignal): Promise<void> {
  rig.dataset.characterState = 'loading';
  const images = [...rig.querySelectorAll<HTMLImageElement>('img')] as ReadinessImage[];
  const state = await waitForImages(images, 8_000, signal);
  if (signal.aborted) return;
  rig.dataset.characterState = state;
  document.dispatchEvent(new CustomEvent('hatrix:character-state', {
    detail: { state },
  }));
}

void prepareCharacter(rig, signal);
```

Do not change the existing bones, keyframes, cleanup handlers, or debug overlay.

- [ ] **Step 6: 运行人物单元测试**

Run:

```powershell
corepack pnpm exec vitest run tests/unit/image-readiness.test.ts tests/unit/character-parts.test.ts
corepack pnpm check
```

Expected: both test files pass; Astro reports 0 errors.

- [ ] **Step 7: 提交人物状态门控**

```powershell
git add -- src/components/CharacterIdle.astro src/scripts/character-idle.ts src/lib/image-readiness.ts tests/unit/image-readiness.test.ts
git commit -m "fix: reveal homepage character atomically"
```

---

### Task 3: 让播放器在最终位置就绪后再显示

**Files:**
- Modify: `src/components/MusicPlayer.astro`
- Modify: `src/scripts/music-player.ts`
- Modify: `tests/unit/music-player.test.ts`

**Interfaces:**
- Produces: `synchronizeMusicPlayerLayout(player, root, pathname): void`。
- Produces DOM state: `[data-music-player][data-layout-state='pending|ready']` and `hatrix:player-layout-ready`。
- Consumers: Task 4 的页面加载器和 Task 6 的浏览器测试。

- [ ] **Step 1: 扩展播放器 fixture 并写失败测试**

Update `PlayerElement` and `playerFixture` in `tests/unit/music-player.test.ts`:

```ts
class PlayerElement extends EventTarget {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  inert = false;
  offsetWidth = 380;
  controls = new Map<string, PlayerElement>();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  querySelector(selector: string) { return this.controls.get(selector) ?? null; }
  closest() { return null; }
}
```

Replace `playerFixture()` with this version so `root.querySelector()` returns a separate music panel:

```ts
function playerFixture(pathname: string) {
  const player = new PlayerElement();
  const panel = new PlayerElement();
  const toggle = new PlayerElement();
  const main = new PlayerElement();
  player.controls.set('[data-player-toggle]', toggle);
  player.controls.set('[data-player-main]', main);
  const location = { pathname };
  const root = {
    querySelector: (selector: string) => {
      if (selector === '[data-music-player]') return player;
      if (selector === '[data-home-panel="music"]') return panel;
      return null;
    },
    defaultView: Object.assign(new EventTarget(), { location }),
  } as unknown as Document;
  return { player, panel, toggle, main, location, root };
}
```

Then add:

```ts
it('hides the home player until the final panel geometry is committed', () => {
  const { root, player, panel } = playerFixture('/');
  panel.style.left = '12px';
  panel.style.top = '785px';
  panel.style.transform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,12,785,0,1)';
  initializeMusicPlayer([], root);
  expect(player.dataset.layoutState).toBe('ready');
  expect(player.style.left).toBe(panel.style.left);
  expect(player.style.top).toBe(panel.style.top);
  expect(player.style.transform).toBe(panel.style.transform);
  expect(player.style.transformOrigin).toBe('0 0');
});
```

- [ ] **Step 2: 运行测试并确认 layout state 缺失**

Run:

```powershell
corepack pnpm exec vitest run tests/unit/music-player.test.ts
```

Expected: FAIL because `data-layout-state` is not set.

- [ ] **Step 3: 添加服务端初始状态和 pending 样式**

In `src/components/MusicPlayer.astro`, add:

```astro
data-layout-state={mode === 'home' ? 'pending' : 'ready'}
```

Add CSS:

```css
.music-player[data-display-mode='home'][data-layout-state='pending'] {
  visibility: hidden;
  transition: none;
}
```

- [ ] **Step 4: 抽出同步布局函数并处理持久化导航**

Add to `src/scripts/music-player.ts`:

```ts
export function synchronizeMusicPlayerLayout(
  player: HTMLElement,
  root: Document,
  pathname: string | undefined,
): void {
  const mode = pathname === '/' ? 'home' : 'dock';
  player.dataset.displayMode = mode;
  if (mode === 'home') {
    player.dataset.layoutState = 'pending';
    const panel = root.querySelector<HTMLElement>('[data-home-panel="music"]');
    if (!panel) return;
    player.style.left = panel.style.left || '0px';
    player.style.top = panel.style.top || '0px';
    player.style.transform = panel.style.transform || '';
    player.style.transformOrigin = '0 0';
    void player.offsetWidth;
  } else {
    player.style.left = '';
    player.style.top = '';
    player.style.transform = '';
    player.style.transformOrigin = '';
  }
  player.dataset.layoutState = 'ready';
  root.dispatchEvent?.(new CustomEvent('hatrix:player-layout-ready'));
}
```

Call this function from `initializeMusicPlayer()` before event binding. Add a pre-navigation listener:

```ts
document.addEventListener('astro:before-preparation', (raw) => {
  const to = (raw as unknown as { to?: URL }).to;
  if (to?.pathname === '/') {
    document.querySelector<HTMLElement>('[data-music-player]')?.setAttribute('data-layout-state', 'pending');
  }
});
```

Keep the existing `changedPage`, `setExpanded`, `data-player-path` and `data-bound` behavior.

- [ ] **Step 5: 运行播放器单元测试**

Run:

```powershell
corepack pnpm exec vitest run tests/unit/music-player.test.ts
```

Expected: PASS; empty playlists still do not construct Audio, and persisted navigation stays bound once.

- [ ] **Step 6: 提交播放器首帧修复**

```powershell
git add -- src/components/MusicPlayer.astro src/scripts/music-player.ts tests/unit/music-player.test.ts
git commit -m "fix: reveal homepage player at final position"
```

---

### Task 4: 让首页加载器等待统一就绪状态

**Files:**
- Modify: `src/scripts/page-loader.ts`
- Create: `tests/e2e/home-loading.spec.ts`

**Interfaces:**
- Consumes: `data-character-state`、`hatrix:character-state`、`data-layout-state`、`hatrix:player-layout-ready`。
- Produces: 只有背景和两个组件状态结束后才调用 `complete()`。

- [ ] **Step 1: 写延迟最后一个人物分块的失败测试**

Create `tests/e2e/home-loading.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('holds the loader and character until every layer is decoded', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/character-parts/foot_L.webp', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const rig = page.locator('[data-char-rig]');
  const loader = page.locator('#page-loader');
  await expect(rig).toHaveAttribute('data-character-state', 'loading');
  await expect(rig).toBeHidden();
  await expect(loader).toHaveClass(/pl-visible/);
  await expect(loader.locator('.pl-pct-num')).not.toHaveText('100%');
  release();
  await expect(rig).toHaveAttribute('data-character-state', 'ready');
  await expect(rig).toBeVisible();
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('dismisses the loader but keeps a failed character hidden', async ({ page }) => {
  await page.route('**/character-parts/foot_L.webp', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'error');
  await expect(page.locator('[data-char-rig]')).toBeHidden();
  await expect(page.locator('#page-loader')).not.toHaveClass(/pl-visible/);
});
```

- [ ] **Step 2: 运行测试并确认加载器提前结束**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/home-loading.spec.ts --project=desktop-1440
```

Expected: first test fails because the loader still waits for only one image; second test fails because the rig has no error-aware loader contract.

- [ ] **Step 3: 用属性和事件等待组件状态**

Replace the single-image branch in `waitHomeDone()` with these helpers in `src/scripts/page-loader.ts`:

```ts
function waitForState(
  element: HTMLElement | null,
  key: string,
  terminal: readonly string[],
  eventName: string,
  signal: AbortSignal,
): Promise<void> {
  if (!element || terminal.includes(element.dataset[key] ?? '')) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      if (!terminal.includes(element.dataset[key] ?? '')) return;
      resolve();
    };
    document.addEventListener(eventName, finish, { signal });
  });
}

function waitForBackground(): Promise<void> {
  const canvas = document.querySelector<HTMLElement>('[data-home-canvas]');
  const value = canvas?.style.getPropertyValue('--home-background-image') ?? '';
  const src = value.replace(/^url\(["']?/, '').replace(/["']?\)$/, '').trim();
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = probe.onerror = () => resolve();
    probe.src = src;
    if (probe.complete) resolve();
  });
}
```

Implement `waitHomeDone()` as:

```ts
function waitHomeDone(s: State): void {
  const rig = document.querySelector<HTMLElement>('[data-char-rig]');
  const player = document.querySelector<HTMLElement>('[data-music-player]');
  const controller = new AbortController();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(guard);
    controller.abort();
    complete(s);
  };
  const guard = window.setTimeout(() => {
    if (rig?.dataset.characterState === 'loading') {
      rig.dataset.characterState = 'error';
      document.dispatchEvent(new CustomEvent('hatrix:character-state', { detail: { state: 'error' } }));
    }
    finish();
  }, 8_000);

  void Promise.all([
    waitForBackground(),
    waitForState(rig, 'characterState', ['ready', 'error'], 'hatrix:character-state', controller.signal),
    waitForState(player, 'layoutState', ['ready'], 'hatrix:player-layout-ready', controller.signal),
  ]).then(finish);
}
```

Keep `fakeProgress(s, 85)` unchanged so it cannot reach 100 before `complete()`.

- [ ] **Step 4: 运行首页加载测试**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/home-loading.spec.ts --project=desktop-1440
```

Expected: both tests pass.

- [ ] **Step 5: 提交加载器协调逻辑**

```powershell
git add -- src/scripts/page-loader.ts tests/e2e/home-loading.spec.ts
git commit -m "fix: wait for complete homepage readiness"
```

---

### Task 5: 恢复 Hatrix 名称和金句卡片

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/scripts/home-dashboard.ts`
- Modify: `src/data/home-quotes.ts`
- Modify: `tests/e2e/home.spec.ts`
- Modify: `tests/e2e/no-js.spec.ts`

**Interfaces:**
- Produces: visible `[data-home-title]` and `[data-home-panel='quote']`。
- Consumes: `HOME_QUOTES` and `HOME_QUOTE_INTERVAL = 15_000`。

- [ ] **Step 1: 运行现有金句测试并确认当前失败**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/home.spec.ts --project=desktop-1440 -g "home quote"
```

Expected: three quote tests fail because the quote panel is absent.

- [ ] **Step 2: 为可见名称和无 JavaScript 降级补充失败断言**

Add to the first test in `tests/e2e/home.spec.ts`:

```ts
await expect(page.locator('[data-home-title]')).toBeVisible();
await expect(page.locator('[data-home-panel="identity-name"]')).toBeVisible();
await expect(page.locator('[data-home-panel="quote"]')).toBeVisible();
```

Add to the first test in `tests/e2e/no-js.spec.ts`:

```ts
await expect(page.locator('[data-home-title]')).toBeVisible();
await expect(page.locator('[data-home-panel="quote"]')).toContainText(firstQuote);
await expect(page.locator('[data-char-rig]')).toBeVisible();
```

Declare `firstQuote` in `no-js.spec.ts` as:

```ts
const firstQuote = '轻松即单纯，速成即精准';
```

- [ ] **Step 3: 恢复名称和金句面板**

In `src/pages/index.astro`, restore the quotes import:

```ts
import { HOME_QUOTES } from '@/data/home-quotes';
```

Add these left panel definitions:

```ts
identityName: {
  width: 300,
  height: 112,
  corners: [[264, 420], [558, 408], [560, 516], [266, 532]]
},
quote: {
  width: 595,
  height: 110,
  corners: [[10, 696], [604.4, 668], [605.9, 762], [12, 775]]
},
```

Move the page heading out of the level panel and add:

```astro
<HomePanel name="identity-name" {...leftPanels.identityName}>
  <div class="identity-name"><h1 id="home-title" data-home-title>Hatrix</h1></div>
</HomePanel>
<HomePanel name="quote" {...leftPanels.quote}>
  <div class="quote-card">
    <button type="button" class="quote-switch" data-home-quote aria-label={`金句：${HOME_QUOTES[0]}。双击切换；键盘按 Enter 或空格切换`} title="双击切换金句">
      <span class="quote-window"><span data-quote-text>{HOME_QUOTES[0]}</span></span>
    </button>
    <button class="quote-pause" type="button" data-quote-pause aria-label="暂停金句自动切换" aria-pressed="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path class="pause-mark" d="M8 5v14M16 5v14" /><path class="resume-mark" d="m8 5 11 7-11 7Z" /></svg>
    </button>
  </div>
</HomePanel>
```

Add these exact styles:

```css
.identity-name {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  padding-left: 28px;
  border: 1px solid #b8a6c133;
  border-radius: 3px;
  background: #211e29d9;
  box-shadow: inset 0 1px #f8e7cf0d;
}
.identity-name h1 {
  margin: 0;
  color: var(--home-ink);
  font: 500 64px/1 'IBM Plex Mono', monospace;
  letter-spacing: -.035em;
}
.quote-card {
  position: relative;
  width: 100%;
  height: 100%;
  border: 1px solid #b8a6c133;
  border-radius: 3px;
  background: #211e29ed;
  box-shadow: inset 0 1px #f8e7cf0d;
}
.quote-switch {
  width: 100%;
  height: 100%;
  border: 0;
  padding: 20px 54px 20px 24px;
  background: transparent;
  color: var(--home-ink);
  cursor: pointer;
  text-align: left;
}
.quote-window { display: flex; overflow: hidden; height: 60px; align-items: center; }
[data-quote-text] { display: block; font-size: 22px; line-height: 1.65; text-wrap: balance; }
.quote-pause {
  position: absolute;
  right: 7px;
  bottom: 6px;
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  color: #c4d4dc;
  cursor: pointer;
}
.quote-pause svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 2; }
.resume-mark,
.quote-pause[aria-pressed='true'] .pause-mark { display: none; }
.quote-pause[aria-pressed='true'] .resume-mark { display: block; }
```

The specified name-panel corners start 12 design pixels to the right of the level panel's right edge; verify the projected gap in Task 6.

- [ ] **Step 4: 恢复金句状态机并把间隔改为 15 秒**

Change `src/data/home-quotes.ts`:

```ts
export const HOME_QUOTE_INTERVAL = 15_000;
```

In `src/scripts/home-dashboard.ts`, retain the current level and clock code and add this quote state:

```ts
const quote = stage.querySelector<HTMLButtonElement>('[data-home-quote]')!;
const quoteText = stage.querySelector<HTMLElement>('[data-quote-text]')!;
const pause = stage.querySelector<HTMLButtonElement>('[data-quote-pause]')!;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let quoteIndex = 0;
let paused = motion.matches;
let animation: Animation | undefined;
let quoteTimer: number | undefined;
```

Add these functions and listeners inside `initializeHomeDashboard()`:

```ts
const syncPause = (): void => {
  pause.setAttribute('aria-pressed', String(paused));
  pause.setAttribute('aria-label', paused ? '恢复金句自动切换' : '暂停金句自动切换');
};
const scheduleQuote = (): void => {
  window.clearTimeout(quoteTimer);
  if (!paused && !document.hidden) quoteTimer = window.setTimeout(nextQuote, HOME_QUOTE_INTERVAL);
};
const nextQuote = (): void => {
  animation?.cancel();
  quoteIndex = (quoteIndex + 1) % HOME_QUOTES.length;
  quoteText.textContent = HOME_QUOTES[quoteIndex];
  quote.setAttribute('aria-label', `金句：${HOME_QUOTES[quoteIndex]}。双击切换；键盘按 Enter 或空格切换`);
  if (!motion.matches) {
    animation = quoteText.animate([
      { transform: 'translateY(100%)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 },
    ], { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)' });
  }
  scheduleQuote();
};

quote.addEventListener('dblclick', nextQuote, { signal });
quote.addEventListener('click', (event) => { if (event.detail === 0) nextQuote(); }, { signal });
pause.addEventListener('click', () => {
  paused = !paused;
  syncPause();
  scheduleQuote();
}, { signal });
document.addEventListener('visibilitychange', () => {
  updateClock();
  scheduleQuote();
}, { signal });
motion.addEventListener('change', () => {
  if (!motion.matches) return;
  animation?.cancel();
  paused = true;
  syncPause();
  scheduleQuote();
}, { signal });

syncPause();
scheduleQuote();
```

Extend the existing cleanup function with:

```ts
window.clearTimeout(quoteTimer);
animation?.cancel();
```

- [ ] **Step 5: 运行首页和无 JavaScript 测试**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/no-js.spec.ts --project=desktop-1440
```

Expected: visible name, quote switching, 15-second pause/resume, reduced-motion and no-JavaScript checks pass.

- [ ] **Step 6: 提交首页卡片恢复**

```powershell
git add -- src/pages/index.astro src/scripts/home-dashboard.ts src/data/home-quotes.ts tests/e2e/home.spec.ts tests/e2e/no-js.spec.ts
git commit -m "feat: restore homepage identity and quotes"
```

---

### Task 6: 集成测试、视觉检查与项目验证

**Files:**
- Modify: `tests/e2e/home-loading.spec.ts`
- Modify: `tests/e2e/home.spec.ts`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-*.png`
- Modify: `DESIGN.md`
- Modify: `README.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes all previous task states and assets.
- Produces final browser evidence and synchronized current documentation.

- [ ] **Step 1: 增加播放器首个可见帧断言**

Add to `tests/e2e/home-loading.spec.ts`:

```ts
test('reveals the player only at its final homepage geometry', async ({ page }) => {
  await page.addInitScript(() => {
    const samples: Array<{ x: number; y: number }> = [];
    Object.defineProperty(window, '__playerVisibleSamples', { value: samples });
    const sample = () => {
      const player = document.querySelector<HTMLElement>('[data-music-player]');
      if (player && getComputedStyle(player).visibility !== 'hidden') {
        const box = player.getBoundingClientRect();
        samples.push({ x: box.x, y: box.y });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/');
  const player = page.locator('[data-music-player]');
  await expect(player).toHaveAttribute('data-layout-state', 'ready');
  const finalBox = await player.boundingBox();
  const samples = await page.evaluate(() => (
    window as Window & { __playerVisibleSamples: Array<{ x: number; y: number }> }
  ).__playerVisibleSamples);
  expect(finalBox).not.toBeNull();
  expect(samples.length).toBeGreaterThan(0);
  for (const sample of samples) {
    expect(Math.abs(sample.x - finalBox!.x)).toBeLessThan(1);
    expect(Math.abs(sample.y - finalBox!.y)).toBeLessThan(1);
  }
  expect(await player.evaluate((node) => node.getAnimations().some(
    (animation) => animation.playState === 'running' &&
      getComputedStyle(node).transitionProperty.includes('transform'),
  ))).toBe(false);
});
```

- [ ] **Step 2: 运行相关桌面、平板和手机测试**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/home-loading.spec.ts tests/e2e/home.spec.ts tests/e2e/home-level.spec.ts tests/e2e/no-js.spec.ts
```

Expected: all related projects pass; no persistent server remains afterward.

- [ ] **Step 3: 更新并检查首页视觉基线**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Inspect these files with the local image viewer:

```text
tests/e2e/visual.spec.ts-snapshots/home-desktop-1440.png
tests/e2e/visual.spec.ts-snapshots/home-tablet-768.png
tests/e2e/visual.spec.ts-snapshots/home-mobile-390.png
```

Check that the level ring and `Hatrix` do not overlap, the name does not cover the character face, the quote panel fits above the player, and the player is already in the final lower-left position.

- [ ] **Step 4: 运行 Impeccable 最终检测**

Before UI edits, read `.agents/skills/impeccable/reference/craft-floor.md`. After all UI edits, run once:

```powershell
$env:IMPECCABLE_HOME = Join-Path (Get-Location) '.impeccable'
& '.\.agents\skills\impeccable\scripts\impeccable.cmd' detect --json src/pages/index.astro src/components/CharacterIdle.astro src/components/MusicPlayer.astro
```

Resolve only findings caused by this change. Do not redesign unrelated surfaces.

- [ ] **Step 5: 同步当前文档**

Apply `humanizer-zh`, then make these exact current-state edits:

- `README.md`：将首页说明改为“中左保留等级圆环，其右侧显示 Hatrix 名称；左下依次为金句、播放器、友链和留言板”。在图片策略中记录人物运行时资源为 `public/character-parts/*.webp`，源 PNG 位于 `src/assets/home/character-parts-source/`。
- `AGENTS.md`：把“等级圆环替代可见的 Hatrix 字样”改为“等级圆环保留，Hatrix 名称位于其右侧”。把人物素材约束改为运行时使用裁边 WebP，原始 v5 PNG 仍是合成和视觉核对基准。
- `DESIGN.md`：在 Homepage 章节记录名称面板与等级圆环至少 12px 间距、金句 15 秒行为，以及人物分块的源码和运行时路径。

Do not change build, link or test-count constants unless a verification command reports a new stable value.

- [ ] **Step 6: 运行完整验证**

Run in order:

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm build
corepack pnpm check:site
corepack pnpm exec playwright test tests/e2e/home-loading.spec.ts tests/e2e/home.spec.ts tests/e2e/home-level.spec.ts tests/e2e/no-js.spec.ts tests/e2e/visual.spec.ts
git diff --check
```

Expected: 0 unit failures, 0 Astro diagnostics, 280/280 remote article images, successful protected-content audit, expected local-link count, all related E2E projects passing, and no whitespace errors.

- [ ] **Step 7: 确认没有后台预览服务**

Run:

```powershell
corepack pnpm astro dev status
```

Expected: `No dev server is running.`

- [ ] **Step 8: 提交集成、视觉基线和文档**

```powershell
git add -- tests/e2e/home-loading.spec.ts tests/e2e/home.spec.ts tests/e2e/visual.spec.ts-snapshots DESIGN.md README.md AGENTS.md
git commit -m "test: verify atomic homepage loading"
```

Do not push unless the user explicitly requests it.
