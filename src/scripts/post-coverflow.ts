// Coverflow carousel for post list
// - Active card faces forward (rotateY 0), neighbours fold inward
// - Mouse wheel over the rail scrolls through cards with spring damping
// - First card starts active; last card can be active with right-side whitespace

const RAIL_SELECTOR = '[data-post-coverflow]';

// Spring constants
const SPRING_STIFFNESS = 260;   // how snappy the spring is
const SPRING_DAMPING   = 28;    // critical damping avoids overshoot
const SETTLE_EPS       = 0.005; // index units below which we consider settled

// Coverflow visual parameters
const SIDE_ROTATE_DEG  = 48;    // how much each non-active card rotates
const SIDE_TRANSLATE_Z = -120;  // px push-back for non-active cards
const SIDE_SCALE       = 0.82;  // scale of non-active cards
const ACTIVE_SCALE     = 1.0;
const CARD_GAP_FACTOR  = 0.62;  // fraction of card width used as step offset

interface CoverflowState {
  // current animated index (fractional during animation)
  current: number;
  // integer target index
  target: number;
  velocity: number;
  raf: number | null;
  lastTime: number | null;
  wheelAccum: number;   // accumulated wheel delta for threshold-based stepping
  reducedMotion: boolean;
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
      reducedMotion: reducedMotionMq.matches
    };
    railStates.set(rail, s);
  }
  s.reducedMotion = reducedMotionMq.matches;
  return s;
}

function applyTransforms(rail: HTMLElement, currentIndex: number): void {
  const cards = getCards(rail);
  const cardCount = cards.length;
  if (cardCount === 0) return;

  // Use the actual rendered card width for offset calculation
  const cardWidth = cards[0]?.offsetWidth ?? 280;
  const step = cardWidth * CARD_GAP_FACTOR;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const offset = i - currentIndex;          // signed distance from active
    const absOffset = Math.abs(offset);
    const sign = offset >= 0 ? 1 : -1;

    // Rotation: 0 at active, SIDE_ROTATE_DEG asymptotic for far cards
    const rotateY = sign * Math.min(absOffset * SIDE_ROTATE_DEG, SIDE_ROTATE_DEG);

    // Z translation: push back non-active cards
    const translateZ = absOffset === 0
      ? 0
      : SIDE_TRANSLATE_Z * Math.min(absOffset, 1);

    // Lateral translation: cards fan out from centre
    const translateX = offset * step;

    // Scale
    const scaleFactor = absOffset === 0
      ? ACTIVE_SCALE
      : SIDE_SCALE + (1 - SIDE_SCALE) * Math.max(0, 1 - absOffset);

    // Opacity: distant cards fade slightly
    const opacity = absOffset > 2 ? Math.max(0.25, 1 - (absOffset - 2) * 0.35) : 1;

    card.style.transform = `translateX(${translateX.toFixed(2)}px) translateZ(${translateZ.toFixed(2)}px) rotateY(${rotateY.toFixed(2)}deg) scale(${scaleFactor.toFixed(4)})`;
    card.style.opacity = String(opacity.toFixed(3));
    card.style.zIndex = String(Math.round(100 - absOffset * 10));
    card.setAttribute('data-active', absOffset < 0.5 ? 'true' : 'false');
  }
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

    // Spring integration (semi-implicit Euler)
    const error = state.target - state.current;
    const force = SPRING_STIFFNESS * error - SPRING_DAMPING * state.velocity;
    state.velocity += force * dt;
    state.current += state.velocity * dt;

    // Clamp to valid range
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

// ─── Wheel handling ──────────────────────────────────────────────────────────
// Accumulate wheel delta and step when threshold crossed; gives a natural
// "one-card-per-notch" feel on clicky wheels and smooth feel on trackpads.
const WHEEL_STEP_THRESHOLD = 60; // px accumulated before stepping

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

  state.wheelAccum += normalized;

  const steps = Math.trunc(state.wheelAccum / WHEEL_STEP_THRESHOLD);
  if (steps !== 0) {
    state.wheelAccum -= steps * WHEEL_STEP_THRESHOLD;
    navigateTo(rail, state.target + steps);
  }
}, { passive: false });

// ─── Keyboard navigation ─────────────────────────────────────────────────────
document.addEventListener('keydown', (event: KeyboardEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  const rail = target?.closest<HTMLElement>(RAIL_SELECTOR) ?? null;
  if (!rail) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    const state = stateFor(rail);
    navigateTo(rail, state.target + 1);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    const state = stateFor(rail);
    navigateTo(rail, state.target - 1);
  }
});

// ─── Click on a non-active card → navigate to it ─────────────────────────────
document.addEventListener('click', (event: MouseEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  const card = target?.closest<HTMLElement>('[data-post-card]') ?? null;
  if (!card) return;
  if (card.getAttribute('data-active') === 'true') return;
  const rail = card.closest<HTMLElement>(RAIL_SELECTOR);
  if (!rail) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const cards = getCards(rail);
  const index = cards.indexOf(card);
  if (index !== -1) navigateTo(rail, index);
}, true);

// ─── Touch swipe ─────────────────────────────────────────────────────────────
interface TouchSwipeState {
  rail: HTMLElement;
  startX: number;
  startTarget: number;
  moved: boolean;
}
let touchSwipe: TouchSwipeState | null = null;
const SWIPE_THRESHOLD = 40; // px to count as intentional swipe

document.addEventListener('touchstart', (event: TouchEvent) => {
  const t = event.target instanceof Element ? event.target : null;
  const rail = t?.closest<HTMLElement>(RAIL_SELECTOR) ?? null;
  if (!rail || event.touches.length !== 1) return;
  const state = stateFor(rail);
  touchSwipe = { rail, startX: event.touches[0].clientX, startTarget: state.target, moved: false };
}, { passive: true });

document.addEventListener('touchmove', (event: TouchEvent) => {
  if (!touchSwipe) return;
  const dx = touchSwipe.startX - event.touches[0].clientX;
  if (!touchSwipe.moved && Math.abs(dx) > 8) touchSwipe.moved = true;
  if (touchSwipe.moved) {
    const steps = Math.round(dx / SWIPE_THRESHOLD);
    navigateTo(touchSwipe.rail, touchSwipe.startTarget + steps);
  }
}, { passive: true });

document.addEventListener('touchend', () => { touchSwipe = null; });
document.addEventListener('touchcancel', () => { touchSwipe = null; });

// ─── Init ────────────────────────────────────────────────────────────────────
function initRail(rail: HTMLElement): void {
  const state = stateFor(rail);
  state.current = 0;
  state.target = 0;
  state.velocity = 0;
  state.wheelAccum = 0;
  // Initial layout pass (synchronous, no animation)
  applyTransforms(rail, 0);
}

function initAllRails(): void {
  document.querySelectorAll<HTMLElement>(RAIL_SELECTOR).forEach(initRail);
}

document.addEventListener('astro:page-load', initAllRails);
initAllRails();

reducedMotionMq.addEventListener('change', () => {
  document.querySelectorAll<HTMLElement>(RAIL_SELECTOR).forEach((rail) => {
    const s = railStates.get(rail);
    if (!s) return;
    s.reducedMotion = reducedMotionMq.matches;
    if (reducedMotionMq.matches) {
      cancelRaf(s);
      s.current = s.target;
      applyTransforms(rail, s.current);
    }
  });
});
