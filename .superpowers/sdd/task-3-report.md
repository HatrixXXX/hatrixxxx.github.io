# Task 3 Report: Static Cards and Page Layout

Date: 2026-09-04

## Outcome

Implemented the contextual sidebar as a shared, static three-card stack. The stack is present only on published article and About routes, in this direct-child order:

1. profile card (`data-profile-card`)
2. site statistics (`data-site-stats`)
3. music player (`data-music-player`)

Home, paginated article lists, the blog index, and archives no longer render either the contextual stack or the player. No Task 4 timers, visitor loading, clock animation, or particles were added.

## TDD Evidence

### RED

Command:

```powershell
corepack pnpm playwright test tests/e2e/home.spec.ts tests/e2e/post.spec.ts tests/e2e/about-guestbook.spec.ts tests/e2e/index-pages.spec.ts tests/e2e/interactions.spec.ts --project=desktop-1440
```

Result: **9 failed, 40 passed (49 total)**.

The task-specific failures were the expected ones:

- `about and article routes render the ordered contextual sidebar stack`: no `data-sidebar-stack` existed.
- `about sidebar exposes the requested profile, social links and static statistics`: no new profile card existed.
- `home and paginated routes omit contextual sidebar cards`: the old global player still existed.
- `blog and archive indexes omit contextual sidebar cards`: the old global player still existed.
- `post layout places the sidebar, article and TOC in responsive reading order`: no stack existed for the geometry probe.

Four pre-existing checks also failed because Playwright reused an already-running stale service on the default port: the locked-route fixtures were missing, PhotoSwipe CSS was already loaded, and the Giscus theme was a production URL. These failures were unrelated to the working-tree test changes. The later isolated-port run started a clean Astro dev server and all four passed unchanged.

### GREEN

The default Playwright port was occupied by a stale service, so the same focused command was run with an isolated server port:

```powershell
$env:PLAYWRIGHT_PORT='4333'
corepack pnpm playwright test tests/e2e/home.spec.ts tests/e2e/post.spec.ts tests/e2e/about-guestbook.spec.ts tests/e2e/index-pages.spec.ts tests/e2e/interactions.spec.ts --project=desktop-1440
```

Result: **49 passed (49 total), 1.1 minutes**.

This run covered route inclusion/exclusion, direct-child card order, all eight social controls and their navigation behavior, desktop/mobile article geometry, TOC behavior, Giscus navigation behavior, the empty player, and player node persistence across an adjacent-article navigation.

### Full unit suite

Command:

```powershell
corepack pnpm test:run
```

Result: **20 test files passed; 288 tests passed; 0 failed**.

### Astro diagnostics

Command:

```powershell
corepack pnpm check
```

Result: **123 files checked; 0 errors; 0 warnings; 2 hints**. The two hints are existing Vitest `toThrowError` deprecation hints in the Task 1 and Task 2 unit tests.

## Files Changed

Production:

- `src/config/site.ts`: replaced the social configuration with the requested eight entries and colors.
- `src/components/SocialIcon.astro`: added local inline SVG artwork for every social entry.
- `src/components/ProfileSidebar.astro`: removed the post-count prop and added the title, tagline, icon grid, external-link behavior, and pending WeChat control.
- `src/components/SiteStats.astro`: added static post/word/day/visitor/update/clock rendering and the clock canvas.
- `src/components/SidebarStack.astro`: added the shared ordered stack and the 1280px by 760px sticky gate.
- `src/components/MusicPlayer.astro`: converted the player from fixed viewport UI to a card-sized grid.
- `src/layouts/BaseLayout.astro`: removed the global player instance.
- `src/layouts/PostLayout.astro`: queried published posts, mounted the stack, and introduced the mobile-first/1280px three-column layout capped at 1440px.
- `src/components/TableOfContents.astro`: moved the desktop TOC to column 3 at the 1280px breakpoint and retained the collapsible mobile TOC below it.
- `src/pages/about.astro`: mounted the stack after the introduction in DOM order and removed duplicated avatar/social UI.
- `src/pages/about/[section].astro`: retained each empty state and mounted the stack after its content.
- `src/pages/index.astro`: removed the old profile sidebar and its layout CSS.
- `src/pages/page/[page].astro`: removed the old profile sidebar and the unused full-posts static-path prop.
- `src/pages/archives/index.astro`: removed the old profile sidebar and its layout CSS.

Tests:

- `tests/e2e/home.spec.ts`
- `tests/e2e/post.spec.ts`
- `tests/e2e/about-guestbook.spec.ts`
- `tests/e2e/index-pages.spec.ts`
- `tests/e2e/interactions.spec.ts`

## Self-Review

- Confirmed the only component-level `ProfileSidebar` and `MusicPlayer` mounts now originate from `SidebarStack`.
- Confirmed `BaseLayout` retains the existing player initializer but no longer renders a player on routes without a stack; the initializer safely returns when the node is absent.
- Confirmed article DOM order is TOC, article column, then stack, while desktop CSS maps them to columns 3, 2, and 1 respectively.
- Confirmed both About routes keep content before the stack in DOM order and reverse only the visual wide-layout columns.
- Confirmed stack stickiness is gated by both `min-width: 1280px` and `min-height: 760px`.
- Confirmed external HTTP social links receive `target="_blank" rel="me noreferrer"`; RSS and email remain native same-tab/scheme navigation; pending WeChat is a non-focusable span.
- Confirmed `SiteStats` uses the Task 1 helpers and initializes the visible clock with `formatClockTime(new Date())` without client updates.
- Confirmed no dependency, article body, playlist data, generated directory, security policy, or Task 4 runtime behavior changed.
- Independent read-only review found no Critical issues. Its initial concern about expecting two `Audio` instances was withdrawn after confirming those two data-URI instances are Sakana effects; the exact count and URI-prefix assertions still reject any added playlist audio.

## Concerns and Follow-up

- Port 4322 was occupied during verification and caused Playwright to reuse stale page output. The authoritative GREEN result is the clean isolated-port run on 4333.
- The static canvas and visitor fallback are intentionally inert. Their runtime updates belong to Task 4.
- The two Astro-check hints are outside Task 3 ownership and do not affect compilation.
