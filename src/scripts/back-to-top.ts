import { scrollPageTo } from './smooth-scroll';

const SHOW_AFTER_PX = 480;
let visibilityFrame: number | undefined;

function updateBackToTopVisibility(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-back-to-top]');
  if (!button) return;
  button.hidden = window.scrollY <= SHOW_AFTER_PX;
}

function scheduleBackToTopVisibility(): void {
  if (visibilityFrame !== undefined) cancelAnimationFrame(visibilityFrame);
  visibilityFrame = requestAnimationFrame(() => {
    visibilityFrame = undefined;
    updateBackToTopVisibility();
  });
}

function initializeBackToTop(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-back-to-top]');
  if (!button) return;

  if (button.dataset.bound !== 'true') {
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      scrollPageTo(0);
    });
  }

  updateBackToTopVisibility();
}

initializeBackToTop();
document.addEventListener('astro:page-load', initializeBackToTop);
window.addEventListener('scroll', scheduleBackToTopVisibility, { passive: true });
