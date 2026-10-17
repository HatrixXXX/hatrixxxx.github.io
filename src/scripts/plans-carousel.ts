const selector = '[data-plans-carousel]';

function bindPlansCarousel(viewport: HTMLElement) {
  if (viewport.dataset.bound) return;
  viewport.dataset.bound = 'true';
  const track = viewport.querySelector<HTMLElement>('[data-plans-track]');
  if (!track) return;

  let offset = 0;
  let startX = 0;
  let startOffset = 0;
  let pointerId: number | null = null;
  let dragged = false;
  let suppressClick = false;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const visualScale = () => viewport.getBoundingClientRect().width / viewport.offsetWidth || 1;
  const maxOffset = () => Math.max(0, track.scrollWidth - track.clientWidth);
  const clamp = (value: number) => Math.min(maxOffset(), Math.max(0, value));
  const paint = () => { track.style.transform = `translate3d(${-offset}px, 0, 0)`; };
  const settle = () => {
    viewport.toggleAttribute('data-settling', !reducedMotion.matches);
    offset = clamp(offset);
    paint();
  };
  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startOffset = offset;
    dragged = false;
    viewport.removeAttribute('data-settling');
  });

  viewport.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    const distance = (event.clientX - startX) / visualScale();
    if (!dragged && Math.abs(distance) < 6) return;
    if (!dragged) {
      dragged = true;
      viewport.setPointerCapture(event.pointerId);
    }
    offset = clamp(startOffset - distance);
    paint();
  });

  const endPointer = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    if (dragged) {
      suppressClick = true;
      window.setTimeout(() => { suppressClick = false; }, 0);
    }
    settle();
  };
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('click', (event) => {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); }
  }, true);

  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const next = clamp(offset + delta / visualScale());
    if (next === offset) return;
    viewport.toggleAttribute('data-settling', !reducedMotion.matches);
    offset = next;
    paint();
  }, { passive: false });

  viewport.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const firstCard = track.querySelector<HTMLElement>('[data-plan-card]');
    const step = (firstCard?.offsetWidth ?? 240) + parseFloat(getComputedStyle(track).gap || '0');
    const next = clamp(offset + direction * step);
    if (next === offset) return;
    viewport.toggleAttribute('data-settling', !reducedMotion.matches);
    offset = next;
    paint();
  });

  window.addEventListener('resize', settle);
  document.addEventListener('astro:before-swap', () => window.removeEventListener('resize', settle), { once: true });
  requestAnimationFrame(() => viewport.dataset.ready = '');
}

const init = () => document.querySelectorAll<HTMLElement>(selector).forEach(bindPlansCarousel);
document.addEventListener('astro:page-load', init);
document.addEventListener('hatrix:protected-content-ready', init);
init();
