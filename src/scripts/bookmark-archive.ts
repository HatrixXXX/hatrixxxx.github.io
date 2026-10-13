export {};

import { scrollPageTo } from '@/scripts/smooth-scroll';

function bindBookmarkArchive(): void {
  const consoleElement = document.querySelector<HTMLElement>('[data-bookmark-console]:not([data-bound])');
  const shelf = consoleElement?.querySelector<HTMLElement>('[data-bookmark-shelf]');
  const dialog = consoleElement?.querySelector<HTMLDialogElement>('[data-bookmark-dialog]');
  if (!consoleElement || !shelf || !dialog) return;
  const activeDialog = dialog;

  consoleElement.dataset.bound = '';
  const files = Array.from(shelf.querySelectorAll<HTMLButtonElement>('[data-bookmark-file]'));
  const current = consoleElement.querySelector<HTMLElement>('[data-bookmark-current]');
  let selected = files[0];
  let opener: HTMLButtonElement | null = null;

  function select(file: HTMLButtonElement, focus = false): void {
    if (selected !== file) selected?.removeAttribute('data-selected');
    selected = file;
    file.dataset.selected = '';
    files.forEach((item) => { item.tabIndex = item === file ? 0 : -1; });
    if (current) current.textContent = file.dataset.title ?? '';
    if (focus) {
      file.focus({ preventScroll: true });
      const bounds = file.getBoundingClientRect();
      if (bounds.top < 70 || bounds.bottom > window.innerHeight - 24) scrollPageTo(file, 'center');
    }
  }

  function open(file: HTMLButtonElement): void {
    if (activeDialog.open) return;
    select(file);
    opener = file;
    const title = activeDialog.querySelector<HTMLElement>('[data-bookmark-title]');
    const category = activeDialog.querySelector<HTMLElement>('[data-bookmark-category]');
    const description = activeDialog.querySelector<HTMLElement>('[data-bookmark-description]');
    const url = activeDialog.querySelector<HTMLElement>('[data-bookmark-url]');
    const monogram = activeDialog.querySelector<HTMLElement>('[data-bookmark-monogram]');
    const visit = activeDialog.querySelector<HTMLAnchorElement>('[data-bookmark-visit]');
    if (title) title.textContent = file.dataset.title ?? '';
    if (category) category.textContent = file.dataset.category ?? '';
    if (description) description.textContent = file.dataset.description ?? '';
    if (url) url.textContent = file.dataset.url ?? '';
    if (monogram) monogram.textContent = file.dataset.monogram ?? '';
    if (visit) visit.href = file.dataset.url ?? '';
    activeDialog.showModal();
    document.body.classList.add('bookmarks-page--dialog-open');
    activeDialog.querySelector<HTMLButtonElement>('[data-bookmark-close]')?.focus();
  }

  files.forEach((file) => {
    file.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') select(file);
    });
    file.addEventListener('focus', () => select(file));
    file.addEventListener('click', () => open(file));
  });
  select(files[0]);

  dialog.querySelector<HTMLButtonElement>('[data-bookmark-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('bookmarks-page--dialog-open');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  });

  const keyController = new AbortController();
  document.addEventListener('keydown', (event) => {
    if (!consoleElement.isConnected || dialog.open) return;
    const active = document.activeElement;
    const fromPage = active === document.body || active === document.documentElement || consoleElement.contains(active);
    if (!fromPage || !selected) return;

    if (event.key === 'Enter' && (active === document.body || active === document.documentElement)) {
      event.preventDefault();
      open(selected);
      return;
    }

    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const columns = getComputedStyle(shelf).gridTemplateColumns.split(' ').length;
    const index = files.indexOf(selected);
    const offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -columns : columns;
    select(files[(index + offset % files.length + files.length) % files.length], true);
  }, { signal: keyController.signal });
  document.addEventListener('astro:before-swap', () => keyController.abort(), { once: true, signal: keyController.signal });
}

document.addEventListener('astro:page-load', bindBookmarkArchive);
bindBookmarkArchive();
