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
3. A fixed overlay fades over the viewport. Its sky moves toward the destination palette while the sun and moon follow the measured reference-site orbit. The active body rises from the left, passes the true apex, settles near the upper-right, and remains there until the overlay disappears. A simple cat rises from the bottom with animated pupils.
4. The destination is stored as soon as the transition starts so client navigation can restore it. The document theme changes after the overlay covers the page, then the overlay fades out and becomes hidden again.
5. With `prefers-reduced-motion: reduce`, the theme changes immediately and the overlay remains hidden.
6. If the overlay is unavailable, theme switching falls back to the existing immediate behavior.

## Timing

- The reference was measured from `https://linn-ylz.com/` ShokaX `0.4.21` on 2026-09-02 in a 3832 by 2160 layout viewport.
- The orbit layer is 200% of the viewport, positioned at `left: -50%` and `top: -50%`, with its transform origin at `center bottom`. The sun and moon sit at `left: 55%` and `top: 32%` inside that layer.
- At rest, the celestial body has a top-left position of `60vw, 14vh`. The 40px sun center is `60vw + 20px, 14vh + 20px`; the 24px moon center is `60vw + 12px, 14vh + 12px`.
- The orbit completes one 360-degree rotation in 2 seconds with `cubic-bezier(0.7, 0, 0, 1)`. It reaches the true visual apex after about 1.55 seconds, settles roughly 25 to 27 pixels lower at the final resting point, and does not descend again.
- The overlay fades in for 200ms. The document theme and visible celestial body switch at 410ms. The overlay starts a 200ms fade-out at 2910ms and is hidden and unlocked at 3110ms.
- The celestial body remains motionless and fully visible for 910ms after the orbit ends. It remains at the same position during the final 200ms fade-out.
- Day-to-night and night-to-day use the same geometry and timing. Reduced-motion behavior remains immediate.

## Cat Reference

- Keep the cat centered on the bottom edge. Its width follows the reference ratio from 108px at ordinary desktop sizes to 204px at a 3840px viewport; screens up to 480px use a 92px by 118px cat.
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

- Playwright first fails against the custom 2.6-second translate path, then verifies the 2-second 360-degree orbit, target easing, measured rest position, and unchanged position through the hold.
- A fake-clock test verifies the 410ms theme switch, 2910ms fade-out start, and 3110ms hidden and unlocked state without wall-clock timing tolerance.
- The same test verifies the reference cat silhouette, dimensions, colors, eye states, and removal of the old whiskers and separate ears.
- Playwright verifies the overlay lifecycle, persisted destination theme, click locking, and reduced-motion fallback.
- Playwright verifies that an immediate Astro client navigation keeps the pending destination theme and clears the old transition state.
- Existing theme navigation and Giscus tests remain green.
- Type checking, unit tests, production build, built-site validation, and the full end-to-end suite must pass.
- The two reference screenshots remain untracked working files. The current suite has 18 visual baselines; the overlay stays hidden in baseline captures.
