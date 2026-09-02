# Animated Theme Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reference-inspired sun/moon and cat animation to the existing Astro light/dark theme switch.

**Architecture:** A new Astro component renders a dependency-free decorative overlay, while `theme.ts` coordinates its lifecycle around the existing theme state change. The header continues to own the accessible toggle and gains local SVG state icons.

**Tech Stack:** Astro 7, TypeScript, scoped CSS, Playwright, pnpm on Node 24

## Global Constraints

- Keep the site purely static and add no server, database, or runtime dependency.
- Preserve `hatrix-theme`, existing routes, Giscus synchronization, and all content.
- Draw the animation with local HTML, inline SVG, and CSS only.
- Respect `prefers-reduced-motion: reduce` and retain the 44px accessible button target.
- Do not copy reference-site source, text, or assets.

---

### Task 1: Specify the transition behavior with Playwright

**Files:**
- Modify: `tests/e2e/interactions.spec.ts`

**Interfaces:**
- Consumes: the existing `切换主题` button and `hatrix-theme` storage key
- Produces: assertions for `[data-theme-transition]`, its `hidden` state, and click locking

- [x] **Step 1: Write failing interaction tests**

Add one test that starts in light mode, activates the toggle, observes the overlay, verifies the destination dark theme and stored value, attempts a second activation while the button is disabled, and waits for the overlay to hide. Add a second test that emulates reduced motion and verifies an immediate switch with the overlay still hidden.

- [x] **Step 2: Run the focused tests and verify RED**

Run: `corepack pnpm exec playwright test tests/e2e/interactions.spec.ts --project=desktop-1440 --grep "theme transition|reduced motion"`

Expected: FAIL because `[data-theme-transition]` and the transition lifecycle do not exist.

### Task 2: Add the visual shell and theme-state icons

**Files:**
- Create: `src/components/ThemeTransition.astro`
- Modify: `src/components/SiteHeader.astro`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: `html[data-theme='light'|'dark']`
- Produces: `[data-theme-transition]`, `data-from-theme`, `data-to-theme`, `.is-active`, `.is-leaving`, and the existing `[data-theme-toggle]`

- [x] **Step 1: Render the decorative overlay once in `BaseLayout.astro`**

Create semantic-free markup for a sky, orbiting sun and moon, and CSS cat. Render it next to the other global overlays with `hidden` and `aria-hidden="true"`.

- [x] **Step 2: Style the overlay animation**

Use fixed positioning, a destination-aware day/night gradient, transform-only orbital motion, opacity transitions, and CSS shapes for the cat. Add a reduced-motion rule that removes all transition animation.

- [x] **Step 3: Replace the plain glyph with inline sun and moon SVGs**

Keep `aria-label="切换主题"`, `data-theme-toggle`, the 44px hit target, and CSS-select the visible SVG from the root theme.

- [x] **Step 4: Run Astro checking**

Run: `corepack pnpm check`

Expected: PASS with no Astro or TypeScript errors.

### Task 3: Coordinate the transition with theme state

**Files:**
- Modify: `src/scripts/theme.ts`

**Interfaces:**
- Consumes: `[data-theme-transition]`, `[data-theme-toggle]`, `matchMedia('(prefers-reduced-motion: reduce)')`
- Produces: one locked transition, immediate reduced-motion fallback, persisted theme, updated Giscus theme, and synchronized button state

- [x] **Step 1: Add the minimal transition coordinator**

On activation, determine the current and destination themes, lock the button, reveal and configure the overlay, apply the destination theme after the cover appears, then fade and hide the overlay. Ignore activation while locked. Fall back to immediate `applyTheme` when motion is reduced or the overlay is missing.

- [x] **Step 2: Run the focused tests and verify GREEN**

Run: `corepack pnpm exec playwright test tests/e2e/interactions.spec.ts --project=desktop-1440 --grep "theme transition|reduced motion"`

Expected: both new tests PASS.

- [x] **Step 3: Run all interaction and accessibility tests**

Run: `corepack pnpm exec playwright test tests/e2e/interactions.spec.ts tests/e2e/accessibility.spec.ts --project=desktop-1440`

Expected: PASS.

### Task 4: Verify the production result

**Files:**
- Modify only if intentional diffs exist: `tests/e2e/visual.spec.ts-snapshots/*.png`

**Interfaces:**
- Consumes: the completed feature
- Produces: project-wide verification evidence

- [x] **Step 1: Run static checks and build verification**

Run: `corepack pnpm test:run`, `corepack pnpm check`, `corepack pnpm build`, and `corepack pnpm check:site`.

Expected: every command exits with code 0; `check:site` validates the configured internal-link count.

- [x] **Step 2: Run the full Playwright suite**

Run: `corepack pnpm test:e2e`

