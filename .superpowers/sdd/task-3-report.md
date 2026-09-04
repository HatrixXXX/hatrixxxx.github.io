# Task 3 report: unified site header

## Scope

- Removed the Header brand/avatar on every route and made navigation plus search/theme controls right-aligned.
- Kept `site-header--home` as the homepage hook only. It no longer changes the Header's visual layout.
- Added an event-transparent `[data-content-boundary]` separate from Header controls, so ordinary-page CursorTrail geometry still uses the content width.
- Moved positive CursorTrail/Sakana checks and their client-navigation persistence checks to ordinary pages. The homepage now asserts that both decorative runtimes are absent.

## RED / GREEN evidence

- RED: `corepack pnpm exec playwright test tests/e2e/shell.spec.ts tests/e2e/navigation-dropdown.spec.ts --project=desktop-1440` exited 1 before implementation. `[data-header-controls]` did not exist on the current Header.
- GREEN: the same Header and dropdown tests passed after the Header change.
- One subsequent combined run reported `net::ERR_ABORTED` while navigating from `/` to `/projects/` in the decorative-runtime absence check. A fresh complete run passed; no assertion or production failure remained.

## Verification

- `corepack pnpm exec playwright test tests/e2e/shell.spec.ts tests/e2e/navigation-dropdown.spec.ts tests/e2e/cursor-trail.spec.ts tests/e2e/sakana.spec.ts tests/e2e/post.spec.ts tests/e2e/blog-index.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/no-js.spec.ts --project=desktop-1440` exited 0: 70 passed.
- `corepack pnpm test:run` exited 0: 20 files and 290 tests passed.
- `corepack pnpm check` exited 0 with 0 Astro errors, warnings, and hints. Its CLI still prints the existing Markdown-plugin deprecation notice and the empty `src/content/projects` glob notice.
- No visual snapshots were updated.

## Files

- `src/layouts/BaseLayout.astro`
- `src/components/SiteHeader.astro`
- `tests/e2e/shell.spec.ts`
- `tests/e2e/navigation-dropdown.spec.ts`
- `tests/e2e/cursor-trail.spec.ts`
- `tests/e2e/sakana.spec.ts`
- `tests/e2e/post.spec.ts`
- `tests/e2e/blog-index.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/no-js.spec.ts`

## Commit

`feat: unify the site header layout`

## Self-review and concerns

The Header controls are tested across the homepage, blog, projects, about, and an article. Desktop submenu tests still cover 769, 800, 1024, and 1440 pixels, now on both the homepage and projects page. The tests leave the original no-JavaScript anchors and ordinary-page footer/Sakana/CursorTrail coverage in place.

The only observed concern was the one-off local navigation abort noted above; it did not recur in the fresh full focused run.

## Follow-up: collapsed-header keyboard order

- RED: `corepack pnpm exec playwright test tests/e2e/accessibility.spec.ts --project=desktop-1440 --project=tablet-768 --project=mobile-390` exited 1. Desktop passed, but tablet and mobile failed because the test expected the hidden desktop `首页` link to receive the first Tab focus.
- GREEN: the same command exited 0: 12 passed. The test now branches on the actual viewport: desktop verifies the five primary links before search and theme; tablet/mobile verify desktop navigation is hidden, the menu button is visible, and focus advances from search to theme to menu.
- Additional regression: `corepack pnpm exec playwright test tests/e2e/accessibility.spec.ts tests/e2e/navigation-dropdown.spec.ts --project=desktop-1440 --project=tablet-768 --project=mobile-390` exited 0: 17 passed.
- Follow-up checks: `corepack pnpm test:run` exited 0 with 20 files and 291 tests; `corepack pnpm check` exited 0 with 0 Astro errors, warnings, and hints.
