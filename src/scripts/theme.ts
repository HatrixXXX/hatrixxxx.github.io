const STORAGE_KEY = 'hatrix-theme';
type Theme = 'dark' | 'light';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function updateGiscusTheme(theme: Theme): void {
  document.querySelectorAll<HTMLIFrameElement>('iframe.giscus-frame').forEach((iframe) => {
    iframe.contentWindow?.postMessage({ giscus: { setConfig: { theme } } }, 'https://giscus.app');
  });
}

function applyTheme(theme: Theme): void {
  const changed = currentTheme() !== theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#161a20' : '#f7f7f9'
  );
  if (changed) updateGiscusTheme(theme);
}

function restoreTheme(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  applyTheme(stored === 'light' ? 'light' : stored === 'dark' ? 'dark' : currentTheme());
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element) || !event.target.closest('[data-theme-toggle]')) return;
  const theme: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
});

document.addEventListener('astro:after-swap', restoreTheme);
document.addEventListener('astro:page-load', restoreTheme);
restoreTheme();
