export {};

let pendingRead: number | undefined;
let pendingButton: HTMLButtonElement | null = null;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function openProject(button: HTMLButtonElement): void {
  const dialog = document.getElementById(button.getAttribute('aria-controls') ?? '');
  if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;

  if (pendingRead !== undefined) window.clearTimeout(pendingRead);
  pendingButton?.removeAttribute('data-reading');
  pendingButton = button;
  button.dataset.reading = '';

  const reveal = () => {
    pendingRead = undefined;
    pendingButton = null;
    button.removeAttribute('data-reading');
    if (!dialog.isConnected) return;

    const card = button.getBoundingClientRect();
    dialog.style.setProperty('--launch-x', `${card.left + card.width / 2 - window.innerWidth / 2}px`);
    dialog.style.setProperty('--launch-y', `${card.top + card.height / 2 - window.innerHeight / 2}px`);
    dialog.dataset.open = '';
    dialog.showModal();
    document.body.classList.add('projects-page--dialog-open');
    dialog.querySelector<HTMLButtonElement>('[data-close-project]')?.focus();
  };

  if (reducedMotion()) reveal();
  else pendingRead = window.setTimeout(reveal, 260);
}

function closeProject(dialog: HTMLDialogElement): void {
  if (!dialog.open || dialog.hasAttribute('data-closing')) return;
  if (reducedMotion()) {
    dialog.close();
    return;
  }
  dialog.dataset.closing = '';
  window.setTimeout(() => {
    if (dialog.open) dialog.close();
  }, 160);
}

function moveGallery(button: HTMLButtonElement, direction: number): void {
  const gallery = button.closest<HTMLElement>('[data-project-gallery]');
  const track = gallery?.querySelector<HTMLElement>('[data-gallery-track]');
  if (!track) return;
  const slideCount = track.children.length;
  const current = Math.round(track.scrollLeft / track.clientWidth);
  const next = Math.max(0, Math.min(slideCount - 1, current + direction));
  track.scrollTo({ left: next * track.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function bindProjectArchive(): void {
  document.querySelectorAll<HTMLDialogElement>('[data-project-dialog]:not([data-bound])').forEach((dialog) => {
    dialog.dataset.bound = '';
    const cardButton = dialog.parentElement?.querySelector<HTMLButtonElement>('[data-open-project]');
    dialog.addEventListener('close', () => {
      dialog.removeAttribute('data-open');
      dialog.removeAttribute('data-closing');
      document.body.classList.remove('projects-page--dialog-open');
      if (cardButton?.isConnected) cardButton.focus();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeProject(dialog);
    });
    const track = dialog.querySelector<HTMLElement>('[data-gallery-track]');
    const count = dialog.querySelector<HTMLElement>('[data-gallery-count]');
    if (track && count) {
      track.addEventListener('scroll', () => {
        const index = Math.round(track.scrollLeft / track.clientWidth) + 1;
        count.textContent = `${String(index).padStart(2, '0')} / ${String(track.children.length).padStart(2, '0')}`;
      }, { passive: true });
    }
  });
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const openButton = event.target.closest<HTMLButtonElement>('[data-open-project]');
  if (openButton) {
    openProject(openButton);
    return;
  }
  const closeButton = event.target.closest<HTMLButtonElement>('[data-close-project]');
  if (closeButton) {
    const dialog = closeButton.closest<HTMLDialogElement>('[data-project-dialog]');
    if (dialog) closeProject(dialog);
    return;
  }
  const previous = event.target.closest<HTMLButtonElement>('[data-gallery-prev]');
  if (previous) moveGallery(previous, -1);
  const next = event.target.closest<HTMLButtonElement>('[data-gallery-next]');
  if (next) moveGallery(next, 1);
});

document.addEventListener('astro:page-load', bindProjectArchive);
bindProjectArchive();
