// Coverflow carousel for post list
// - Cards stay aligned with the straight guide rails as they move vertically
// - Mouse wheel over the rail scrolls through cards with spring damping
// - First card starts active; last card can be active with lower whitespace

import { animate } from 'animejs';

const RAIL_SELECTOR = '[data-post-coverflow]';
const INDEX_KEY = 'blog-coverflow-index';
const FROM_POST_KEY = 'blog-coverflow-from-post';

// Spring constants
const SPRING_STIFFNESS = 260;
const SPRING_DAMPING   = 28;
const SETTLE_EPS       = 0.005; // index units below which we consider settled

// Coverflow visual parameters
const CARD_GAP_FACTOR  = 1.2;   // card height plus a wider visible gap

interface CoverflowState {
  current: number;
  target: number;
  velocity: number;
  raf: number | null;
  lastTime: number | null;
  wheelAccum: number;
  reducedMotion: boolean;
  dockedCard: HTMLElement | null;
  dockPulse: ReturnType<typeof animate> | null;
}

const railStates = new WeakMap<HTMLElement, CoverflowState>();
const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

function getCards(rail: HTMLElement): HTMLElement[] {
  return Array.from(rail.querySelectorAll<HTMLElement>('[data-post-card]'));
}

function stateFor(rail: HTMLElement): CoverflowState {
  let s = railStates.get(rail);
  if (!s) {
    s = {
      current: 0,
      target: 0,
      velocity: 0,
      raf: null,
      lastTime: null,
      wheelAccum: 0,
      reducedMotion: reducedMotionMq.matches,
      dockedCard: null,
      dockPulse: null
    };
    railStates.set(rail, s);
  }
  s.reducedMotion = reducedMotionMq.matches;
  return s;
}

function clearDockPulse(state: CoverflowState): void {
  state.dockPulse?.cancel();
  state.dockPulse = null;
  state.dockedCard?.style.removeProperty('--dock-light');
}

function updateDock(rail: HTMLElement, card: HTMLElement): void {
  const state = stateFor(rail);
  if (state.dockedCard === card) return;
  clearDockPulse(state);
  state.dockedCard = card;
  if (state.reducedMotion || document.hidden) return;

  card.style.setProperty('--dock-light', '1');
  state.dockPulse = animate(card, {
    '--dock-light': 0,
    duration: 460,
    ease: 'outCubic',
    onComplete: () => {
      card.style.removeProperty('--dock-light');
      state.dockPulse = null;
    }
  });
}

function applyTransforms(rail: HTMLElement, currentIndex: number): void {
  const cards = getCards(rail);
  const cardCount = cards.length;
  if (cardCount === 0) return;

  const cardHeight = cards[0]?.offsetHeight ?? 360;
  const step = cardHeight * CARD_GAP_FACTOR;
  const edgeShift = -Math.max(0, 1 - currentIndex) * step * 0.5
    + Math.max(0, currentIndex - (cardCount - 2)) * step * 0.5;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const offset = i - currentIndex;
    const absOffset = Math.abs(offset);

    const translateY = offset * step + edgeShift;
    const opacity = Math.max(0.18, 0.62 ** absOffset);

    card.style.transform = `translateY(${translateY.toFixed(2)}px)`;
    card.style.opacity = String(opacity.toFixed(3));
    card.style.zIndex = String(Math.round(100 - absOffset * 10));
    const centerProximity = Number(Math.max(0, 1 - absOffset).toFixed(3));
    card.style.setProperty('--center-proximity', String(centerProximity));
    card.toggleAttribute('data-near-center', centerProximity > 0);
    card.setAttribute('data-active', absOffset < 0.5 ? 'true' : 'false');
    card.inert = false;
    const titleLink = card.querySelector<HTMLAnchorElement>('h2 a');
    const tabIndex = absOffset > 1.5 ? -1 : 0;
    if (titleLink && titleLink.tabIndex !== tabIndex) titleLink.tabIndex = tabIndex;
  }
  const active = cards[Math.max(0, Math.min(cardCount - 1, Math.round(currentIndex)))];
  if (active) updateDock(rail, active);
}

function cancelRaf(state: CoverflowState): void {
  if (state.raf !== null) {
    cancelAnimationFrame(state.raf);
    state.raf = null;
    state.lastTime = null;
  }
}

