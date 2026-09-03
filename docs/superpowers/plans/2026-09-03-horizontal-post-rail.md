# Horizontal Post Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace vertical article feeds with a horizontally scrollable three-card rail and replace the homepage feed with a link to `/blog/`.

**Architecture:** `PostList.astro` remains the shared list boundary and becomes a native horizontal overflow region. `PostCard.astro` owns the vertical card dimensions, while a small delegated browser script translates vertical wheel movement and mouse dragging into `scrollLeft`; the native overflow remains usable without JavaScript. The homepage keeps its article collection only for the profile count and renders a CTA instead of cards or pagination.

**Tech Stack:** Astro 7, TypeScript, scoped CSS, Astro ClientRouter, Playwright, Vitest, pnpm on Node 24.

## Global Constraints

- Keep Astro output fully static and add no dependency.
- Preserve every `/posts/<legacySlug>/` route and Giscus pathname mapping.
- Do not edit article bodies, article metadata, projects, or playlist data.
- Keep `/page/2/` through `/page/7/` as compatibility routes, but remove their entry points from the homepage.
- Do not touch unrelated cursor-trail changes already present in the shared worktree.
- Use exact-path staging and inspect the index before every commit because other Codex sessions share the repository.

---

### Task 1: Homepage article entry

**Files:**
- Modify: `tests/e2e/home.spec.ts`
- Modify: `tests/e2e/visual.spec.ts`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: the published `posts` collection and `ProfileSidebar`'s `postCount` property.
- Produces: `a[data-blog-entry]` with `href="/blog/"`; no homepage `PostList` or `Pagination` instance.

- [ ] **Step 1: Write the failing homepage test**

Replace the first test in `tests/e2e/home.spec.ts` with:

```ts
test('home links to the blog without rendering an article feed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('article[data-post-card]')).toHaveCount(0);
  await expect(page.locator('.pagination')).toHaveCount(0);
  await expect(page.locator('[data-post-count]')).toHaveText('40');
  await expect(page.getByRole('link', { name: '浏览全部博客文章' })).toHaveAttribute(
    'href',
    '/blog/'
  );
  await expect(page.locator('a[href^="/categories/"], a[href^="/tags/"]')).toHaveCount(0);

  const missingFirstPage = await page.request.get('/page/1/');
  expect(missingFirstPage.status()).toBe(404);
  expect((await page.request.get('/page/2/')).status()).toBe(200);
  expect((await page.request.get('/page/7/')).status()).toBe(200);
});
```

Change the homepage assertion in `tests/e2e/visual.spec.ts` to:

```ts
if (path === '/') expect(metrics.visiblePostCards).toBe(0);
```

In the sidebar test, replace both `.first()` card probes with `.home-blog-entry` and keep the same desktop-right/mobile-above assertions:

```ts
const desktopEntry = await page.locator('.home-blog-entry').boundingBox();
expect(desktopSidebar?.x).toBeGreaterThan((desktopEntry?.x ?? 0) + (desktopEntry?.width ?? 0));

// after changing to the mobile viewport and reloading
const mobileEntry = await page.locator('.home-blog-entry').boundingBox();
expect(mobileSidebar?.y).toBeLessThan(mobileEntry?.y ?? 0);
```

In the mobile overflow test, replace the card width probe with:

```ts
const entry = await page.locator('.home-blog-entry').boundingBox();
expect(sidebar?.width).toBeGreaterThan(340);
expect(entry?.width).toBeGreaterThan(340);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/home.spec.ts --project=desktop-1440
```

Expected: the first test fails because six post cards and `.pagination` still exist and `data-blog-entry` is missing.

- [ ] **Step 3: Replace the homepage feed with the CTA**

In `src/pages/index.astro`, remove the `Pagination`, `PostList`, `paginatePosts`, and `sortPosts` imports. Keep the collection query for the profile count, then replace `.home-feed` with:

