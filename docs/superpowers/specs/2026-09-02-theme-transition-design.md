# Animated Theme Transition Design

## Goal

Replace the plain theme glyph with a day/night icon and add a playful full-screen transition inspired by the reference site: a sun or moon travels across a gradient sky while a CSS-drawn cat watches from the bottom edge.

## Scope

- Keep Astro's static output and the existing `hatrix-theme` storage key.
- Keep the existing light/dark tokens, first-paint theme restoration, and Giscus synchronization.
- Draw every new visual with local HTML, SVG, and CSS. Do not copy reference-site assets or add runtime dependencies.
- Use `猫咪范例.png` and `猫咪范例2.png` only as local visual references. Do not add either screenshot to the site or commit them.
- Do not change content, routes, page layouts, or deployment configuration.

## Interaction

1. The header button shows a sun in light mode and a crescent moon in dark mode.
2. Activating the button creates one transition at a time. Repeated activation while it is running is ignored.
3. A fixed overlay fades over the viewport. Its sky moves toward the destination palette, the matching celestial body travels along an arc, pauses for about 0.8 seconds at the apex, and then finishes the arc. A simple cat rises from the bottom with animated pupils.
4. The destination is stored as soon as the transition starts so client navigation can restore it. The document theme changes after the overlay covers the page, then the overlay fades out and becomes hidden again.
5. With `prefers-reduced-motion: reduce`, the theme changes immediately and the overlay remains hidden.
6. If the overlay is unavailable, theme switching falls back to the existing immediate behavior.

## Timing

- The celestial track lasts 2.6 seconds.
- The sun or moon reaches the apex at 35%, remains at the same position through 65%, and leaves during the final 35%. This produces a 0.78-second hold while keeping the ascent and descent symmetric.
- The overlay begins its exit at 2.62 seconds and is hidden and unlocked at 2.9 seconds.
- The document theme still changes only after the overlay covers the page. Reduced-motion behavior remains immediate.

## Cat Reference

- Keep the cat centered on the bottom edge, about 108px wide on desktop and 92px wide on small screens.
- Use one flat, narrow body silhouette. The two pointed ears are part of its top outline rather than separate triangles.
- Remove the rounded top corners, whiskers, and drop shadow from the current cat.
- Use `#777777` for the day body and `#444444` for the night body.
- Use `#ffee94` for the eye rims and `#ffb399` for the pupils and nose.
- In the day state, each pupil is a narrow vertical slit. In the night state, each pupil expands into a circle while leaving the yellow rim visible.

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

- The existing Playwright transition test first fails against the 1.8-second continuous arc, then verifies the 2.6-second duration and identical 35% and 65% apex keyframes.
- The same test verifies the reference cat silhouette, dimensions, colors, eye states, and removal of the old whiskers and separate ears.
- Playwright verifies the overlay lifecycle, persisted destination theme, click locking, and reduced-motion fallback.
- Playwright verifies that an immediate Astro client navigation keeps the pending destination theme and clears the old transition state.
- Existing theme navigation and Giscus tests remain green.
- Type checking, unit tests, production build, built-site validation, and the full end-to-end suite must pass.
- The two reference screenshots remain untracked working files. Existing visual baselines stay at 21 because the overlay is hidden in baseline captures.