function scheduleFrame(rail: HTMLElement): void {
  const state = stateFor(rail);
  if (state.raf !== null) return;

  const step = (time: number): void => {
    state.raf = null;
    const cardCount = getCards(rail).length;
    const maxIndex = Math.max(0, cardCount - 1);

    if (state.reducedMotion) {
      state.current = Math.round(state.target);
      state.velocity = 0;
      applyTransforms(rail, state.current);
      return;
    }

    const dt = Math.min(state.lastTime === null ? 16 : time - state.lastTime, 50) / 1000;
    state.lastTime = time;

    const error = state.target - state.current;
    const force = SPRING_STIFFNESS * error - SPRING_DAMPING * state.velocity;
    state.velocity += force * dt;
    state.current += state.velocity * dt;
    state.current = Math.max(0, Math.min(maxIndex, state.current));

    applyTransforms(rail, state.current);

    const settled =
      Math.abs(state.target - state.current) < SETTLE_EPS &&
      Math.abs(state.velocity) < SETTLE_EPS;

    if (settled) {
      state.current = state.target;
      state.velocity = 0;
      state.lastTime = null;
      applyTransforms(rail, state.current);
    } else {
      state.raf = requestAnimationFrame(step);
    }
  };

  state.raf = requestAnimationFrame(step);
}

