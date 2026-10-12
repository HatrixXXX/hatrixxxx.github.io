const CAT_SKY_DELAY_MS = 410;
const CAT_LEAVE_DELAY_MS = 2_910;
const CAT_ANIMATION_END_MS = 3_110;
const CAT_REDUCED_MOTION_END_MS = 800;
type Sky = 'day' | 'night';

let animationLocked = false;
let animationTimers: number[] = [];
let nextSky: Sky = 'day';

function syncTrigger(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-cat-animation-trigger]').forEach((button) => {
    button.disabled = animationLocked;
  });
}

function finishCatAnimation(): void {
  animationTimers.forEach((timer) => window.clearTimeout(timer));
  animationTimers = [];

  const overlay = document.querySelector<HTMLElement>('[data-cat-animation]');
  if (overlay) {
    overlay.hidden = true;
    overlay.classList.remove('is-active', 'is-leaving', 'is-static');
    overlay.dataset.fromSky = '';
    overlay.dataset.toSky = '';
    overlay.dataset.visibleSky = '';
  }

  animationLocked = false;
  syncTrigger();
}

function playCatAnimation(): void {
  const overlay = document.querySelector<HTMLElement>('[data-cat-animation]');
  if (!overlay) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toSky = nextSky;
  const fromSky: Sky = toSky === 'day' ? 'night' : 'day';
  nextSky = fromSky;
  animationLocked = true;
  syncTrigger();
  overlay.classList.remove('is-active', 'is-leaving', 'is-static');
  overlay.dataset.fromSky = fromSky;
  overlay.dataset.toSky = toSky;
  overlay.dataset.visibleSky = reduceMotion ? toSky : fromSky;
  overlay.hidden = false;
  void overlay.offsetWidth;
  overlay.classList.add(reduceMotion ? 'is-static' : 'is-active');

  if (!reduceMotion) {
    animationTimers.push(window.setTimeout(() => { overlay.dataset.visibleSky = toSky; }, CAT_SKY_DELAY_MS));
    animationTimers.push(window.setTimeout(() => overlay.classList.add('is-leaving'), CAT_LEAVE_DELAY_MS));
  }
  animationTimers.push(window.setTimeout(finishCatAnimation, reduceMotion ? CAT_REDUCED_MOTION_END_MS : CAT_ANIMATION_END_MS));
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element) || !event.target.closest('[data-cat-animation-trigger]')) return;
  if (animationLocked) return;
  playCatAnimation();
});

document.addEventListener('astro:after-swap', () => {
  if (animationLocked) finishCatAnimation();
});
