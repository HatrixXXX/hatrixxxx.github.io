# Contextual Sidebar Implementation Plan

> 后续修正：QQ 音乐改用带 `uin` 的个人资料链接；小红书改用官方 App 深链；时钟只显示加粗后的 Canvas 点阵，语义 `<time>` 视觉隐藏。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在关于页和文章正文页加入资料、统计、音乐三张共享侧栏卡片，并从首页及其他页面移除旧资料卡和全局播放器。

**Architecture:** `SidebarStack.astro` 组合三张卡片，页面只提供已发布文章并决定侧栏位置。纯函数负责构建期统计和点阵数据，`site-stats.ts` 更新运行天数、同步 Vercount 数值并绘制 Canvas 时钟；全局布局持有一个跨页面保留的 Vercount 源节点。

**Tech Stack:** Astro 7、TypeScript 5.9、Vitest 4、Playwright 1.62、Canvas 2D、Vercount、现有 `reading-time` 依赖

## Global Constraints

- Node 版本固定为 24，所有包管理命令使用 Corepack 管理的 pnpm。
- 保持 Astro 纯静态输出，不增加服务器、数据库、Worker、上传或对象存储。
- 保留全部 `/posts/<legacySlug>/` 路径和 Giscus pathname 映射。
- 不修改文章正文、草稿、项目数据和空歌单数据。
- 不复制参考站源码、文案或个人素材；点阵时钟使用独立的 5×7 点阵实现。
- Vercount 只在生产构建加载，本地开发和 Playwright 不发送统计请求。
- 首页、分页、博客列表、归档、作品、留言板和 404 不显示侧栏或播放器。
- 微信入口保留不可点击状态；QQ 音乐使用带 `uin` 的个人资料链接。
- 减少动态效果时，时钟继续更新时间但不生成粒子。
- 不提交 `dist/`、`.astro/`、`reports/`、`test-results/` 或 Playwright trace。

---

### Task 1: 站点统计纯函数

**Files:**
- Create: `src/lib/site-stats.ts`
- Create: `tests/unit/site-stats.test.ts`

**Interfaces:**
- Consumes: `PostEntry` from `src/lib/content.ts` and `reading-time`.
- Produces: `BuiltSiteStats`, `buildSiteStats(posts: readonly PostEntry[]): BuiltSiteStats`, `runningDaysAt(now: Date): number`, `formatSiteDate(date: Date): string`.

- [ ] **Step 1: Write the failing tests**

```ts
import readingTime from 'reading-time';
import { describe, expect, it } from 'vitest';
import { buildSiteStats, formatSiteDate, runningDaysAt } from '../../src/lib/site-stats';
import type { PostEntry } from '../../src/lib/content';

function post(body: string, pubDate: string, updatedDate?: string): PostEntry {
  return {
    body,
    data: {
      pubDate: new Date(pubDate),
      updatedDate: updatedDate ? new Date(updatedDate) : undefined
    }
  } as PostEntry;
}

describe('site statistics', () => {
  it('sums words and uses the latest effective update', () => {
    const posts = [
      post('中文 text', '2025-02-17T00:00:00+08:00'),
      post('another article', '2025-02-18T00:00:00+08:00', '2025-03-01T00:00:00+08:00')
    ];
    expect(buildSiteStats(posts)).toEqual({
      postCount: 2,
      wordCount: posts.reduce((sum, item) => sum + readingTime(item.body ?? '').words, 0),
      lastUpdated: new Date('2025-03-01T00:00:00+08:00')
    });
  });

  it('rejects an empty published collection', () => {
    expect(() => buildSiteStats([])).toThrowError('published posts must not be empty');
  });

  it('uses Shanghai calendar days and counts launch day as day one', () => {
    expect(runningDaysAt(new Date('2025-02-16T15:59:59Z'))).toBe(0);
    expect(runningDaysAt(new Date('2025-02-16T16:00:00Z'))).toBe(1);
    expect(runningDaysAt(new Date('2025-02-17T16:00:00Z'))).toBe(2);
  });

  it('formats dates as YYYY-MM-DD in Shanghai', () => {
    expect(formatSiteDate(new Date('2025-02-28T16:00:00Z'))).toBe('2025-03-01');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `corepack pnpm vitest run tests/unit/site-stats.test.ts`

Expected: FAIL because `src/lib/site-stats.ts` does not exist.

- [ ] **Step 3: Implement the smallest statistics module**

```ts
import readingTime from 'reading-time';
import type { PostEntry } from '@/lib/content';