```astro
<section class="home-blog-entry" aria-labelledby="home-blog-heading">
  <h2 id="home-blog-heading">博客文章</h2>
  <p>文章集中放在博客页面，可以浏览全部内容，也可以按文章类型查看。</p>
  <a href="/blog/" data-blog-entry>浏览全部博客文章 <span aria-hidden="true">→</span></a>
</section>
```

Add these scoped styles and leave the existing grid/sidebar breakpoints intact:

```css
.home-blog-entry {
  display: grid;
  min-height: 300px;
  place-content: center;
  justify-items: center;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  padding: clamp(2rem, 6vw, 4rem);
  background: var(--color-surface);
  box-shadow: var(--shadow-panel);
  text-align: center;
}

.home-blog-entry h2 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.4rem); }
.home-blog-entry p { max-width: 34rem; margin: 0.8rem 0 1.5rem; color: var(--color-muted); }
.home-blog-entry a {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid var(--color-accent);
  border-radius: 999px;
  padding: 0.65rem 1.25rem;
  background: var(--color-accent);
  color: #161a20;
  font-weight: 800;
}
.home-blog-entry a:hover { background: var(--color-accent-strong); }
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run the command from Step 2. Expected: every `home.spec.ts` test passes, including the desktop-right/mobile-above sidebar checks against `.home-blog-entry`.

- [ ] **Step 5: Commit only Task 1 files**

```powershell
git diff --check -- src/pages/index.astro tests/e2e/home.spec.ts tests/e2e/visual.spec.ts
git commit --only -m "feat: replace home feed with blog entry" -- src/pages/index.astro tests/e2e/home.spec.ts tests/e2e/visual.spec.ts
```

### Task 2: Horizontal card layout and no-JavaScript fallback

**Files:**
- Modify: `tests/e2e/blog-index.spec.ts`
- Modify: `tests/e2e/no-js.spec.ts`
- Modify: `src/components/PostList.astro`
- Modify: `src/components/PostCard.astro`

**Interfaces:**
- Consumes: `PostEntry[]` supplied by `/blog/`, `/blog/[type]/`, and `/page/[page]/`.
- Produces: focusable `[data-post-rail]` native overflow region containing vertical `article[data-post-card]` items.

- [ ] **Step 1: Write failing layout tests**

Add to the `/blog/` test in `tests/e2e/blog-index.spec.ts` after the count assertion:

```ts
const rail = page.locator('[data-post-rail]');
await expect(rail).toHaveAttribute('tabindex', '0');
const layout = await rail.evaluate((element) => {
  const cards = [...element.querySelectorAll<HTMLElement>('article[data-post-card]')];
  const tops = cards.slice(0, 4).map((card) => Math.round(card.getBoundingClientRect().top));
  const firstWidth = cards[0]?.getBoundingClientRect().width ?? 0;
  return {
    overflow: element.scrollWidth > element.clientWidth,
    tops,
    firstWidth,
    rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});
expect(layout.overflow).toBe(true);
expect(new Set(layout.tops).size).toBe(1);
expect(layout.firstWidth).toBeGreaterThanOrEqual(272);
expect(layout.firstWidth).toBeLessThanOrEqual(352);
expect(layout.rootOverflow).toBe(0);
```

Extend the first no-JavaScript test in `tests/e2e/no-js.spec.ts` after navigation to `/blog/`:

```ts
const rail = page.locator('[data-post-rail]');
await expect(rail).toBeVisible();
expect(await rail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
```

- [ ] **Step 2: Run the layout tests and confirm RED**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/blog-index.spec.ts tests/e2e/no-js.spec.ts --project=desktop-1440
```

Expected: tests fail because `[data-post-rail]` does not exist and the current grid places cards at different vertical positions.

- [ ] **Step 3: Implement the horizontal list boundary**

Change `src/components/PostList.astro` markup to:

```astro
<section
  class="post-list"
  aria-label="文章列表"
  aria-describedby="post-list-instructions"
  tabindex="0"
  data-post-rail
>
  {posts.map((post) => <PostCard post={post} />)}
</section>
<p id="post-list-instructions" class="post-list-instructions">
  使用鼠标滚轮、拖拽、触摸滑动或方向键横向浏览文章。
</p>

<script>
  import '@/scripts/post-rail';
</script>
```

Replace the component style with:

```css
.post-list {
  display: flex;
  min-width: 0;
  align-items: stretch;
  gap: clamp(1rem, 2.2vw, 1.5rem);
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.25rem 0.125rem 1rem;
  cursor: grab;
  scroll-padding-inline: 0.125rem;
  scroll-snap-type: x proximity;
  scrollbar-color: var(--color-accent) var(--color-surface-raised);
  scrollbar-width: thin;
}

.post-list::-webkit-scrollbar { height: 8px; }
.post-list::-webkit-scrollbar-track {
  border-radius: 999px;
  background: var(--color-surface-raised);
}
.post-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--color-accent);
}
.post-list[data-dragging='true'] { cursor: grabbing; scroll-snap-type: none; }
.post-list[data-dragging='true'] :global(*) { cursor: grabbing; user-select: none; }
.post-list-instructions {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Step 4: Implement the vertical card**

Remove `index` and `data-side` from `src/components/PostCard.astro`. Set `.post-card` to:

```css
.post-card {
  display: flex;
  flex: 0 0 clamp(17rem, 27vw, 22rem);
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-panel);
  scroll-snap-align: start;
}
```

Give `.post-card-media` a `16 / 10` aspect ratio, make `.post-card-content` a flex column with `flex: 1`, and push `.post-meta` to the bottom with `margin-top: auto`. At `max-width: 768px`, set the card basis to `min(84vw, 21rem)` and keep the same vertical layout.

Use these exact replacement rules for the remaining layout selectors:

```css
.post-card-media {
  display: block;
  overflow: hidden;
  aspect-ratio: 16 / 10;
  background: var(--color-surface-raised);
  user-select: none;
  -webkit-user-drag: none;
}
.post-card-media :global(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 320ms ease;
  -webkit-user-drag: none;
}
.post-card-content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  padding: 1.35rem;
}
.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin-top: auto;
  padding-top: 1.15rem;
  color: var(--color-muted);
  font-size: 0.78rem;
}
@media (max-width: 768px) {
  .post-card { flex-basis: min(84vw, 21rem); }
  .post-card-content { padding: 1.25rem; }
}
```

- [ ] **Step 5: Run the layout tests and confirm GREEN**

Run the command from Step 2. Expected: all blog route counts, horizontal layout checks, and no-JavaScript navigation checks pass.

- [ ] **Step 6: Commit only Task 2 files**

```powershell
git diff --check -- src/components/PostList.astro src/components/PostCard.astro tests/e2e/blog-index.spec.ts tests/e2e/no-js.spec.ts
git commit --only -m "feat: lay out posts in horizontal cards" -- src/components/PostList.astro src/components/PostCard.astro tests/e2e/blog-index.spec.ts tests/e2e/no-js.spec.ts
```

### Task 3: Blog card/archive view switch

**Files:**
- Create: `src/components/PostArchiveList.astro`
- Create: `src/scripts/blog-view.ts`
- Modify: `src/pages/archives/index.astro`
- Modify: `src/pages/blog/index.astro`
- Modify: `tests/e2e/blog-index.spec.ts`
- Modify: `tests/e2e/no-js.spec.ts`

**Interfaces:**
- Consumes: `ArchiveMonth[]` from `buildArchives(posts)`.
- Produces: shared `PostArchiveList` markup plus a `/blog/`-only `[data-blog-view-toggle]` that switches `[data-blog-card-view]` and `[data-blog-archive-view]`.

- [ ] **Step 1: Write failing view-switch tests**

Add to the main `/blog/` test in `tests/e2e/blog-index.spec.ts`:

```ts
const toggle = page.locator('[data-blog-view-toggle]');
const cardView = page.locator('[data-blog-card-view]');
const archiveView = page.locator('[data-blog-archive-view]');
await expect(toggle).toBeVisible();
await expect(toggle).toHaveText('切换到时间归档');
await expect(toggle).toHaveAttribute('aria-pressed', 'false');
await expect(cardView).toBeVisible();
await expect(archiveView).toBeHidden();

