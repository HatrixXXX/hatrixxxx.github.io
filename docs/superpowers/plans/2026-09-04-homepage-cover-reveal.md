# Fullscreen Homepage Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页改成无滚动的全屏封面，并通过右向箭头、鼠标左拖或触摸左滑，以揭开动画进入博客总览页。

**Architecture:** `BaseLayout` 提供显式首页模式，按路由裁掉品牌、页脚、Sakana 和 CursorTrail；`SiteHeader` 只增加首页视觉变体；`index.astro` 负责全屏舞台。单个 `home-cover.ts` 模块管理打字、博客预取、拖动状态和 View Transition 标记，其他页面继续使用现有脚本。

**Tech Stack:** Astro 7.2、TypeScript 5.9、Astro ClientRouter、`astro:prefetch`、原生 View Transitions、Pointer Events、Vitest 4.1、Playwright 1.62。

## Global Constraints

- 保持 Astro 纯静态输出，不增加服务端、数据库、iframe、动画库或远程字体。
- 背景只使用用户提供的 `public/images/cover.png`，不复制参考站源码、文案或个人素材。
- 首页不渲染页脚、旧入口卡片、Sakana 或 CursorTrail；其他页面保持现状。
- 首页在所有测试视口内都不能产生横向或纵向滚动。
- 首页到 `/blog/` 的揭开动画只使用合成层 `transform`，时长 `620ms`；减少动态效果时直接切换。
- 已发布文章仍只来自 `.private-content/posts/`，不得触碰文章正文或私有资源。
- 每个任务先写失败测试，再做最小实现；不得用更新非首页视觉基线掩盖回归。

---

### Task 1: 固定首页壳层契约

**Files:**
- Modify: `tests/e2e/home.spec.ts`
- Modify: `tests/e2e/shell.spec.ts`
- Modify: `tests/e2e/banner.spec.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/SiteHeader.astro`
- Modify: `src/pages/index.astro`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Existing asset: `public/images/cover.png`

**Interfaces:**
- Consumes: `PRIMARY_NAV_ITEMS`、`SearchOverlay`、`ThemeTransition` 和现有移动菜单脚本。
- Produces: `[data-home-stage]`、`[data-home-controls]`、`[data-home-title]`、`[data-home-typing]`、`[data-home-typing-cursor]`、`[data-home-blog-link]` 和 `html[data-page-kind="home"]`。

- [ ] **Step 1: 重写首页失败测试**

在 `tests/e2e/home.spec.ts` 保留分页和文章路径检查，新增首页结构与固定视口断言：

```ts
test('home renders only the fullscreen cover experience', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-stage]')).toBeVisible();
  await expect(page.locator('[data-home-title]')).toHaveText('Hatrixの窝');
  await expect(page.locator('[data-home-typing]')).toHaveAttribute(
    'aria-label',
    '轻松即单纯，速成即精准'
  );
  await expect(page.locator('[data-home-typing-cursor]')).toHaveText('|');
  await expect(page.locator('[data-home-blog-link]')).toHaveAttribute('href', '/blog/');
  await expect(page.locator('.brand, .home-blog-entry, footer[data-site-footer]')).toHaveCount(0);
  await expect(page.locator('[data-sakana-layer], [data-cursor-trail]')).toHaveCount(0);
  const background = await page.locator('[data-home-stage]').evaluate(
    (node) => getComputedStyle(node).backgroundImage
  );
  expect(background).toContain('/images/cover.png');
  expect((await page.request.get('/images/cover.png')).status()).toBe(200);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1152, height: 720 },
  { width: 960, height: 600 },
  { width: 720, height: 450 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 640 }
]) {
  test(`home cannot scroll at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight
    }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
    await page.evaluate(() => window.scrollTo(0, 9999));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}
```

把 `shell.spec.ts` 的共享页脚用例迁到 `/projects/`；把 `banner.spec.ts` 首页断言改成 `[data-home-stage]` 与视口等高，非首页 `240px/200px` 测试不动。

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/shell.spec.ts tests/e2e/banner.spec.ts --project=desktop-1440
```

