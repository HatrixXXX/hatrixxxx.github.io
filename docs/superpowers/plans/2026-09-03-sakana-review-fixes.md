# Sakana Final Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 当前仓库已去除分类与标签路由。下文的 67 项检查、21 张视觉基线、80 个页面和 4,653 条链接是当时的执行记录；当前验收口径为 92 项检查、18 张视觉基线、67 个页面和 5,352 条链接。

**Goal:** 修复首次加载缺少连接杆和第三方告知的问题，并补齐泷奈拖拽、普通音效及最终视觉回归证据。

**Architecture:** Sakana 初始化后通过 `getValue()` 把内部状态归零，由站点在暂停前同步绘制一次竖直连接杆，之后的拖拽仍交给上游物理逻辑。许可告知作为 `public/third-party-notices.txt` 随静态站点发布，并由构建产物检查强制保留。

**Tech Stack:** Astro 7、TypeScript、Canvas 2D、`sakana@1.0.8`、Vitest、Playwright

## Global Constraints

- 使用 Node 24 和 Corepack 管理的 pnpm；保持 Astro 纯静态输出。
- 保留两个固定角色、位图镜像、左右位置、响应式缩放、隐藏底座和 reduced-motion 行为。
- 页面标记 `data-sakana-state="ready"` 前，两个 canvas 必须已经绘制竖直连接杆，角色内部 `r/y/t/w` 均为零。
- 不让上游默认姿态短暂运行；无位移点击不得启动默认摆动或音效。
- 新增泷奈拖拽与普通模式语音播放测试，Playwright 总数由 66 增至 67，视觉基线仍为 21 张。
- 公开告知原样保留 Sakana 随包 MIT LICENSE，记录 npm `license: ISC` 元数据冲突、项目来源、画师来源和插画非商业条件。
- 站点必须保持非商业用途；`dist/third-party-notices.txt` 是必需构建产物。
- 不改文章正文、旧 URL、Giscus、图片 inventory、站内链接期望值或用户其他工作。
- 设计依据：`docs/superpowers/specs/2026-09-02-sakana-characters-design.md`。

---

### Task 1: Render a true resting pose and cover Takina interaction

**Files:**
- Modify: `src/types/sakana.d.ts`
- Modify: `src/scripts/sakana.ts`
- Modify: `tests/e2e/sakana.spec.ts`

**Interfaces:**
- Produces: `SakanaValue { r, y, t, w }` and `SakanaInstance.getValue()`.
- Produces: `renderRestingPose(mount: HTMLElement)` which sets the visible transform to zero and draws the initial rod.
- Preserves: existing `pause()`, role locking, sound, media-query and Astro navigation behavior.

- [ ] **Step 1: Make painted canvas and zero internal state observable**

在 `tests/e2e/sakana.spec.ts` 的 initialization/persistence 测试中，紧跟两个 canvas 计数断言加入：

```ts
  const paintedCanvases = await layer.locator('canvas').evaluateAll((canvases) =>
    canvases.map((canvas) => {
      const element = canvas as HTMLCanvasElement;
      const pixels = element.getContext('2d')?.getImageData(0, 0, element.width, element.height).data;
      return pixels ? pixels.some((value, index) => index % 4 === 3 && value > 0) : false;
    })
  );
  expect(paintedCanvases).toEqual([true, true]);

  const chisatoCharacter = chisato.locator('.sakana-character');
  const restingStyle = await chisatoCharacter.getAttribute('style');
  const restingBox = await chisatoCharacter.boundingBox();
  if (!restingBox) throw new Error('Chisato is not visible at rest');
  await page.mouse.click(restingBox.x + restingBox.width / 2, restingBox.y + restingBox.height / 2);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expect(await chisatoCharacter.getAttribute('style')).toBe(restingStyle);
```

- [ ] **Step 2: Add Takina drag and voice playback coverage**

在同一测试文件末尾加入：

