const TOGGLE_SELECTOR = '[data-blog-view-toggle]';

function setArchiveView(toggle: HTMLButtonElement, showArchive: boolean): void {
  const root = toggle.closest<HTMLElement>('[data-blog-view-root]');
  const cardView = root?.querySelector<HTMLElement>('[data-blog-card-view]');
  const archiveView = root?.querySelector<HTMLElement>('[data-blog-archive-view]');
  if (!cardView || !archiveView) return;

  cardView.hidden = showArchive;
  archiveView.hidden = !showArchive;
  toggle.setAttribute('aria-pressed', String(showArchive));
  toggle.textContent = showArchive ? '切换到卡片视图' : '切换到时间归档';
}

function initializeBlogViews(): void {
  for (const toggle of document.querySelectorAll<HTMLButtonElement>(TOGGLE_SELECTOR)) {
    setArchiveView(toggle, false);
    toggle.hidden = false;
  }
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const toggle = event.target.closest<HTMLButtonElement>(TOGGLE_SELECTOR);
  if (!toggle) return;
  setArchiveView(toggle, toggle.getAttribute('aria-pressed') !== 'true');
});

document.addEventListener('astro:page-load', initializeBlogViews);
initializeBlogViews();
