# Twikoo Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Giscus with Twikoo on articles and the guestbook while keeping the Astro site static.

**Architecture:** A shared Astro component provides the comment container and path. One client script loads Twikoo 2.0.13, initializes it after normal navigation or protected-content unlock, and reports failures. The backend is a separate Cloudflare Worker with D1 at `comments.hatrix.site`.

**Tech Stack:** Astro 7, TypeScript, CSS, Twikoo 2.0.13, Cloudflare Workers and D1.

**Spec:** `docs/superpowers/specs/2026-10-13-twikoo-comments-design.md`

## Global Constraints

- Keep the public website's output static and its Node version at 24.
- Preserve every `/posts/<legacySlug>/` route and the locked-content boundary.
- Keep existing GitHub Discussions data untouched; do not migrate it.
- Do not put Cloudflare credentials, D1 IDs or admin passwords in public files.
- Preserve unrelated uncommitted work in the shared checkout.

## Review Focus

- Client navigation must mount one Twikoo instance for the new pathname.
- Locked articles must not load comments until unlock succeeds.
- Script or backend failures must leave article content and navigation usable.
- Narrow screens must leave form controls clear of the persistent player.
- Published CSP must allow only the selected Twikoo resources and backend origin.

### Task 1: Replace the client integration

**Files:** `src/components/TwikooComments.astro`, `src/scripts/twikoo.ts`, `src/layouts/BaseLayout.astro`, `src/layouts/PostLayout.astro`, `src/pages/guestbook.astro`, `src/pages/__tests__/[slug].astro`, `src/config/site.ts`, related tests.

- [x] Add focused tests for the pathname, navigation remount, unlock gate and failure state; verify they fail against Giscus.
- [x] Add the shared container and loader with the exact Twikoo 2.0.13 script URL and SRI.
- [x] Replace Giscus imports and remove its loader and theme files.
- [x] Run the focused tests and type check.

### Task 2: Apply the site visual system and security policy

**Files:** `src/styles/twikoo.css`, `src/config/security.ts`, `scripts/check-built-site.ts`, relevant security/build tests, `DESIGN.md`, `README.md`, `PRODUCT.md`, `AGENTS.md`.

- [x] Style Twikoo's form, comments and interaction states in the existing guestbook shell and article layout.
- [x] Replace Giscus allowances with the pinned Twikoo script and exact Worker origin; update the build audit.
- [x] Update current documentation and tests without rewriting historical plans.
- [x] Verify desktop, mobile, keyboard, reduced motion, build and protected-output audit.

### Task 3: Prepare and connect the independent backend

**Files:** `docs/operations/twikoo.md` and temporary files outside the site build.

- [x] Build the official Twikoo 2.0 Cloudflare adapter separately under Node 26 and record deployment commands.
- [x] Create the Worker, D1 and custom domain after Cloudflare authentication.
- [x] Verify the Worker health endpoint, CORS from `hatrix.site`, and real comment write/read on an unused path; delete the test row and confirm D1 is empty.
- [x] Set the administrator password privately in Twikoo; publish, read, and remove a test comment on an unused path.
- [ ] Confirm the live website can load and submit comments while GitHub Discussions remains untouched.
