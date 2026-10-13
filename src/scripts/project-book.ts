export {};

const TURN_DURATION = 740;
const SCAN_DURATION = 620;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function bindProjectBook(): void {
  const book = document.querySelector<HTMLElement>('[data-project-book]:not([data-bound])');
  if (!book) return;
  book.dataset.bound = '';

  const leaves = Array.from(book.querySelectorAll<HTMLElement>('[data-book-leaf]'));
  const status = book.querySelector<HTMLElement>('[data-book-status]');
  let turnTimer: number | undefined;
  let scanTimer: number | undefined;
  let unsealTimer: number | undefined;

  const turnTo = (next: number) => {
    const current = Number(book.dataset.currentPage);
    if (next === current || next < 0 || next >= leaves.length) return;
    if (turnTimer !== undefined) window.clearTimeout(turnTimer);
    if (scanTimer !== undefined) window.clearTimeout(scanTimer);
    if (unsealTimer !== undefined) window.clearTimeout(unsealTimer);
    unsealTimer = undefined;
    book.removeAttribute('data-unsealing');
    leaves.forEach((leaf) => leaf.removeAttribute('data-turning'));

    const destination = leaves[next].querySelector<HTMLElement>('[data-project-page]');
    if (destination) {
      destination.dataset.pending = '';
      destination.removeAttribute('data-scanning');
      destination.removeAttribute('data-revealed');
      destination.closest<HTMLElement>('[data-book-leaf]')?.querySelector<HTMLElement>('.folio-scroll')?.scrollTo({ top: 0 });
    }

    const moving = leaves[next > current ? current : next];
    moving.dataset.turning = '';
    book.dataset.currentPage = String(next);
    book.focus({ preventScroll: true });
    leaves.forEach((leaf, index) => {
      leaf.toggleAttribute('data-flipped', index < next);
      leaf.toggleAttribute('data-active', index === next);
      leaf.inert = index !== next;
      leaf.setAttribute('aria-hidden', index === next ? 'false' : 'true');
    });
    if (status) status.textContent = next === 0 ? '返回图鉴封面' : '正在翻阅项目档案';

    const finishTurn = () => {
      if (!book.isConnected) return;
      moving.removeAttribute('data-turning');
      if (next === 0) {
        book.querySelector<HTMLButtonElement>('[data-open-book]')?.focus({ preventScroll: true });
        return;
      }
      if (!destination) return;
      destination.removeAttribute('data-pending');
      if (reducedMotion()) {
        destination.dataset.revealed = '';
        if (status) status.textContent = `已读取：${destination.querySelector('h2')?.textContent ?? ''}`;
        destination.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
        return;
      }
      destination.dataset.scanning = '';
      if (status) status.textContent = '正在扫描当前作品';
      scanTimer = window.setTimeout(() => {
        if (!book.isConnected || Number(book.dataset.currentPage) !== next) return;
        destination.removeAttribute('data-scanning');
        destination.dataset.revealed = '';
        if (status) status.textContent = `已读取：${destination.querySelector('h2')?.textContent ?? ''}`;
        destination.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      }, SCAN_DURATION);
    };

    if (reducedMotion()) finishTurn();
    else turnTimer = window.setTimeout(finishTurn, TURN_DURATION);
  };

  book.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-open-book]')) {
      if (book.hasAttribute('data-unsealing')) return;
      if (reducedMotion()) return turnTo(1);
      book.dataset.unsealing = '';
      unsealTimer = window.setTimeout(() => {
        if (book.isConnected) turnTo(1);
      }, 260);
      return;
    }
    if (event.target.closest('[data-turn-prev]')) return turnTo(Number(book.dataset.currentPage) - 1);
    if (event.target.closest('[data-turn-next]')) return turnTo(Number(book.dataset.currentPage) + 1);
    const galleryButton = event.target.closest<HTMLButtonElement>('[data-gallery-prev], [data-gallery-next]');
    if (!galleryButton) return;
    const track = galleryButton.closest<HTMLElement>('.folio-media')?.querySelector<HTMLElement>('[data-gallery-track]');
    if (!track) return;
    const current = Math.round(track.scrollLeft / track.clientWidth);
    const direction = galleryButton.hasAttribute('data-gallery-next') ? 1 : -1;
    const index = Math.max(0, Math.min(track.children.length - 1, current + direction));
    track.scrollTo({ left: index * track.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
  });

  book.addEventListener('keydown', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-gallery-track]')) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      turnTo(Number(book.dataset.currentPage) + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      turnTo(Number(book.dataset.currentPage) - 1);
    }
  });

  book.querySelectorAll<HTMLElement>('[data-gallery-track]').forEach((track) => {
    const count = track.closest<HTMLElement>('.folio-media')?.querySelector<HTMLElement>('[data-gallery-count]');
    if (!count) return;
    track.addEventListener('scroll', () => {
      const index = Math.round(track.scrollLeft / track.clientWidth) + 1;
      count.textContent = `${String(index).padStart(2, '0')} / ${String(track.children.length).padStart(2, '0')}`;
    }, { passive: true });
  });
}

document.addEventListener('astro:page-load', bindProjectBook);
document.addEventListener('visibilitychange', () => {
  const book = document.querySelector<HTMLElement>('[data-project-book]');
  book?.toggleAttribute('data-paused', document.hidden);
});
bindProjectBook();