Expected: all functional and visual projects pass. If only the intended sun/moon header icon changes snapshots, review the diffs and regenerate those baselines on Windows, then rerun the suite.

- [x] **Step 3: Inspect the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors and no generated build or report directories are staged.

### Task 5: Harden Astro navigation during an active transition

**Files:**
- Modify: `src/components/SiteHeader.astro`
- Modify: `src/scripts/theme.ts`
- Modify: `tests/e2e/interactions.spec.ts`

**Interfaces:**
- Consumes: the existing transition lock and Astro `astro:after-swap` event
- Produces: an immediately persisted destination, cleared timers after a client swap, and correct initial toggle semantics

- [x] **Step 1: Write and verify the navigation race regression**

Start in light mode, activate the theme toggle, assert that `hatrix-theme` is already `dark`, then trigger the archive link before the delayed visual apply. Verify that the destination page is dark, the old overlay is hidden, and the new toggle is enabled.

- [x] **Step 2: Persist destination and clean transition state on swap**

Write the destination to storage when the transition starts. Track timeout handles, cancel them when Astro swaps the page, hide any replacement overlay, unlock the replacement button, then restore the stored destination.

- [x] **Step 3: Remove the hard-coded toggle state**

Do not render a fixed `aria-pressed` value in static markup. Let the existing first client restore set it from the actual root theme.

### Task 6: Slow the celestial arc and match the approved cat reference

**Files:**
- Modify: `tests/e2e/interactions.spec.ts`
- Modify: `src/components/ThemeTransition.astro`
- Modify: `src/scripts/theme.ts`

**Interfaces:**
- Consumes: the existing `[data-theme-transition]` lifecycle and the two local, untracked cat reference screenshots
- Produces: a 2.6-second celestial track with a 0.78-second apex hold and a reference-matched CSS cat

- [x] **Step 1: Extend the existing transition test and verify RED**

In `theme transition runs once and persists the destination theme`, inspect the active celestial animation through `getAnimations()`. Require a `2600` millisecond duration, matching transforms at offsets `0.35` and `0.65`, and a calculated hold of `780` milliseconds. Inspect the cat before and during the transition:

```ts
const cat = overlay.locator('.theme-transition__cat');
const dayCat = await cat.evaluate((element) => {
  const style = getComputedStyle(element);
  return {
    width: style.width,
    background: style.backgroundColor,
    borderRadius: style.borderRadius,
    boxShadow: style.boxShadow,
    clipPath: style.clipPath
  };
});
expect(dayCat).toMatchObject({
  width: '108px',
  background: 'rgb(119, 119, 119)',
  borderRadius: '0px',
  boxShadow: 'none'
});
expect(dayCat.clipPath).toContain('polygon');
await expect(cat.locator('.theme-transition__ear')).toHaveCount(0);
await expect(cat.locator('.theme-transition__whiskers')).toHaveCount(0);
```

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/interactions.spec.ts --project=desktop-1440 --grep "theme transition runs once"
```

Expected: FAIL because the current track lasts 1.8 seconds without apex keyframes and the current cat is 132px wide with separate ears and whiskers.

- [x] **Step 2: Replace the cat markup and CSS**

Keep only the cat container, two eyes with pupils, and the nose. Style the container with the approved dimensions, polygon, and sampled reference colors:

```css
.theme-transition__cat {
  bottom: clamp(-40px, -1.25vw, -24px);
  width: clamp(108px, 5.3125vw, 204px);
  height: auto;
  aspect-ratio: 108 / 132;
  border-radius: 0;
  background: #777;
  box-shadow: none;
  clip-path: polygon(0 0, 22% 12%, 78% 12%, 100% 0, 100% 100%, 0 100%);
}