const DAY_MS = 86_400_000;
const START_DAY_UTC = Date.UTC(2025, 1, 17);
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
});

export interface BuiltSiteStats {
  postCount: number;
  wordCount: number;
  lastUpdated: Date;
}

export function buildSiteStats(posts: readonly PostEntry[]): BuiltSiteStats {
  if (posts.length === 0) throw new RangeError('published posts must not be empty');
  const dates = posts.map((post) => post.data.updatedDate ?? post.data.pubDate);
  return {
    postCount: posts.length,
    wordCount: posts.reduce((sum, post) => sum + readingTime(post.body ?? '').words, 0),
    lastUpdated: new Date(Math.max(...dates.map((date) => date.getTime())))
  };
}

export function runningDaysAt(now: Date): number {
  const parts = dateFormatter.formatToParts(now);
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const currentDay = Date.UTC(number('year'), number('month') - 1, number('day'));
  return Math.max(0, Math.floor((currentDay - START_DAY_UTC) / DAY_MS) + 1);
}

export function formatSiteDate(date: Date): string {
  return dateFormatter.format(date);
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `corepack pnpm vitest run tests/unit/site-stats.test.ts`

Expected: 4 tests pass with no warnings.

- [ ] **Step 5: Commit**

```powershell
git add -- src/lib/site-stats.ts tests/unit/site-stats.test.ts
git commit -m "feat: add site statistics helpers"
```

### Task 2: 点阵时钟纯函数

**Files:**
- Create: `src/lib/dot-clock.ts`
- Create: `tests/unit/dot-clock.test.ts`

**Interfaces:**
- Produces: `ClockPoint`, `formatClockTime(date: Date): string`, `changedDigitIndexes(previous: string, next: string): number[]`, `pointsForClock(value: string): ClockPoint[]`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { changedDigitIndexes, formatClockTime, pointsForClock } from '../../src/lib/dot-clock';

describe('dot clock geometry', () => {
  it('formats a zero-padded clock value', () => {
    expect(formatClockTime(new Date(2025, 0, 1, 9, 8, 7))).toBe('09:08:07');
  });

  it('returns only changed numeric positions', () => {
    expect(changedDigitIndexes('12:34:59', '12:35:00')).toEqual([4, 6, 7]);
  });

  it('creates bounded points for eight clock characters', () => {
    const points = pointsForClock('00:00:00');
    expect(points.length).toBeGreaterThan(0);
    expect(points.every(({ x, y, characterIndex }) =>
      x >= 0 && x < 47 && y >= 0 && y < 7 && characterIndex >= 0 && characterIndex < 8
    )).toBe(true);
  });

  it('rejects values outside the HH:mm:ss shape', () => {
    expect(() => pointsForClock('9:08:07')).toThrowError('clock value must use HH:mm:ss');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `corepack pnpm vitest run tests/unit/dot-clock.test.ts`

Expected: FAIL because `src/lib/dot-clock.ts` does not exist.

- [ ] **Step 3: Implement an independent 5×7 matrix**

Store digits as seven five-character rows, use a two-dot colon, and leave one logical column between characters. `pointsForClock()` rejects strings that do not match `/^\d{2}:\d{2}:\d{2}$/`.

```ts
export interface ClockPoint { x: number; y: number; characterIndex: number }

const glyphs: Record<string, readonly string[]> = {
  '0': ['11111', '10001', '10001', '10001', '10001', '10001', '11111'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['11110', '00001', '00001', '11110', '10000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['10010', '10010', '10010', '11111', '00010', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01111', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '11110'],
  ':': ['0', '0', '1', '0', '1', '0', '0']
};

export function formatClockTime(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function changedDigitIndexes(previous: string, next: string): number[] {
  return [...previous].flatMap((value, index) =>
    value !== ':' && value !== next[index] ? [index] : []
  );
}

export function pointsForClock(value: string): ClockPoint[] {
  if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new RangeError('clock value must use HH:mm:ss');
  }
  const points: ClockPoint[] = [];
  let offset = 0;
  for (const [characterIndex, character] of [...value].entries()) {
    const rows = glyphs[character];
    for (const [y, row] of rows.entries()) {
      for (const [x, cell] of [...row].entries()) {
        if (cell === '1') points.push({ x: offset + x, y, characterIndex });
      }
    }
    offset += rows[0].length + 1;
  }
  return points;
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `corepack pnpm vitest run tests/unit/dot-clock.test.ts`

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- src/lib/dot-clock.ts tests/unit/dot-clock.test.ts
git commit -m "feat: add dot clock geometry"
```

### Task 3: 静态卡片与页面布局

**Files:**
- Modify: `src/config/site.ts`
- Create: `src/components/SocialIcon.astro`
- Modify: `src/components/ProfileSidebar.astro`
- Create: `src/components/SiteStats.astro`
- Create: `src/components/SidebarStack.astro`
- Modify: `src/components/MusicPlayer.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/layouts/PostLayout.astro`
- Modify: `src/components/TableOfContents.astro`
- Modify: `src/pages/about.astro`
- Modify: `src/pages/about/[section].astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/page/[page].astro`
- Modify: `src/pages/archives/index.astro`
- Modify: `tests/e2e/home.spec.ts`
- Modify: `tests/e2e/post.spec.ts`
- Modify: `tests/e2e/about-guestbook.spec.ts`
- Modify: `tests/e2e/index-pages.spec.ts`
- Modify: `tests/e2e/interactions.spec.ts`

**Interfaces:**
- Consumes: `posts: readonly PostEntry[]`, `buildSiteStats()`, `formatSiteDate()`, `runningDaysAt()`, `formatClockTime()`.
- Produces: `[data-sidebar-stack]` whose direct children are `[data-profile-card]`, `[data-site-stats]`, `[data-music-player]` in that order.

- [ ] **Step 1: Write failing route, social, layout and player assertions**

Add or update Playwright coverage with these exact expectations:

```ts
for (const path of ['/', '/page/2/', '/blog/', '/archives/']) {
  await page.goto(path);
  await expect(page.locator('[data-sidebar-stack], [data-music-player]')).toHaveCount(0);
}

for (const path of ['/about/', '/about/hobbies/', '/posts/本科数学大杂烩/']) {
  await page.goto(path);
  const stack = page.locator('[data-sidebar-stack]');
  await expect(stack).toHaveCount(1);
  await expect(stack.locator(':scope > [data-profile-card]')).toHaveCount(1);
  await expect(stack.locator(':scope > [data-site-stats]')).toHaveCount(1);
  await expect(stack.locator(':scope > [data-music-player]')).toHaveCount(1);
}
```

On `/about/`, assert title/tagline, eight requested social items, configured hrefs, HTTP-link `target`/`rel`, same-tab RSS, `mailto:` email, pending WeChat and QQ Music items, article count `40`, and initial visitor fallback `—`. Assert Gitee, Stack Overflow, Twitter, Telegram and QQ are absent.

On the article route at 1440×900, assert the stack is left of `.post-column` and the desktop TOC is right of it. At 390×844, assert `.post-column` is above the stack and document width does not overflow.

Change the empty-player test to start on an article, navigate through an adjacent article link, and verify the marked player node persists. Continue asserting disabled controls, zero progress, no playlist `Audio`, and no media requests.

- [ ] **Step 2: Run focused E2E and verify RED**

Run:

```powershell
corepack pnpm playwright test tests/e2e/home.spec.ts tests/e2e/post.spec.ts tests/e2e/about-guestbook.spec.ts tests/e2e/index-pages.spec.ts tests/e2e/interactions.spec.ts --project=desktop-1440
```

Expected: FAIL because target routes do not have the stack and non-target routes still contain old card/player instances.

- [ ] **Step 3: Replace the social configuration**

```ts
socials: [
  { id: 'rss', label: 'RSS', url: '/rss.xml', color: '#f59e0b' },
  { id: 'github', label: 'GitHub', url: 'https://github.com/HatrixXXX', color: '#a78bfa' },
  { id: 'bilibili', label: 'Bilibili', url: 'https://space.bilibili.com/352420563', color: '#fb7299' },
  { id: 'zhihu', label: '知乎', url: 'https://www.zhihu.com/people/hatrixxxx', color: '#2f88ff' },
  { id: 'xiaohongshu', label: '小红书', url: 'xhsdiscover://user/62a6030000000000190299d', color: '#ff2442' },
  { id: 'wechat', label: '微信', url: null, color: '#07c160' },
  { id: 'qqmusic', label: 'QQ 音乐', url: 'https://y.qq.com/n/ryqq_v2/profile/like/song?uin=oi65oiCA7e4A7c', color: '#e6b800' },
  { id: 'email', label: '邮件', url: 'mailto:3113624526@qq.com', color: '#f97316' }
]
```

- [ ] **Step 4: Build the three static cards**

`SocialIcon.astro` uses local inline SVG and `aria-hidden="true"`: RSS arcs, a cat silhouette, a Bilibili screen, “知”, “红”, overlapping chat bubbles, a music note and an envelope. Do not add an icon dependency.

`ProfileSidebar.astro` drops the `postCount` prop and renders the site title, tagline and a four-column icon grid. HTTP links receive `target="_blank" rel="me noreferrer"`; RSS and email retain native behavior. WeChat is a non-focusable `<span aria-disabled="true" data-social-pending="wechat">`.

`SiteStats.astro` accepts `stats: BuiltSiteStats`, renders article count, locale-formatted word count, initial running days, `—` visitor fallback, formatted last-update date, an accessible `<time data-clock-text>`, and `<canvas data-dot-clock aria-hidden="true">`.

`MusicPlayer.astro` loses fixed positioning, viewport sizing and the special empty-position override. Keep its data attributes, controls and `transition:persist="music-player"`; fit the rows inside a 240–280 px card.

- [ ] **Step 5: Create and place the shared stack**

```astro
<aside class="sidebar-stack" data-sidebar-stack aria-label="站点侧栏">
  <ProfileSidebar />
  <SiteStats stats={buildSiteStats(posts)} />
  <MusicPlayer />
</aside>
```

`SidebarStack.astro` accepts published posts and applies one-column gaps. It becomes sticky only when width and height are sufficient.

Remove `MusicPlayer` from `BaseLayout`. Remove `ProfileSidebar` and sidebar CSS from `/`, `/page/[page]`, and `/archives/`; drop the now-unused full-posts prop from pagination.

In `PostLayout`, query the published collection and keep DOM order as mobile TOC, article column, sidebar. At `min-width: 1280px`, use a local container capped at `1440px` and place the stack left, article center, desktop TOC right. Adjust `TableOfContents` to occupy column 3 at the same breakpoint. Apply sticky positioning to the stack only when `min-width: 1280px` and `min-height: 760px` both match.

In both about routes, query the published collection. Keep content before stack in DOM, then move the stack to the left in the wide two-column layout. Remove the duplicated root-about avatar/social navigation but retain the introduction text and all subpage empty states.

- [ ] **Step 6: Run focused E2E and verify GREEN**

Run the command from Step 2.

Expected: target routes have exactly one ordered stack; non-target routes have no stack or player; social, desktop/mobile geometry, empty player, TOC, Giscus and navigation assertions pass.

- [ ] **Step 7: Commit**

```powershell
git add -- src/config/site.ts src/components/SocialIcon.astro src/components/ProfileSidebar.astro src/components/SiteStats.astro src/components/SidebarStack.astro src/components/MusicPlayer.astro src/layouts/BaseLayout.astro src/layouts/PostLayout.astro src/components/TableOfContents.astro src/pages/about.astro 'src/pages/about/[section].astro' src/pages/index.astro 'src/pages/page/[page].astro' src/pages/archives/index.astro tests/e2e/home.spec.ts tests/e2e/post.spec.ts tests/e2e/about-guestbook.spec.ts tests/e2e/index-pages.spec.ts tests/e2e/interactions.spec.ts
git commit -m "feat: add contextual sidebar cards"
```

### Task 4: 动态统计、Vercount 与时钟粒子

**Files:**
- Create: `src/scripts/site-stats.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/interactions.spec.ts`

**Interfaces:**
- Consumes: `formatClockTime()`, `changedDigitIndexes()`, `pointsForClock()`, and `[data-visitor-count-source]`.
- Produces: idempotent `initializeSiteStats()`, live `[data-running-days]`, `[data-visitor-count]`, `[data-clock-text]`, and Canvas state.

- [ ] **Step 1: Add failing dynamic E2E tests**

Use `page.clock.install()` before visiting `/about/`. Verify `[data-clock-text]` advances exactly one second and `[data-running-days]` changes when advancing across Shanghai midnight. Set the persistent hidden source to `1,234` and assert `[data-visitor-count]` updates through its observer.

With `page.emulateMedia({ reducedMotion: 'reduce' })`, advance one second and assert the time changes while the Canvas never reports `data-clock-particles="active"`. Simulate `document.hidden`/`visibilitychange` through the page test hook and assert animation resynchronizes without accumulating particles.

- [ ] **Step 2: Run the focused interaction test and verify RED**

Run: `corepack pnpm playwright test tests/e2e/interactions.spec.ts --project=desktop-1440 --grep "site statistics|dot clock"`

Expected: FAIL because no browser initializer exists.

- [ ] **Step 3: Implement idempotent live statistics**

`site-stats.ts` initializes every `[data-site-stats]` on initial load and `astro:page-load`. Mark bound roots to prevent duplicate observers and timers. Update running days and text time from one scheduler that ticks once per second.

Scale Canvas backing dimensions with `devicePixelRatio` and a `ResizeObserver`. Draw current points in the theme accent color. When digits change, create particles only from the old points belonging to changed digits, choose colors from a small fixed palette, apply horizontal speed plus downward acceleration, cap the array at 360, and delete off-canvas particles. Stop animation work while the document is hidden; when visible, discard stale particles and redraw current time.

```ts
document.addEventListener('astro:page-load', initializeSiteStats);
initializeSiteStats();
```

- [ ] **Step 4: Add the persistent Vercount source**

Add a standard visually-hidden class to `global.css`. In `BaseLayout`, render this node on every route:

```astro
<span
  id="vercount_value_site_uv"
  data-visitor-count-source
  class="visually-hidden"
  transition:persist="visitor-counter"
>—</span>
```

Load Vercount only in production and import the local initializer with the global scripts:

```astro
{import.meta.env.PROD && <script is:inline defer src="https://events.vercount.one/js"></script>}
<script>
  import '@/scripts/site-stats';
</script>
```

The initializer copies only non-empty, non-`Loading` source text. If Vercount is blocked or fails, the visible value remains `—`. No credential is stored in the page.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
corepack pnpm vitest run tests/unit/dot-clock.test.ts tests/unit/site-stats.test.ts
corepack pnpm playwright test tests/e2e/interactions.spec.ts --project=desktop-1440
```

Expected: live time, midnight rollover, visitor synchronization, reduced motion, visibility resync and existing interaction tests pass; no request reaches Vercount in Playwright.

- [ ] **Step 6: Commit**

```powershell
git add -- src/scripts/site-stats.ts src/layouts/BaseLayout.astro src/styles/global.css tests/e2e/interactions.spec.ts
git commit -m "feat: animate live sidebar statistics"
```

### Task 5: 构建检查、视觉基线和收尾

**Files:**
- Modify if verified link total changes: `scripts/check-built-site.ts`
- Modify: all 18 Windows baselines under `tests/e2e/visual.spec.ts-snapshots/`
- Modify only if reconciliation finds stale text: `AGENTS.md`, `README.md`, `docs/`

**Interfaces:**
- Consumes: completed feature and `dist` generated by the production build.
- Produces: reviewed Windows baselines, synchronized documentation and a running local preview.

- [ ] **Step 1: Run non-visual verification**

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
corepack pnpm check:site
corepack pnpm test:e2e -- --project=desktop-1440 --grep-invert "stable responsive structure"
```

Every command must exit `0`. If `check:site` reports only a changed internal-link total, inspect the built routes and update the single expected value in `scripts/check-built-site.ts`, then rerun the check. Do not update the value by assumption.

- [ ] **Step 2: Generate only affected visual baselines**

```powershell
corepack pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots
```

Expected: all 18 Windows baselines change and no platform suffix is added. Home loses the old profile and player; the article gains the contextual stack; blog, archive, projects and 404 lose the formerly global player.

- [ ] **Step 3: Inspect screenshots**

Inspect all 18 baselines and fresh `/about/` screenshots at 1440×900 and 390×844. Check card order, icon recognition, clock clipping, article width, mobile content order, light/dark contrast and horizontal overflow. Each baseline change must come from removing or relocating the profile, statistics or player cards.

- [ ] **Step 4: Run the complete verification fresh**

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm check:images
corepack pnpm build
corepack pnpm check:site
corepack pnpm test:e2e
```

Expected: all commands exit `0`; the Playwright summary contains no failed or flaky tests and all 18 visual checks pass.

- [ ] **Step 5: Reconcile documentation before the final feature commit**

Invoke `neat-freak`. Compare code with the design and plan for route scope, Vercount behavior, statistic definitions, component paths and verified link totals. Run `humanizer-zh` over any saved Chinese documentation edits.

- [ ] **Step 6: Commit verified baselines and any reconciliation edits**

```powershell
git add -- scripts/check-built-site.ts tests/e2e/visual.spec.ts-snapshots AGENTS.md README.md docs
git diff --cached --check
git commit -m "test: verify contextual sidebar layout"
```

Only add paths that actually changed. Do not add generated directories.

- [ ] **Step 7: Start and keep the required preview running**

Run `corepack pnpm dev --host 127.0.0.1` in a persistent background process. Verify `/`, `/about/`, and `/posts/本科数学大杂烩/` return HTTP 200 at `http://127.0.0.1:4321/`. Leave the process running.