Expected: 首页缺少新 data hooks，且仍有品牌、卡片、页脚、Sakana 和 CursorTrail。

- [ ] **Step 3: 增加首页模式**

在 `BaseLayout.astro` 增加：

```astro
interface Props {
  // existing props
  pageKind?: 'default' | 'home';
}

const { pageKind = 'default' } = Astro.props;
const isHome = pageKind === 'home';
```

把页面标记和条件渲染接入现有结构：

```astro
<html lang="zh-CN" data-theme="dark" data-page-kind={isHome ? 'home' : undefined}>
  <body class={bodyClass}>
    <SiteHeader homeMode={isHome} showBrand={!isHome} />
    <ProtectedContent locked={pageLocked} route={Astro.url.pathname} title={title}>
      <slot />
    </ProtectedContent>
    {!isHome && <SiteFooter />}
    {!isHome && <SakanaCharacters />}
    <ThemeTransition />
    {!isHome && <CursorTrail />}
    <SearchOverlay />
  </body>
</html>
```

在 `SiteHeader.astro` 增加 `homeMode` 和 `showBrand` props；只在 `showBrand` 为真时输出 `.brand`。首页 Header 使用 `site-header--home` 和 `header-inner--home`，并给控件容器增加 `data-home-controls`。首页的 `/blog/` 主导航链接增加 `data-home-blog-link` 和 `data-astro-prefetch="load"`。

- [ ] **Step 4: 替换首页结构和样式**

先安装本地字体资源：

```powershell
corepack pnpm add @fontsource/ibm-plex-mono@5.3.0
```

`index.astro` 导入 `@fontsource/ibm-plex-mono/400.css` 和 `@fontsource/ibm-plex-mono/700.css`，然后改为：

```astro
<BaseLayout title={SITE.title} image="/images/cover.png" pageKind="home">
  <main data-home-stage aria-labelledby="home-title" class="home-stage">
    <section class="home-copy">
      <h1 id="home-title" data-home-title>Hatrixの窝</h1>
      <p class="home-subtitle" aria-label="轻松即单纯，速成即精准">
        <span data-home-typing aria-hidden="true"></span>
        <span data-home-typing-cursor aria-hidden="true">|</span>
      </p>
    </section>
    <a
      class="home-blog-link"
      href="/blog/"
      aria-label="进入博客文章总览"
      data-home-blog-link
      data-astro-prefetch="load"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="30" height="30">
        <path d="m9 5 7 7-7 7"></path>
      </svg>
    </a>
  </main>
</BaseLayout>
```

首页 CSS 使用 `position: fixed; inset: 0; min-height: 100dvh; background: url('/images/cover.png') center / cover no-repeat`，以 `::before` 增加 `rgb(0 0 0 / 30%)` 遮罩。文字组 `top: 43%`，字号和阴影严格使用设计文档数值。首页的 `html/body` 设置 `width: 100%; height: 100%; overflow: hidden; overscroll-behavior: none`。

首页 Header 取消渐变、容器最大宽度和圆形按钮背景；桌面 `36px` 留白、移动端 `16px`，导航与操作按钮全部靠右。

- [ ] **Step 5: 运行首页壳层测试**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/shell.spec.ts tests/e2e/banner.spec.ts --project=desktop-1440
```

Expected: 新首页结构、背景、无滚动和普通页壳层断言通过；交互测试尚未加入。

- [ ] **Step 6: 提交**

```powershell
git add package.json pnpm-lock.yaml src/layouts/BaseLayout.astro src/components/SiteHeader.astro src/pages/index.astro tests/e2e/home.spec.ts tests/e2e/shell.spec.ts tests/e2e/banner.spec.ts
git commit -m "feat: add fullscreen cover homepage"
```

---

### Task 2: 打字、预取和揭开交互

**Files:**
- Create: `src/scripts/home-cover.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `prefetch('/blog/')` from `astro:prefetch` and `navigate('/blog/')` from `astro:transitions/client`。
- Produces: `data-home-typing-state`、`data-home-drag-state`、`html[data-home-reveal]` 和 CSS 变量 `--home-drag-x`、`--home-reveal-distance`、`--home-reveal-duration`。