await toggle.click();
await expect(toggle).toHaveText('切换到卡片视图');
await expect(toggle).toHaveAttribute('aria-pressed', 'true');
await expect(cardView).toBeHidden();
await expect(archiveView).toBeVisible();
await expect(archiveView.locator('a[href^="/posts/"]')).toHaveCount(40);

await toggle.click();
await expect(cardView).toBeVisible();
await expect(archiveView).toBeHidden();
await page.reload();
await expect(toggle).toHaveAttribute('aria-pressed', 'false');
await expect(cardView).toBeVisible();
```

Inside each article type route test, add:

```ts
await expect(page.locator('[data-blog-view-toggle]')).toHaveCount(0);
```

In the no-JavaScript blog test, add:

```ts
await expect(page.locator('[data-blog-view-toggle]')).toBeHidden();
await expect(page.locator('[data-blog-card-view]')).toBeVisible();
await expect(page.locator('[data-blog-archive-view]')).toBeHidden();
```

- [ ] **Step 2: Run the view tests and confirm RED**

```powershell
corepack pnpm exec playwright test tests/e2e/blog-index.spec.ts tests/e2e/no-js.spec.ts --project=desktop-1440
```

Expected: `/blog/` assertions fail because the button and both named view containers do not exist.

- [ ] **Step 3: Extract the existing archive list**

Create `src/components/PostArchiveList.astro`:

```astro
---
import type { ArchiveMonth } from '@/lib/content';
import { postPath } from '@/lib/urls';

