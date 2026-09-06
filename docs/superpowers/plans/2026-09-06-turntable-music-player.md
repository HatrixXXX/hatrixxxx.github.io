# 唱片机音乐播放器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有音乐播放器升级为带旋转黑胶唱片、动态唱臂、完整播放控制与文章页左侧折叠交互的高级横向卡片。

**Architecture:** 保持单一 `MusicPlayer.astro` 组件和单一 `music-player.ts` 状态入口。组件负责可访问的结构、CSS 唱片机和文章页折叠壳层；脚本负责一个 Audio 实例、曲目索引、播放模式、音量/进度和页面切换复用。

**Tech Stack:** Astro 5, TypeScript, 原生 HTML Audio, CSS gradients/animations, Vitest/Astro checks.

## Global Constraints

- 保持纯静态输出，不增加服务器、数据库、远程媒体或第三方播放器依赖。
- `src/data/playlist.ts` 为空时不得创建 `Audio` 对象，视觉界面仍需渲染。
- 保留现有 `hatrix-player` 音量与展开状态存储键。
- 文章正文、路由、Giscus 映射和既有侧栏结构不变。
- 遵守 `prefers-reduced-motion`，按钮和折叠把手必须可键盘操作。

---

### Task 1: 重建播放器结构与视觉样式

**Files:**
- Modify: `src/components/MusicPlayer.astro`
- Modify: `src/components/SidebarStack.astro`
- Test: `tests/unit/music-player.test.ts`

**Interfaces:**
- Consumes: `playlist` and `Track` fields from `src/data/playlist.ts` / `src/types/content.ts`.
- Produces: `[data-music-player]` with `[data-player-*]` hooks, `data-content-page` support, and CSS state selectors consumed by `music-player.ts`.

- [ ] **Step 1: Add structural test expectations**

```ts
it('renders control hooks for playback, mode, volume, progress and turntable', async () => {
  const source = await readFile('src/components/MusicPlayer.astro', 'utf8');
  expect(source).toContain('data-player-prev');
  expect(source).toContain('data-player-play');
  expect(source).toContain('data-player-next');
  expect(source).toContain('data-player-mode');
  expect(source).toContain('data-player-volume');
  expect(source).toContain('data-turntable-record');
  expect(source).toContain('prefers-reduced-motion');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `corepack pnpm vitest run tests/unit/music-player.test.ts`
Expected: FAIL because the new data hooks do not exist.

- [ ] **Step 3: Replace the minimal card markup**

Create a two-column card with track copy, three transport buttons, a mode button exposing `data-player-mode`, a labelled range volume control, progress range/time labels, a fold toggle for content pages, and a right-side `.turntable` containing `.turntable-record`, `.turntable-tonearm`, `.turntable-cartridge`, and status light. Add `data-content-page={Astro.url.pathname.startsWith('/posts/') ? 'true' : undefined}` so only article details collapse.

- [ ] **Step 4: Add layered CSS**

Use CSS custom properties for record size and arm angles. Build the platter, record grooves, label and glossy highlight with gradients; use `overflow: visible`, layered shadows, and a small `transform: translate3d(18px, -8px, 0)` on the turntable shell. Add selectors for `[data-playback-state='playing']` rotation and arm angle, `[data-ui-state='collapsed']` off-canvas transform, mobile bottom drawer, focus-visible rings, and reduced-motion overrides.

- [ ] **Step 5: Run the focused test**

Run: `corepack pnpm vitest run tests/unit/music-player.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/MusicPlayer.astro src/components/SidebarStack.astro tests/unit/music-player.test.ts
git commit -m "feat: build turntable music player card"
```

### Task 2: Implement persistent audio and player controls

**Files:**
- Modify: `src/scripts/music-player.ts`
- Modify: `tests/unit/music-player.test.ts`

**Interfaces:**
- Consumes: `data-player-prev`, `data-player-play`, `data-player-next`, `data-player-mode`, `data-player-volume`, `data-player-progress`, and `data-music-player`.
- Produces: synchronized `data-playback-state`, `data-player-mode`, labels, time text and persisted `{ volume, expanded, mode, index }` state.

- [ ] **Step 1: Add pure behavior tests**

```ts
it('cycles playback modes in order', () => {
  expect(nextMode('sequence')).toBe('shuffle');
  expect(nextMode('shuffle')).toBe('single');
  expect(nextMode('single')).toBe('sequence');
});

it('does not construct Audio when tracks are empty', () => {
  expect(initializeMusicPlayer([], document)).toBeUndefined();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `corepack pnpm vitest run tests/unit/music-player.test.ts`
Expected: FAIL because `nextMode` and the new control wiring are absent.

- [ ] **Step 3: Implement the smallest stateful controller**

Export `nextMode`, read/write `hatrix-player`, create one `Audio` per persisted player root, and bind listeners once via `data-bound`. Implement sequence, shuffle and single-loop index selection; bind `ended`, `timeupdate`, `loadedmetadata`, `play`, `pause`, and `error`. Update button labels/disabled states and set `data-playback-state` for CSS.

- [ ] **Step 4: Add fold behavior**

On article pages, bind the fold button to toggle `data-ui-state`, persist `expanded`, and close on Escape. On non-article pages force `expanded`. Keep the empty playlist card interactive only for folding.

- [ ] **Step 5: Run focused tests**

Run: `corepack pnpm vitest run tests/unit/music-player.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/scripts/music-player.ts tests/unit/music-player.test.ts
git commit -m "feat: wire playlist controls and turntable states"
```

### Task 3: Verify site behavior and preview

**Files:**
- Modify: `tests/e2e/music-player.spec.ts` if existing e2e conventions require a new focused case.

- [ ] **Step 1: Run project checks**

Run: `corepack pnpm check`
Expected: PASS.

- [ ] **Step 2: Run unit tests and build**

Run: `corepack pnpm test:run`; then `corepack pnpm build`
Expected: PASS; build output contains no private content leakage.

- [ ] **Step 3: Start local preview**

Run: `corepack pnpm dev --host 127.0.0.1`
Expected: Astro dev server listens on `http://127.0.0.1:4321/`.

- [ ] **Step 4: Manually verify**

Open an article route and confirm the left fold handle expands the card, Escape closes it, playing rotates the record and moves the tonearm, mode button cycles labels, volume range responds to keyboard/mouse, and the about page remains expanded.

- [ ] **Step 5: Commit verification-only changes if any**

```powershell
git status --short
git diff --check
```

## Self-review

The plan covers visual structure, article-only collapse, audio lifecycle, three playback modes, volume/progress controls, reduced motion, empty playlist behavior, project checks and local preview. It introduces no new dependencies, route changes or content edits.