- [ ] **Step 1: 增加失败交互测试**

在 `home.spec.ts` 增加：

```ts
test('home types the tagline with a bar cursor', async ({ page }) => {
  await page.goto('/');
  const typing = page.locator('[data-home-typing]');
  await expect(typing).toHaveAttribute('data-home-typing-state', 'typing');
  await expect.poll(() => typing.textContent()).toContain('轻');
  await expect(typing).toHaveAttribute('data-home-typing-state', 'complete');
});

test('home arrow prefetches and reveals the blog', async ({ page }) => {
  const blogRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/blog/') blogRequests.push(request.url());
  });
  await page.goto('/');
  await expect.poll(() => blogRequests.length).toBeGreaterThan(0);
  await page.locator('[data-home-blog-link]').last().click({ noWaitAfter: true });
  await expect.poll(() => page.evaluate(() =>
    document.getAnimations().some((animation) =>
      animation instanceof CSSAnimation && animation.animationName === 'home-uncover-left'
    )
  )).toBe(true);
  await page.waitForURL('**/blog/');
});

test('home drag snaps back below threshold and navigates above it', async ({ page }) => {
  await page.goto('/');
  const stage = page.locator('[data-home-stage]');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Missing home stage bounds');
  await page.mouse.move(box.width * 0.75, box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.width * 0.68, box.height * 0.55, { steps: 4 });
  await page.mouse.up();
  await expect(stage).toHaveAttribute('data-home-drag-state', 'idle');
  await expect(page).toHaveURL('/');
  await page.mouse.move(box.width * 0.75, box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.width * 0.5, box.height * 0.55, { steps: 8 });
  await page.mouse.up();
  await page.waitForURL('**/blog/');
});
```

同一文件加入交互控件隔离和减少动态效果测试：

```ts
test('home controls do not start the drag gesture', async ({ page }) => {
  await page.goto('/');
  const theme = page.locator('[data-theme-toggle]');
  const box = await theme.boundingBox();
  if (!box) throw new Error('Missing theme control bounds');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 180, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-home-stage]')).toHaveAttribute('data-home-drag-state', 'idle');
});

test('home respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('[data-home-typing]')).toHaveText('轻松即单纯，速成即精准');
  const animations = await page.locator('[data-home-blog-link]').last().evaluate((node) => ({
    arrow: getComputedStyle(node.querySelector('svg')!).animationName,
    cursor: getComputedStyle(document.querySelector('[data-home-typing-cursor]')!).animationName
  }));
  expect(animations).toEqual({ arrow: 'none', cursor: 'none' });
});
```

- [ ] **Step 2: 运行交互测试确认失败**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/home.spec.ts --project=desktop-1440
```

Expected: 打字状态、预取请求、拖动状态和揭开动画均不存在。

- [ ] **Step 3: 实现首页脚本**

`src/scripts/home-cover.ts` 使用一次模块级监听和每次首页访问独立的 `AbortController`：

```ts
import { prefetch } from 'astro:prefetch';
import { navigate } from 'astro:transitions/client';

const BLOG_PATH = '/blog/';
const TAGLINE = '轻松即单纯，速成即精准';
const TYPE_DELAY = 300;
const TYPE_SPEED = 150;
const DELETE_SPEED = 50;
const COMPLETE_HOLD = 700;
const REVEAL_DURATION = 620;

let cleanupCurrentPage: (() => void) | undefined;
let pendingReveal: { distance: number; duration: number } | undefined;

function prepareReveal(distance = 0): void {
  const width = Math.max(innerWidth, 1);
  pendingReveal = {
    distance,
    duration: Math.max(220, REVEAL_DURATION * (1 - Math.min(distance / width, 0.9)))
  };
  document.documentElement.dataset.homeReveal = 'pending';
}