```ts
test('Takina moves independently and plays its embedded voice', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const trackedWindow = window as Window & { __sakanaVoicePlays?: string[] };
    Object.defineProperty(trackedWindow, '__sakanaVoicePlays', { value: [] });
    window.Audio = new Proxy(NativeAudio, {
      construct(target, args) {
        const audio = Reflect.construct(target, args) as HTMLAudioElement;
        const source = String(args[0] ?? '');
        Object.defineProperty(audio, 'play', {
          value: () => {
            trackedWindow.__sakanaVoicePlays?.push(source);
            return Promise.resolve();
          }
        });
        return audio;
      }
    });
  });

  await page.goto('/');
  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveAttribute('data-sakana-state', 'ready');
  await expect(layer).toHaveAttribute('data-sakana-motion', 'full');

  const chisato = layer.locator('[data-sakana-mount="chisato"] .sakana-character');
  const takina = layer.locator('[data-sakana-mount="takina"] .sakana-character');
  const chisatoStyle = await chisato.getAttribute('style');
  const initialBox = await takina.boundingBox();
  if (!initialBox) throw new Error('Takina is not visible');
  const centerX = initialBox.x + initialBox.width / 2;
  const centerY = initialBox.y + initialBox.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 120, centerY);
  const draggedBox = await takina.boundingBox();
  if (!draggedBox) throw new Error('Takina disappeared while dragging');
  expect(draggedBox.x + draggedBox.width / 2).toBeGreaterThan(centerX);
  expect(await chisato.getAttribute('style')).toBe(chisatoStyle);
  await page.mouse.up();

  await expect.poll(() => page.evaluate(
    () => (window as Window & { __sakanaVoicePlays?: string[] }).__sakanaVoicePlays ?? []
  )).toHaveLength(1);
  const sources = await page.evaluate(
    () => (window as Window & { __sakanaVoicePlays?: string[] }).__sakanaVoicePlays ?? []
  );
  expect(sources[0]).toMatch(/^data:audio\/x-m4a;base64,/);
});
```

- [ ] **Step 3: Run the focused RED**

Run the Sakana spec against this feature worktree, not a server from another worktree.

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440
```

Expected: FAIL because both canvas buffers are fully transparent and a no-move click releases the upstream default state. The new Takina test may already pass; that does not replace the initial-state RED.

- [ ] **Step 4: Narrow the ambient type to the used upstream surface**

将 `src/types/sakana.d.ts` 中的 value 与 instance 声明改为：

```ts
  export interface SakanaValue {
    r: number;
    y: number;
    t: number;
    w: number;
  }

  export interface SakanaInstance {
    pause(): void;
    getValue(): SakanaValue;
  }
```

`play()` 和 `destroy()` 在 `sakana@1.0.8` 中真实存在，但当前站点未使用，因此不放进窄声明。

- [ ] **Step 5: Reset the internal state and paint the rod before readiness**

在 `src/scripts/sakana.ts` 中新增：

```ts
const SAKANA_WIDTH = 500;
const SAKANA_HEIGHT = 800;
const ROD_COLOR = '#182562';

function resetSakanaValue(instance: SakanaInstance): void {
  const value = instance.getValue();
  value.r = 0;
  value.y = 0;
  value.t = 0;
  value.w = 0;
  instance.pause();
}

function renderRestingPose(mount: HTMLElement): void {
  const character = mount.querySelector<HTMLElement>('.sakana-character');
  const canvas = mount.querySelector<HTMLCanvasElement>('canvas');
  const context = canvas?.getContext('2d');
  if (!character || !canvas || !context) throw new Error('Sakana render targets are missing');

  character.style.transform = 'rotate(0deg) translateX(0px) translateY(0px)';
  context.clearRect(0, 0, SAKANA_WIDTH, SAKANA_HEIGHT);
  context.save();
  context.strokeStyle = ROD_COLOR;
  context.lineWidth = 10;
  context.beginPath();
  context.moveTo(250, 780);
  context.quadraticCurveTo(250, 715, 250, 540);
  context.stroke();
  context.restore();
}
```

将初始化后的同步暂停代码：

```ts
    instances.forEach((instance) => instance.pause());
```

替换为：

```ts
    instances.forEach(resetSakanaValue);
    renderRestingPose(chisatoMount);
    renderRestingPose(takinaMount);
```

这三步必须位于 `layer.dataset.sakanaState = 'ready'` 之前。

- [ ] **Step 6: Run focused GREEN and type checks**

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440
corepack pnpm exec playwright test tests/e2e/accessibility.spec.ts --project=desktop-1440
corepack pnpm check
```

Expected: 4 Sakana tests and 3 accessibility tests pass; Astro reports 0 errors.

- [ ] **Step 7: Commit the resting pose fix**

```powershell
git add -- src/types/sakana.d.ts src/scripts/sakana.ts tests/e2e/sakana.spec.ts
git commit -m "fix: render sakana resting rods"
```

---

### Task 2: Publish and enforce the third-party notice