interface Props { archives: ArchiveMonth[]; }
const { archives } = Astro.props;
---

<div class="archive-groups">
  {archives.map((archive) => (
    <section class="archive-month">
      <h2>{archive.year} 年 {archive.month} 月</h2>
      <ul>
        {archive.posts.map((post) => (
          <li>
            <time datetime={post.data.pubDate.toISOString()}>{post.data.pubDate.getDate()} 日</time>
            <a href={postPath(post.data.legacySlug)}>{post.data.title}</a>
          </li>
        ))}
      </ul>
    </section>
  ))}
</div>

<style>
  .archive-groups { min-width: 0; }
  .archive-month { margin-left: 0.5rem; border-left: 2px solid var(--color-accent); padding: 0 0 1.75rem 1.25rem; }
  .archive-month:last-child { padding-bottom: 0; }
  h2 { margin: 0; color: #fff; font-size: 1.25rem; }
  ul { display: grid; gap: 0.6rem; margin: 0.9rem 0 0; padding: 0; list-style: none; }
  li { display: flex; min-width: 0; gap: 0.75rem; }
  time { flex: none; color: var(--color-muted); font-size: 0.85rem; }
  a { overflow-wrap: anywhere; }
  a:hover { color: var(--color-accent); }
</style>
```

Import it in `src/pages/archives/index.astro`, replace the existing `archives.map(...)` block with `<PostArchiveList archives={archives} />`, remove the now-unused `postPath` import, and delete only the archive-month/list rules moved into the component.

The resulting archive section stays:

```astro
<section class="archive-list" aria-label="文章归档">
  <p class="archive-total">已归档 <strong data-archive-total>{posts.length}</strong> 篇文章</p>
  <PostArchiveList archives={archives} />
</section>
```

- [ ] **Step 4: Render both `/blog/` views**

In `src/pages/blog/index.astro`, import `PostArchiveList`, add `buildArchives` to the content import, and define `const archives = buildArchives(posts)`. Replace its main contents with:

```astro
<div class="blog-view" data-blog-view-root>
  <div class="blog-toolbar">
    <p class="blog-total">共 <strong data-blog-total>{posts.length}</strong> 篇文章</p>
    <button
      type="button"
      aria-controls="blog-card-view blog-archive-view"
      aria-pressed="false"
      data-blog-view-toggle
      hidden
    >切换到时间归档</button>
  </div>
  <div id="blog-card-view" data-blog-card-view>
    <PostList posts={posts} />
  </div>
  <section id="blog-archive-view" aria-label="按时间归档" data-blog-archive-view hidden>
    <PostArchiveList archives={archives} />
  </section>
</div>

<script>
  import '@/scripts/blog-view';
</script>
```

Replace the page styles with:

```css
.blog-main { padding-block: clamp(2.5rem, 6vw, 5rem); }
.blog-view { min-width: 0; }
.blog-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.25rem;
  margin-bottom: 1.5rem;
}
.blog-total { margin: 0; color: var(--color-muted); }
.blog-total strong { color: var(--color-accent); font-size: 1.25em; }
button {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  padding: 0.55rem 1rem;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
button[hidden] { display: none; }
button:hover { border-color: var(--color-accent); color: var(--color-accent); }
[data-blog-archive-view] { min-width: 0; }
```

- [ ] **Step 5: Implement the delegated view switch**

Create `src/scripts/blog-view.ts`:

```ts
const TOGGLE_SELECTOR = '[data-blog-view-toggle]';

function setArchiveView(toggle: HTMLButtonElement, showArchive: boolean): void {
  const root = toggle.closest<HTMLElement>('[data-blog-view-root]');
  const cardView = root?.querySelector<HTMLElement>('[data-blog-card-view]');
  const archiveView = root?.querySelector<HTMLElement>('[data-blog-archive-view]');
  if (!cardView || !archiveView) return;
  cardView.hidden = showArchive;
  archiveView.hidden = !showArchive;
  toggle.setAttribute('aria-pressed', String(showArchive));
  toggle.textContent = showArchive ? '切换到卡片视图' : '切换到时间归档';
}

function initializeBlogViews(): void {
  for (const toggle of document.querySelectorAll<HTMLButtonElement>(TOGGLE_SELECTOR)) {
    setArchiveView(toggle, false);
    toggle.hidden = false;
  }
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const toggle = event.target.closest<HTMLButtonElement>(TOGGLE_SELECTOR);
  if (!toggle) return;
  setArchiveView(toggle, toggle.getAttribute('aria-pressed') !== 'true');
});
document.addEventListener('astro:page-load', initializeBlogViews);
initializeBlogViews();
```

- [ ] **Step 6: Run the view tests and confirm GREEN**

Run the command from Step 2. Expected: both files pass; `/blog/` returns to cards after reload, and type pages expose no toggle.

- [ ] **Step 7: Commit only Task 3 files**

```powershell
git diff --check -- src/components/PostArchiveList.astro src/scripts/blog-view.ts src/pages/archives/index.astro src/pages/blog/index.astro tests/e2e/blog-index.spec.ts tests/e2e/no-js.spec.ts
git commit --only -m "feat: switch blog between cards and archive" -- src/components/PostArchiveList.astro src/scripts/blog-view.ts src/pages/archives/index.astro src/pages/blog/index.astro tests/e2e/blog-index.spec.ts tests/e2e/no-js.spec.ts
```

### Task 4: Wheel and mouse-drag interaction

**Files:**
- Create: `src/scripts/post-rail.ts`
- Modify: `tests/e2e/blog-index.spec.ts`

**Interfaces:**
- Consumes: any `HTMLElement` matched by `[data-post-rail]`.
- Produces: delegated wheel and mouse pointer behavior; no exported application state.

- [ ] **Step 1: Write failing interaction tests**

Add this wheel test to `tests/e2e/blog-index.spec.ts`:

```ts
test('mouse wheel scrolls the rail and returns vertical scrolling at its end', async ({ page }) => {
  await page.goto('/blog/');
  const rail = page.locator('[data-post-rail]');
  await rail.scrollIntoViewIfNeeded();
  await rail.evaluate((element) => { element.scrollLeft = 0; });
  const box = await rail.boundingBox();
  if (!box) throw new Error('Missing post rail bounds');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const pageStart = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 420);
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageStart);

  await rail.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  const pageAtRailEnd = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 420);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(pageAtRailEnd);
});
```

The second test starts on the first title link, holds the primary mouse button, moves 180 px left, releases, and asserts both `rail.scrollLeft > 0` and that the current pathname remains `/blog/`:

```ts
test('dragging a post link scrolls the rail without opening the article', async ({ page }) => {
  await page.goto('/blog/');
  const rail = page.locator('[data-post-rail]');
  const link = page.locator('article[data-post-card] h2 a').first();
  const box = await link.boundingBox();
  if (!box) throw new Error('Missing first post link bounds');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 180, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/blog\/$/);
});
```

- [ ] **Step 2: Run the interaction tests and confirm RED**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/blog-index.spec.ts --project=desktop-1440
```