function goToBlog(sourceElement: Element, distance = 0): void {
  prepareReveal(distance);
  void navigate(BLOG_PATH, { sourceElement, info: { kind: 'home-reveal' } });
}
```

首页初始化时在 `requestIdleCallback` 中调用 `prefetch(BLOG_PATH)`；箭头 `pointerenter/focus` 和拖动 `pointerdown` 再调用一次。打字计时器按 `300/150/700/50ms` 循环，减少动态效果时直接输出完整文案。

拖动只响应主按键和非交互元素。保存起点、上次坐标与时间，使用 pointer capture；将负向位移写入 `--home-drag-x`。距离超过 `16%`，或速度达到 `0.7px/ms` 且距离不少于 `48px` 时调用 `goToBlog`，否则进入 `resetting` 状态并在 `320ms` 后回到 `idle`。

在 `astro:before-swap` 中把揭开属性和 CSS 变量写入 `event.newDocument.documentElement`，在 `event.viewTransition.finished` 后清理。`astro:page-load` 重新初始化首页；`astro:before-swap` 和页面隐藏时停止计时器并释放 pointer 状态。

- [ ] **Step 4: 增加 View Transition CSS**

在 `global.css` 增加：

```css
@keyframes home-uncover-left {
  to {
    transform: translate3d(calc(-100vw + var(--home-reveal-distance, 0px)), 0, 0);
  }
}

html[data-home-reveal='active']::view-transition-old(root) {
  z-index: 2;
  animation: home-uncover-left var(--home-reveal-duration, 620ms)
    cubic-bezier(0.76, 0, 0.24, 1) both;
}

html[data-home-reveal='active']::view-transition-new(root) {
  z-index: 1;
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  html[data-home-reveal='active']::view-transition-old(root),
  html[data-home-reveal='active']::view-transition-new(root) {
    animation: none;
  }
}
```

`index.astro` 的首页 Header 与舞台都使用 `translate3d(var(--home-drag-x, 0px), 0, 0)`；`resetting` 状态增加 `320ms` 回弹。箭头使用 `1.5s` 左右浮动，减少动态效果时取消。

- [ ] **Step 5: 运行交互测试**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/interactions.spec.ts tests/e2e/navigation-dropdown.spec.ts --project=desktop-1440
```

Expected: 首页交互和既有搜索、主题、导航测试全部通过。

- [ ] **Step 6: 提交**

```powershell
git add src/scripts/home-cover.ts src/pages/index.astro src/styles/global.css tests/e2e/home.spec.ts
git commit -m "feat: add draggable blog reveal"
```

---

### Task 3: 迁移装饰层与导航回归测试

**Files:**
- Modify: `tests/e2e/cursor-trail.spec.ts`
- Modify: `tests/e2e/sakana.spec.ts`
- Modify: `tests/e2e/post.spec.ts`
- Modify: `tests/e2e/blog-index.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Modify: `tests/e2e/no-js.spec.ts`

**Interfaces:**
- Consumes: Task 1 的首页条件渲染和 `[data-home-blog-link]`。
- Produces: 首页无装饰层的回归覆盖，以及普通页上原有 Sakana/CursorTrail 行为覆盖。

- [ ] **Step 1: 迁移冲突测试并确认失败位置**

将 CursorTrail 的正向入口从 `/` 改成 `/page/2/`，Sakana 的正向入口从 `/` 改成 `/projects/`。持久化测试使用两个普通页面，并加入以下首页 absence 断言：

```ts
test('home omits decorative runtimes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-cursor-trail], [data-sakana-layer]')).toHaveCount(0);
  await page.goto('/projects/');
  await expect(page.locator('[data-cursor-trail]')).toHaveCount(1);
  await expect(page.locator('[data-sakana-layer]')).toHaveAttribute('data-sakana-state', 'ready');
});
```

把 `post.spec.ts` 和 `blog-index.spec.ts` 对旧首页 CTA 的定位改成：

```ts
const blogNavigation = page
  .getByRole('navigation', { name: '主导航' })
  .getByRole('link', { name: '博客文章', exact: true });
