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