Expected: wheel scrolling moves the document instead of the rail, and dragging the title link does not move `scrollLeft`.

- [ ] **Step 3: Implement delegated rail input**

Create `src/scripts/post-rail.ts` with:

```ts
const RAIL_SELECTOR = '[data-post-rail]';
const DRAG_THRESHOLD = 4;

interface DragState {
  pointerId: number;
  rail: HTMLElement;
  startX: number;
  startScrollLeft: number;
  moved: boolean;
}

let dragState: DragState | null = null;
const suppressedClicks = new WeakSet<HTMLElement>();

function railFromEvent(event: Event): HTMLElement | null {
  return event.target instanceof Element
    ? event.target.closest<HTMLElement>(RAIL_SELECTOR)
    : null;
}

function wheelDelta(event: WheelEvent, rail: HTMLElement): number {
  const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return raw * 24;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return raw * rail.clientWidth;
  return raw;
}

document.addEventListener('wheel', (event) => {
  const rail = railFromEvent(event);
  if (!rail) return;
  const delta = wheelDelta(event, rail);
  if (delta === 0) return;

  const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);
  const canMove = delta < 0 ? rail.scrollLeft > 1 : rail.scrollLeft < maximum - 1;
  if (!canMove) return;
  event.preventDefault();
  rail.scrollLeft = Math.min(maximum, Math.max(0, rail.scrollLeft + delta));
}, { passive: false });

document.addEventListener('pointerdown', (event) => {
  const rail = railFromEvent(event);
  if (!rail || event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
  dragState = {
    pointerId: event.pointerId,
    rail,
    startX: event.clientX,
    startScrollLeft: rail.scrollLeft,
    moved: false
  };
  rail.setPointerCapture(event.pointerId);
});

document.addEventListener('pointermove', (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const distance = event.clientX - dragState.startX;
  if (!dragState.moved && Math.abs(distance) < DRAG_THRESHOLD) return;
  dragState.moved = true;
  dragState.rail.dataset.dragging = 'true';
  event.preventDefault();
  dragState.rail.scrollLeft = dragState.startScrollLeft - distance;
});

function finishDrag(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { rail, moved, pointerId } = dragState;
  if (rail.hasPointerCapture(pointerId)) rail.releasePointerCapture(pointerId);
  delete rail.dataset.dragging;
  dragState = null;
  if (!moved) return;
  suppressedClicks.add(rail);
  window.setTimeout(() => suppressedClicks.delete(rail), 0);
}

document.addEventListener('pointerup', finishDrag);
document.addEventListener('pointercancel', finishDrag);
document.addEventListener('dragstart', (event) => {
  if (railFromEvent(event)) event.preventDefault();
});
document.addEventListener('click', (event) => {
  const rail = railFromEvent(event);
  if (!rail || !suppressedClicks.has(rail)) return;
  suppressedClicks.delete(rail);
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
```

