# Animated Theme Transition Design

## Goal

Replace the plain theme glyph with a day/night icon and add a playful full-screen transition inspired by the reference site: a sun or moon travels across a gradient sky while a CSS-drawn cat watches from the bottom edge.

## Scope

- Keep Astro's static output and the existing `hatrix-theme` storage key.
- Keep the existing light/dark tokens, first-paint theme restoration, and Giscus synchronization.
- Draw every new visual with local HTML, SVG, and CSS. Do not copy reference-site assets or add runtime dependencies.
- Do not change content, routes, page layouts, or deployment configuration.

## Interaction

1. The header button shows a sun in light mode and a crescent moon in dark mode.
2. Activating the button creates one transition at a time. Repeated activation while it is running is ignored.
3. A fixed overlay fades over the viewport. Its sky moves toward the destination palette, the matching celestial body travels along an arc, and a simple cat rises from the bottom with animated pupils.
4. The destination is stored as soon as the transition starts so client navigation can restore it. The document theme changes after the overlay covers the page, then the overlay fades out and becomes hidden again.
5. With `prefers-reduced-motion: reduce`, the theme changes immediately and the overlay remains hidden.
6. If the overlay is unavailable, theme switching falls back to the existing immediate behavior.

## Architecture

- `src/components/ThemeTransition.astro` owns only the decorative overlay markup and scoped CSS.
- `src/components/SiteHeader.astro` owns the accessible button and its two inline SVG icons.
- `src/layouts/BaseLayout.astro` renders one overlay for every page.
- `src/scripts/theme.ts` remains the single owner of theme state, storage, Giscus updates, transition locking, and reduced-motion behavior.

## Accessibility and Performance

- The overlay is `aria-hidden`, contains no focusable controls, and blocks pointer input only while active.
- The existing 44px button target and `切换主题` accessible name remain unchanged.
- The button exposes the current state with `aria-pressed` and is temporarily disabled during the transition.
- Reduced-motion users receive an immediate state change without decorative movement.
- The animation uses only transforms, opacity, gradients, and small CSS shapes; it adds no image requests or JavaScript animation loop.

## Verification

- Playwright verifies the overlay lifecycle, persisted destination theme, click locking, and reduced-motion fallback.
- Playwright verifies that an immediate Astro client navigation keeps the pending destination theme and clears the old transition state.
- Existing theme navigation and Giscus tests remain green.
- Type checking, unit tests, production build, built-site validation, and the full end-to-end suite must pass.
- Visual baselines are updated only if the new header icon produces intentional diffs after the overlay is gone.
