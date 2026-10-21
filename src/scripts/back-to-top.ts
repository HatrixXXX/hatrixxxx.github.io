import { scrollPageTo, scrollPageToBottom } from './smooth-scroll';

const SHOW_AFTER_PX = 480;
let visibilityFrame: number | undefined;

function setButtonVisibility(button: HTMLButtonElement | null, visible: boolean): void {
  if (!button || button.dataset.visible === String(visible)) return;
  if (!visible && document.activeElement === button) button.blur();
  button.inert = !visible;
  button.setAttribute('aria-hidden', String(!visible));
  button.dataset.visible = String(visible);
}

function updateBackToTopVisibility(): void {
  const topButton = document.querySelector<HTMLButtonElement>('[data-back-to-top]');
  const bottomButton = document.querySelector<HTMLButtonElement>('[data-back-to-bottom]');
  setButtonVisibility(topButton, window.scrollY > SHOW_AFTER_PX);
  if (bottomButton) {
    setButtonVisibility(bottomButton, document.documentElement.scrollHeight - window.innerHeight - window.scrollY > 2);
  }
}

function scheduleBackToTopVisibility(): void {
  if (visibilityFrame !== undefined) cancelAnimationFrame(visibilityFrame);
  visibilityFrame = requestAnimationFrame(() => {
    visibilityFrame = undefined;
    updateBackToTopVisibility();
  });
}

function initializeBackToTop(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-back-to-top], [data-back-to-bottom]')) {
    if (button.dataset.bound === 'true') continue;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      if (button.hasAttribute('data-back-to-bottom')) scrollPageToBottom();
      else scrollPageTo(0);
    });
  }

  updateBackToTopVisibility();
}

initializeBackToTop();
document.addEventListener('astro:page-load', initializeBackToTop);
document.addEventListener('hatrix:protected-content-ready', initializeBackToTop);
window.addEventListener('scroll', scheduleBackToTopVisibility, { passive: true });
window.addEventListener('resize', () => {
  if (document.querySelector('[data-back-to-bottom]')) scheduleBackToTopVisibility();
}, { passive: true });