**Files:**
- Create: `public/third-party-notices.txt`
- Modify: `scripts/check-built-site.ts`
- Modify: `tests/unit/check-built-site.test.ts`
- Modify: `tests/unit/project-config.test.ts`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md`

**Interfaces:**
- Produces: public `/third-party-notices.txt`, copied by Astro to `dist/third-party-notices.txt`.
- Produces: built-site error `Missing required output: /third-party-notices.txt`.
- Updates: Playwright count from 66 to 67; Windows visual baseline count remains 21.

- [ ] **Step 1: Add failing source-notice coverage**

在 `tests/unit/project-config.test.ts` 的 tooling describe 中加入：

```ts
  it('documents the Sakana license and noncommercial illustration restriction', () => {
    const path = 'public/third-party-notices.txt';
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;

    const notice = readFileSync(path, 'utf8');
    expect(notice).toContain('Sakana 1.0.8');
    expect(notice).toContain('MIT License');
    expect(notice).toContain('Copyright (c) 2022 卜卜口');
    expect(notice).toContain('package.json declares "license": "ISC"');
    expect(notice).toContain('non-commercial webpages only');
    expect(notice).toContain('大伏アオ');
  });
```

- [ ] **Step 2: Add failing built-output coverage**

在 `tests/unit/check-built-site.test.ts` 中加入：

```ts
it('requires the third-party notice in built output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hatrix-site-'));
  await writeSiteFile(root, 'index.html');
  await writeSiteFile(root, '404.html');
  await writeSiteFile(root, 'CNAME', 'hatrix.site\n');
  await writeSiteFile(root, 'rss.xml', '<rss/>');
  await writeSiteFile(root, 'sitemap-0.xml', '<urlset/>');
  await writeSiteFile(root, 'search-index.json', '[]');

  const result = await inspectBuiltSite(root, []);

  expect(result.errors).toContain('Missing required output: /third-party-notices.txt');
});
```

Run:

```powershell
corepack pnpm vitest run tests/unit/project-config.test.ts tests/unit/check-built-site.test.ts
```

Expected: both new tests fail because the notice does not exist and the checker does not yet require it.

- [ ] **Step 3: Add the published notice**

创建 `public/third-party-notices.txt`，使用以下内容；MIT 正文必须逐字保留：

```text
Third-party notices
===================

Sakana 1.0.8
------------
Project: https://github.com/itorr/sakana
Package: https://www.npmjs.com/package/sakana/v/1.0.8

The LICENSE file shipped with sakana@1.0.8 and the upstream repository both
contain the MIT License reproduced below.
The package's package.json declares "license": "ISC".
This notice records that metadata conflict and preserves the
complete LICENSE text included by the distributor; it does not resolve or
reinterpret the upstream licensing metadata.

MIT License

Copyright (c) 2022 卜卜口

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Character illustrations
-----------------------
Illustrator: 大伏アオ / @blue00f4
Profile: https://twitter.com/blue00f4
Pixiv: https://pixiv.me/aoiroblue1340
Source statements:
https://twitter.com/blue00f4/status/1551887529615687680
https://twitter.com/blue00f4/status/1552066743853813760

The Sakana README states that the two bundled character illustrations were
authorized for use on non-commercial webpages only. Hatrix Blog may distribute
and display them only while the site remains non-commercial. Recheck permission
before any commercial use or redistribution outside this site.
```

- [ ] **Step 4: Require the notice in built output**

在 `scripts/check-built-site.ts` 的 required-file Promise 中加入：

```ts
    requiredFile(root, 'third-party-notices.txt', errors),
```

在 `accepts a complete site with encoded Unicode routes and local assets` 的 fixture 中加入：

```ts
  await writeSiteFile(root, 'third-party-notices.txt', 'Sakana notice');
