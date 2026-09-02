const STORAGE_KEY = 'hatrix-theme';
type Theme = 'dark' | 'light';

const THEME_APPLY_DELAY_MS = 410;
const THEME_LEAVE_DELAY_MS = 2_910;
const THEME_TRANSITION_END_MS = 3_110;
let transitionLocked = false;
let transitionTimers: number[] = [];

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function updateGiscusTheme(theme: Theme): void {
  document.querySelectorAll<HTMLIFrameElement>('iframe.giscus-frame').forEach((iframe) => {
    iframe.contentWindow?.postMessage({ giscus: { setConfig: { theme } } }, 'https://giscus.app');
  });
}

function themeToggles(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]'));
}

function syncThemeToggles(theme: Theme): void {
  themeToggles().forEach((toggle) => {
    toggle.disabled = transitionLocked;
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  });
}

function applyTheme(theme: Theme): void {
  const changed = currentTheme() !== theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#161a20' : '#f7f7f9'
  );
  syncThemeToggles(theme);
  if (changed) updateGiscusTheme(theme);
}

function restoreTheme(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  applyTheme(stored === 'light' ? 'light' : stored === 'dark' ? 'dark' : currentTheme());
}

function storeAndApplyTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

function setTransitionLocked(locked: boolean): void {
  transitionLocked = locked;
  syncThemeToggles(currentTheme());
}

function scheduleTransitionStep(callback: () => void, delay: number): void {
  transitionTimers.push(window.setTimeout(callback, delay));
}

function finishThemeTransition(
  overlay = document.querySelector<HTMLElement>('[data-theme-transition]')
): void {
  transitionTimers.forEach((timer) => window.clearTimeout(timer));
  transitionTimers = [];

  if (overlay) {
    overlay.hidden = true;
    overlay.classList.remove('is-active', 'is-leaving');
    overlay.dataset.fromTheme = '';
    overlay.dataset.toTheme = '';
  }

  setTransitionLocked(false);
}

function runThemeTransition(theme: Theme): void {
  const overlay = document.querySelector<HTMLElement>('[data-theme-transition]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!overlay || reduceMotion) {
    storeAndApplyTheme(theme);
    return;
  }

  const fromTheme = currentTheme();
  localStorage.setItem(STORAGE_KEY, theme);
  setTransitionLocked(true);
  overlay.dataset.fromTheme = fromTheme;
  overlay.dataset.toTheme = theme;
  overlay.classList.remove('is-active', 'is-leaving');
  overlay.hidden = false;
  void overlay.offsetWidth;
  overlay.classList.add('is-active');

  scheduleTransitionStep(() => applyTheme(theme), THEME_APPLY_DELAY_MS);
  scheduleTransitionStep(() => overlay.classList.add('is-leaving'), THEME_LEAVE_DELAY_MS);
  scheduleTransitionStep(() => finishThemeTransition(overlay), THEME_TRANSITION_END_MS);
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element) || !event.target.closest('[data-theme-toggle]')) return;
  if (transitionLocked) return;
  const theme: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  runThemeTransition(theme);
});

document.addEventListener('astro:after-swap', () => {
  if (transitionLocked) finishThemeTransition();
  restoreTheme();
});
document.addEventListener('astro:page-load', restoreTheme);
restoreTheme();