- [ ] **Step 4: Run the interaction tests and confirm GREEN**

Run the command from Step 2. Expected: the complete blog-index suite passes, including counts for all five type routes.

- [ ] **Step 5: Commit only Task 4 files**

```powershell
git diff --check -- src/scripts/post-rail.ts tests/e2e/blog-index.spec.ts
git commit --only -m "feat: add wheel and drag post navigation" -- src/scripts/post-rail.ts tests/e2e/blog-index.spec.ts
```

### Task 5: Full verification and visual baselines

**Files:**
- Modify if the verified count changes: `scripts/check-built-site.ts`
- Update: `tests/e2e/visual.spec.ts-snapshots/home-desktop-1440.png`
- Update: `tests/e2e/visual.spec.ts-snapshots/home-tablet-768.png`
- Update: `tests/e2e/visual.spec.ts-snapshots/home-mobile-390.png`
- Update: `tests/e2e/visual.spec.ts-snapshots/-blog--desktop-1440.png`
- Update: `tests/e2e/visual.spec.ts-snapshots/-blog--tablet-768.png`
- Update: `tests/e2e/visual.spec.ts-snapshots/-blog--mobile-390.png`

**Interfaces:**
- Consumes: built static HTML and the verified final responsive layout.
- Produces: current Windows baselines and an exact `EXPECTED_LOCAL_LINKS` count matching `dist`.