```

- [ ] **Step 5: Update long-lived documentation**

在 `README.md` 的许可证段落补充：

```markdown
本站使用 `sakana@1.0.8` 显示千束和泷奈。代码许可、上游元数据冲突、画师来源及插画非商业使用条件见 [`public/third-party-notices.txt`](public/third-party-notices.txt)。只要站点继续分发这两张插画，就必须保持非商业用途。
```

在 `AGENTS.md` 的稳定约束中加入：

```markdown
- Sakana 的许可和素材来源告知固定在 `public/third-party-notices.txt`，构建后必须复制到 `dist/third-party-notices.txt`。内置千束与泷奈插画只用于非商业网页；站点用途或依赖版本变化时必须重新核对授权。
```

把 `AGENTS.md`、`README.md` 和 `docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md` 中的 Playwright 检查数从 66 改为 67；21 张视觉基线数量不变。

- [ ] **Step 6: Run unit, build and notice checks**

```powershell
corepack pnpm vitest run tests/unit/project-config.test.ts tests/unit/check-built-site.test.ts
corepack pnpm test:run
corepack pnpm build
corepack pnpm check:site
Test-Path dist/third-party-notices.txt
```

Expected: focused tests pass; full Vitest reports 50 tests; build produces 80 pages; `check:site` passes 4,653 links; `Test-Path` returns `True`.

- [ ] **Step 7: Commit the notice and documentation**

```powershell
git add -- public/third-party-notices.txt scripts/check-built-site.ts tests/unit/check-built-site.test.ts tests/unit/project-config.test.ts README.md AGENTS.md docs/superpowers/specs/2026-09-01-astro-blog-rebuild-design.md
git commit -m "docs: publish sakana third-party notice"
```

---

### Task 3: Refresh the rod-visible visual baselines

**Files:**
- Modify: `tests/e2e/visual.spec.ts-snapshots/*.png`

**Interfaces:**
- Consumes: synchronously painted resting rods from Task 1.
- Preserves: 21 Windows snapshots and existing filenames.

- [ ] **Step 1: Prove the previous home baseline detects the rods**

Run the desktop home visual test against this feature worktree:

```powershell
corepack pnpm exec playwright test tests/e2e/visual.spec.ts --project=desktop-1440 -g "^/ has stable responsive structure$"
```

Expected: FAIL only on the screenshot comparison because the two resting rods are newly visible; structural assertions remain green.

- [ ] **Step 2: Regenerate all 21 baselines**

```powershell
corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Expected: 21 tests pass and exactly 21 existing PNG files are updated in place.

- [ ] **Step 3: Inspect the three responsive home images**

Use the image viewer on:

```text
tests/e2e/visual.spec.ts-snapshots/home-desktop-1440.png
tests/e2e/visual.spec.ts-snapshots/home-tablet-768.png
tests/e2e/visual.spec.ts-snapshots/home-mobile-390.png
```

Confirm both rods run from the character to the viewport bottom, bases remain hidden, Chisato faces right at the left edge, Takina faces left at the right edge, and neither character covers navigation or produces horizontal overflow.

- [ ] **Step 4: Commit the updated baselines**

```powershell
git add -- tests/e2e/visual.spec.ts-snapshots
git commit -m "test: capture sakana resting rods"
```

---

### Task 4: Rerun every completion gate

**Files:**
- Verify only; do not commit `dist/`, `.astro/`, `reports/`, `test-results/` or temporary Playwright config.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: final green evidence and a user-facing feature preview.

- [ ] **Step 1: Run static and build gates**

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
corepack pnpm check:site
```

Expected: 50 unit tests; 0 Astro errors; image check passes; 80 pages; 4,653 links; `dist/third-party-notices.txt` exists.

- [ ] **Step 2: Run the isolated full browser suite**

Use an isolated feature-worktree test server if port 4321 belongs to another worktree. Do not reuse another worktree's preview.

```powershell
corepack pnpm test:e2e
```

Expected: natural exit 0 with `67 passed`, including 21 visual comparisons.

- [ ] **Step 3: Recheck performance and delivery**

```powershell
rg -n --glob '*.html' "cdn\.jsdelivr\.net/npm/sakana|lab\.magiconch\.com/sakana" dist
node -e 'const fs=require("fs"),path=require("path"),z=require("zlib");const dir="dist/_astro";const html=fs.readFileSync("dist/index.html","utf8");const js=fs.readdirSync(dir).filter(f=>f.endsWith(".js"));const direct=[...html.matchAll(/<script[^>]+src="\/_astro\/([^"]+\.js)"/g)].map(m=>m[1]);const marked=js.filter(f=>{const s=fs.readFileSync(path.join(dir,f),"utf8");return s.includes("data-sakana-layer")||s.includes("chin~a~na~go")});const chosen=[...new Set([...direct,...marked])];const total=chosen.reduce((n,f)=>n+z.gzipSync(fs.readFileSync(path.join(dir,f)),{level:9}).length,0);console.log({files:chosen,totalGzipBytes:total,limit:160*1024});if(total>160*1024)process.exit(1)'
```

Expected: no remote Sakana URL appears in built HTML; relevant gzip stays at or below 163,840 bytes.

- [ ] **Step 4: Start and inspect the final feature preview**

After integration into the user workspace, start `corepack pnpm dev --host 127.0.0.1` in a hidden window. Confirm HTTP 200 at `http://127.0.0.1:4321/`, both resting rods before any drag, both drag directions, embedded sound trigger, hidden bases, responsive positions, reduced-motion behavior and theme overlay stacking.

---

### Task 5: Preserve Sakana styles across Astro navigation

**Files:**
- Modify: `src/scripts/sakana.ts`
- Modify: `tests/e2e/sakana.spec.ts`

**Interfaces:**
- Produces: one `style[data-sakana-runtime-style]` node captured from the Sakana package import.
- Produces: `restoreSakanaRuntimeStyle()` on `astro:after-swap`.
- Preserves: the existing persisted character nodes and instances without reinitialization or duplicate styles.

- [ ] **Step 1: Extend the persistence test through an article round trip**

在 `initializes locked roles once and persists them across client navigation` 测试中，用下面的代码替换归档导航部分：

```ts
  await layer.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));
  await page.locator('article[data-post-card] h2 a').first().click();
  await expect(page.locator('article[data-post]')).toBeVisible();

  const persistedLayer = page.locator('[data-sakana-layer]');
  await expect(persistedLayer).toHaveAttribute('data-persist-probe', 'same-node');
  await expect(persistedLayer.locator('canvas')).toHaveCount(2);
  const articleCharacters = persistedLayer.locator('.sakana-character');
  await expect(articleCharacters).toHaveCount(2);
  await expect(articleCharacters.first()).toBeVisible();
  await expect(articleCharacters.last()).toBeVisible();
  await expect(page.locator('head style[data-sakana-runtime-style]')).toHaveCount(1);

  await page.locator('header[data-site-header]').getByRole('link', { name: '首页', exact: true }).click();
  await expect(page.locator('[data-hero]')).toBeVisible();
  await expect(page.locator('[data-sakana-layer]')).toHaveAttribute(
    'data-persist-probe',
    'same-node'
  );
  const homeCharacters = page.locator('[data-sakana-layer] .sakana-character');
  await expect(homeCharacters).toHaveCount(2);
  await expect(homeCharacters.first()).toBeVisible();
  await expect(homeCharacters.last()).toBeVisible();
  await expect(page.locator('head style[data-sakana-runtime-style]')).toHaveCount(1);
  expect(remoteSakanaRequests).toEqual([]);
```

- [ ] **Step 2: Run the focused RED**

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440 -g "initializes locked roles"
```

Expected: FAIL on the article page because the persisted `.sakana-character` nodes have zero height and no background after Astro removes Sakana's injected head style.

- [ ] **Step 3: Capture and restore the injected runtime style**

在 `src/scripts/sakana.ts` 的模块状态中加入：

```ts
let sakanaRuntimeStyle: HTMLStyleElement | undefined;
```

加入两个函数：

```ts
function findSakanaRuntimeStyle(): HTMLStyleElement | undefined {
  return [...document.head.querySelectorAll<HTMLStyleElement>('style')].find((style) =>
    (style.textContent ?? '').includes('.sakana-box') &&
    (style.textContent ?? '').includes('.sakana-character[data-character=chisato]')
  );
}

function restoreSakanaRuntimeStyle(): void {
  if (sakanaRuntimeStyle && !sakanaRuntimeStyle.isConnected) {
    document.head.append(sakanaRuntimeStyle);
  }
}
```

在 `await import('sakana')` 后立即捕获并标记样式；缺失时进入现有错误路径：

```ts
    sakanaRuntimeStyle = findSakanaRuntimeStyle();
    if (!sakanaRuntimeStyle) throw new Error('Sakana runtime styles are missing');
    sakanaRuntimeStyle.dataset.sakanaRuntimeStyle = '';
```

在现有事件绑定旁加入：

```ts
document.addEventListener('astro:after-swap', restoreSakanaRuntimeStyle);
```

- [ ] **Step 4: Run GREEN and regression checks**

```powershell
corepack pnpm exec playwright test tests/e2e/sakana.spec.ts --project=desktop-1440
corepack pnpm exec playwright test tests/e2e/accessibility.spec.ts --project=desktop-1440
corepack pnpm check
```

Expected: 4 Sakana tests and 3 accessibility tests pass; Astro reports 0 errors.

- [ ] **Step 5: Commit the navigation fix**

```powershell
git add -- src/scripts/sakana.ts tests/e2e/sakana.spec.ts
git commit -m "fix: preserve sakana across navigation"
```