function navigateTo(rail: HTMLElement, index: number): void {
  const state = stateFor(rail);
  const cardCount = getCards(rail).length;
  const clamped = Math.max(0, Math.min(cardCount - 1, index));
  if (state.target === clamped) return;
  state.target = clamped;
  scheduleFrame(rail);
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function ssGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function ssSet(key: string, value: string): void {
  try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
}

function ssDel(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}

// ─── Track navigation intent via Astro View Transitions events ───────────────
// astro:before-preparation fires before each client-side navigation and exposes
// reliable from/to URLs — unlike document.referrer which only updates on full
// page loads and is therefore useless in a SPA-style router.

document.addEventListener('astro:before-preparation', (e) => {
  const event = e as unknown as { from: URL; to: URL };
  const fromPath = event.from.pathname;
  const toPath   = event.to.pathname;

  const isBlogList = (p: string) => p === '/blogs/';

  if (isBlogList(fromPath) && toPath.startsWith('/posts/')) {
    // Leaving the blog list → entering a post: persist the current index.
    const rail = document.querySelector<HTMLElement>(RAIL_SELECTOR);
    if (rail) ssSet(INDEX_KEY, String(stateFor(rail).target));
    ssSet(FROM_POST_KEY, '1');
  } else if (isBlogList(toPath)) {
    if (fromPath.startsWith('/posts/')) {
      // Returning from a post → restore the saved index.
      ssSet(FROM_POST_KEY, '1');
    } else {
      // Arriving from nav, home, or any other origin → reset to card 0.
      ssDel(INDEX_KEY);
      ssDel(FROM_POST_KEY);
    }
  }
});

// ─── Wheel handling ───────────────────────────────────────────────────────────
const WHEEL_STEP_THRESHOLD = 60;

document.addEventListener('wheel', (event: WheelEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  const rail = target?.closest<HTMLElement>(RAIL_SELECTOR) ?? null;
  if (!rail) return;

  event.preventDefault();

  const state = stateFor(rail);
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  const normalized = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? delta * 24
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? delta * 300
    : delta;

  if (normalized !== 0 && state.wheelAccum !== 0 && Math.sign(normalized) !== Math.sign(state.wheelAccum)) {
    state.wheelAccum = 0;
  }
  state.wheelAccum += normalized;

  const steps = Math.trunc(state.wheelAccum / WHEEL_STEP_THRESHOLD);
  if (steps !== 0) {
    state.wheelAccum -= steps * WHEEL_STEP_THRESHOLD;
    navigateTo(rail, state.target + Math.sign(steps));
  }
}, { passive: false });

// ─── Keyboard navigation ──────────────────────────────────────────────────────
document.addEventListener('keydown', (event: KeyboardEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  const rail = target?.closest<HTMLElement>(RAIL_SELECTOR) ?? null;
  if (!rail) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    navigateTo(rail, stateFor(rail).target + 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    navigateTo(rail, stateFor(rail).target - 1);
  }
});

// ─── Click on a non-active card → navigate to it ─────────────────────────────
document.addEventListener('click', (event: MouseEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  const card = target?.closest<HTMLElement>('[data-post-card]') ?? null;
  if (!card) return;
  if (card.getAttribute('data-active') === 'true') {
    if (!target?.closest('a')) card.querySelector<HTMLAnchorElement>('h2 a')?.click();
    return;
  }
  const rail = card.closest<HTMLElement>(RAIL_SELECTOR);
  if (!rail) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const cards = getCards(rail);
  const index = cards.indexOf(card);
  if (index !== -1) navigateTo(rail, index);
}, true);

// ─── Touch swipe ──────────────────────────────────────────────────────────────
interface TouchSwipeState {
  rail: HTMLElement;
  startY: number;
  startTarget: number;
}
let touchSwipe: TouchSwipeState | null = null;
const SWIPE_THRESHOLD = 40;

document.addEventListener('touchstart', (event: TouchEvent) => {
  const t = event.target instanceof Element ? event.target : null;
  const rail = t?.closest<HTMLElement>(RAIL_SELECTOR) ?? null;
  if (!rail || event.touches.length !== 1) return;
  touchSwipe = { rail, startY: event.touches[0].clientY, startTarget: stateFor(rail).target };
}, { passive: true });

document.addEventListener('touchmove', (event: TouchEvent) => {
  if (!touchSwipe) return;
  const dy = touchSwipe.startY - event.touches[0].clientY;
  if (Math.abs(dy) >= SWIPE_THRESHOLD) navigateTo(touchSwipe.rail, touchSwipe.startTarget + Math.sign(dy));
}, { passive: true });

document.addEventListener('touchend', () => { touchSwipe = null; });
document.addEventListener('touchcancel', () => { touchSwipe = null; });

// ─── Init ─────────────────────────────────────────────────────────────────────
function initRail(rail: HTMLElement): void {
  const state = stateFor(rail);
  const cards = getCards(rail);

  const fromPost = ssGet(FROM_POST_KEY) === '1';
  const rawIndex = ssGet(INDEX_KEY);
  const parsedIndex = rawIndex !== null ? parseInt(rawIndex, 10) : NaN;
  const startIndex = (fromPost && Number.isFinite(parsedIndex) && parsedIndex >= 0)
    ? Math.min(parsedIndex, Math.max(0, cards.length - 1))
    : 0;

  // Consume the flag so a subsequent non-post navigation resets to card 0.
  ssDel(FROM_POST_KEY);

  state.current = startIndex;
  state.target  = startIndex;
  state.velocity = 0;
  state.wheelAccum = 0;
  clearDockPulse(state);
  state.dockedCard = cards[startIndex] ?? null;
  applyTransforms(rail, startIndex);
}

function initAllRails(): void {
  document.querySelectorAll<HTMLElement>(RAIL_SELECTOR).forEach(initRail);
}

document.addEventListener('astro:page-load', initAllRails);
document.addEventListener('astro:before-swap', () => {
  document.querySelectorAll<HTMLElement>(RAIL_SELECTOR).forEach((rail) => {
    const state = railStates.get(rail);
    if (!state) return;
    cancelRaf(state);
    clearDockPulse(state);
  });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  document.querySelectorAll<HTMLElement>(RAIL_SELECTOR).forEach((rail) => {
    const state = railStates.get(rail);
    if (state) clearDockPulse(state);
  });
});
initAllRails();

window.addEventListener('resize', () => {
  document.querySelectorAll<HTMLElement>(RAIL_SELECTOR).forEach((rail) => {
    applyTransforms(rail, stateFor(rail).current);
  });
});

reducedMotionMq.addEventListener('change', () => {
  document.querySelectorAll<HTMLElement>(RAIL_SELECTOR).forEach((rail) => {
    const s = railStates.get(rail);
    if (!s) return;
    s.reducedMotion = reducedMotionMq.matches;
    if (reducedMotionMq.matches) {
      cancelRaf(s);
      clearDockPulse(s);
      s.current = s.target;
      applyTransforms(rail, s.current);
    }
  });
});