await expect(blogNavigation).toHaveAttribute('href', '/blog/');
await blogNavigation.click();
await page.waitForURL('**/blog/');
```

`no-js.spec.ts` 继续断言五个导航链接都是普通 `<a>`。在 `accessibility.spec.ts` 增加首页键盘顺序：

```ts
await page.goto('/');
await page.keyboard.press('Tab');
await expect(page.getByRole('link', { name: '首页', exact: true })).toBeFocused();
for (let index = 0; index < 5; index += 1) await page.keyboard.press('Tab');
await expect(page.locator('[data-open-search]')).toBeFocused();
await page.keyboard.press('Tab');
await expect(page.locator('[data-theme-toggle]')).toBeFocused();
```

- [ ] **Step 2: 运行受影响套件**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/cursor-trail.spec.ts tests/e2e/sakana.spec.ts tests/e2e/post.spec.ts tests/e2e/blog-index.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/no-js.spec.ts --project=desktop-1440
```

Expected: 所有迁移后的普通页装饰层测试和首页 absence 测试通过。

- [ ] **Step 3: 提交**

```powershell
git add tests/e2e/cursor-trail.spec.ts tests/e2e/sakana.spec.ts tests/e2e/post.spec.ts tests/e2e/blog-index.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/no-js.spec.ts
git commit -m "test: move decorative coverage off home"
```

---

### Task 4: 视觉基线与全量验证

**Files:**
- Modify: `tests/e2e/visual.spec.ts`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-desktop-1440.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-tablet-768.png`
- Modify: `tests/e2e/visual.spec.ts-snapshots/home-mobile-390.png`
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: 完成的首页、交互脚本与稳定 data hooks。
- Produces: 三张首页视觉基线、完整验证记录和更新后的项目说明。

- [ ] **Step 1: 让视觉准备逻辑识别首页**

`visual.spec.ts` 对首页不等待 Sakana，也不强制共享内容边界；减少动态效果或直接把打字文案固定为完整状态后截图。普通页面继续等待 Sakana ready，并保持其余 15 张基线零差异。

```ts
if (path === '/') {
  await expect(page.locator('[data-sakana-layer]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
} else {
  await expect(page.locator('[data-sakana-layer]')).toHaveAttribute('data-sakana-state', 'ready');
}
```

- [ ] **Step 2: 生成并审阅三张首页基线**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Expected: 只更新 `home-desktop-1440.png`、`home-tablet-768.png` 和 `home-mobile-390.png`。使用图像查看工具逐张检查背景裁切、标题位置、右上控件、底部箭头和无滚动条。

- [ ] **Step 3: 同步长期文档**

README 首页说明改为全屏封面、打字文案、博客预取和左右揭开入口；AGENTS 稳定约束写明首页不再渲染 Sakana、CursorTrail 或页脚，且固定视口无滚动。中文内容先按 `humanizer-zh` 检查。

- [ ] **Step 4: 运行全量门禁**

Run:

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
corepack pnpm check:protected
corepack pnpm check:site
corepack pnpm test:e2e
```

Expected: 所有命令退出码为 `0`；`check:site` 的链接总数只在页面结构导致合理变化时按构建证据更新。

- [ ] **Step 5: 浏览器取证**

在 `1440×900`、`390×844` 和至少两个等效缩放视口检查：

- 首页滚动位置始终为 `0`，右侧无滚动条；
- 搜索、主题和移动菜单可用；
- 箭头点击及鼠标左拖都进入博客页；
- 揭开动画期间博客页位于静止下层；
- 非首页品牌、页脚、Sakana 和 CursorTrail 仍存在。

- [ ] **Step 6: 提交**

```powershell
git add AGENTS.md README.md tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots/home-desktop-1440.png tests/e2e/visual.spec.ts-snapshots/home-tablet-768.png tests/e2e/visual.spec.ts-snapshots/home-mobile-390.png
git commit -m "test: verify fullscreen homepage experience"
```