- [ ] **Step 1: Run functional and type checks**

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
```

Expected: all commands exit 0. If a command fails, use `superpowers:systematic-debugging` before changing production code.

- [ ] **Step 2: Verify the built link count**

Run `corepack pnpm check:site`. The expected count is 5368: the homepage loses twelve card links, six transformed image `src` values, and seven pagination links, then gains one CTA link; the server-rendered archive view adds forty article links to `/blog/`. If the checker reports another count, inspect `dist/index.html` and resolve the discrepancy instead of copying the number blindly. Once confirmed, change:

```ts
const EXPECTED_LOCAL_LINKS = 5368;
```

Rerun `corepack pnpm check:site` and expect exit code 0.

- [ ] **Step 3: Run functional Playwright suites**

```powershell
corepack pnpm exec playwright test --project=desktop-1440 --grep-invert "stable responsive structure"
```

Expected: all desktop functional tests pass with zero failures.

- [ ] **Step 4: Update and inspect visual baselines**

```powershell
corepack pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Open all six changed homepage/blog images and confirm there is no clipped card text, root-level horizontal overflow, remote-image failure, or overlap with the empty music player. Do not update unrelated route baselines.

- [ ] **Step 5: Run the complete E2E suite after baseline review**

```powershell
corepack pnpm test:e2e
```

Expected: all desktop, tablet, and mobile tests pass, including visual comparisons.

- [ ] **Step 6: Commit verified generated expectations only**

```powershell
git diff --check
git commit --only -m "test: verify horizontal post rail" -- scripts/check-built-site.ts tests/e2e/visual.spec.ts-snapshots/home-desktop-1440.png tests/e2e/visual.spec.ts-snapshots/home-tablet-768.png tests/e2e/visual.spec.ts-snapshots/home-mobile-390.png tests/e2e/visual.spec.ts-snapshots/-blog--desktop-1440.png tests/e2e/visual.spec.ts-snapshots/-blog--tablet-768.png tests/e2e/visual.spec.ts-snapshots/-blog--mobile-390.png
```

- [ ] **Step 7: Start the required development preview**

Run `corepack pnpm dev --host 127.0.0.1` in a persistent process. Confirm `http://127.0.0.1:4321/` returns HTTP 200 and leave the process running for user review.