[data-to-theme='dark'] .theme-transition__cat { background: #444; }
.theme-transition__eye { top: 30px; width: 32px; background: #ffee94; }
.theme-transition__eye--left { left: 10px; }
.theme-transition__eye--right { right: 10px; }
.theme-transition__pupil { width: 4px; height: 30px; background: #ffb399; }
.theme-transition__nose { top: 50px; width: 8px; background: #ffb399; }
```

The night pupil keyframe scales from `27px` to `54px` square so the yellow eye rim remains visible. The small-screen rule uses a `92px` wide, `118px` high cat with proportionally smaller eyes.

- [x] **Step 3: Add the apex hold and synchronize lifecycle timers**

Change the night layer and celestial animations to `2.6s`. Replace the celestial keyframes with:

```css
@keyframes theme-transition-celestial-track {
  0% { transform: translate(calc(-50% - 8vw), calc(-50% + 20vh)); }
  35%, 65% { transform: translate(calc(-50% + 50vw), calc(-50% - 6vh)); }
  100% { transform: translate(calc(-50% + 108vw), calc(-50% + 20vh)); }
}
```

In `theme.ts`, keep `THEME_APPLY_DELAY_MS = 220`, set `THEME_LEAVE_DELAY_MS = 2_620`, and set `THEME_TRANSITION_END_MS = 2_900`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run the focused Playwright command from Step 1.

Expected: PASS with the 2.6-second track, 780-millisecond hold, and reference cat assertions.

- [x] **Step 5: Run project verification**

Run:

```powershell
corepack pnpm test:run
corepack pnpm check
corepack pnpm build
corepack pnpm check:site
corepack pnpm exec playwright test tests/e2e/interactions.spec.ts tests/e2e/accessibility.spec.ts --project=desktop-1440
corepack pnpm test:e2e
git diff --check
```

Expected: every command exits with code 0; the Playwright total and 21 existing visual baselines remain unchanged.

- [x] **Step 6: Review and commit only project files**

Review the active overlay at desktop and mobile sizes. Do not stage `猫咪范例.png` or `猫咪范例2.png`. Commit the implementation, tests, updated spec, and this plan only after the verification evidence is complete.

### Task 7: Match the measured reference-site celestial orbit

**Files:**
- Modify: `tests/e2e/interactions.spec.ts`
- Modify: `src/components/ThemeTransition.astro`
- Modify: `src/scripts/theme.ts`
- Modify: `README.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: the existing transition overlay and measurements from ShokaX `0.4.21` on `https://linn-ylz.com/`
- Produces: the measured 2-second orbit, final `60vw, 14vh` resting position, 910ms fully visible hold, and 3110ms lifecycle

- [x] **Step 1: Replace the custom-path assertions and add a deterministic lifecycle test**

In the existing transition test, inspect `.theme-transition__orbit` rather than an individual celestial body. Assert a 2000ms animation with `cubic-bezier(0.7, 0, 0, 1)`, `rotate(0deg)` and `rotate(360deg)` endpoints. Pause it at the end and verify the active body's top-left position is `60%` of the layout viewport width and `14%` of the viewport height. Move the animation current time to 2900ms and verify that the position has not changed.

Add one Playwright test using `page.clock`:

```ts
test('theme transition matches the reference lifecycle timing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.clock.install();
  await page.goto('/');
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));

  const overlay = page.locator('[data-theme-transition]');
  const toggle = page.getByRole('button', { name: '切换主题' });
  await toggle.click();

  await page.clock.fastForward(409);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.clock.fastForward(1);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.clock.fastForward(2_499);
  await expect(overlay).not.toHaveClass(/is-leaving/);
  await page.clock.fastForward(1);
  await expect(overlay).toHaveClass(/is-leaving/);
  await page.clock.fastForward(199);
  await expect(overlay).toBeVisible();
  await page.clock.fastForward(1);
  await expect(overlay).toBeHidden();
  await expect(toggle).toBeEnabled();
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
corepack pnpm exec playwright test tests/e2e/interactions.spec.ts --project=desktop-1440 --grep "theme transition runs once|reference lifecycle"
```

Expected: FAIL because the current implementation uses a 2.6-second translated path, switches at 220ms, starts leaving at 2620ms, and hides at 2900ms.

- [x] **Step 3: Implement the measured orbit and lifecycle**

Use an independently written orbit layer with the measured geometry:

```css
.theme-transition__orbit {
  position: fixed;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  transform-origin: center bottom;
}

.is-active .theme-transition__orbit {
  animation: theme-transition-celestial-track 2s cubic-bezier(0.7, 0, 0, 1) both;
}

.theme-transition__sun,
.theme-transition__moon {
  top: 32%;
  left: 55%;
}

@keyframes theme-transition-celestial-track {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

Set the overlay enter and leave animations to 200ms. In `theme.ts`, set the apply, leave, and end timers to `410`, `2910`, and `3110` milliseconds. The night gradient changes over 2 seconds after a 410ms delay. Do not add a post-hold descent.

- [x] **Step 4: Run focused verification and verify GREEN**

Run the command from Step 2. Expected: both tests PASS, including exact fake-clock boundaries.

- [ ] **Step 5: Run full verification and start the required preview**

Run `corepack pnpm test:run`, `corepack pnpm check`, `corepack pnpm build`, `corepack pnpm check:site`, and `corepack pnpm test:e2e`. Expected: 48 unit tests, 63 Playwright tests, 80 generated pages, 4653 local links, and 21 unchanged visual baselines.

After verification, start `corepack pnpm dev --host 127.0.0.1` and open `http://127.0.0.1:4321/` in a visible local browser. Keep the preview running and include `[本地预览](http://127.0.0.1:4321/)` in the final response.
