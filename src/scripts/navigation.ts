function elements(): { toggle: HTMLButtonElement | null; menu: HTMLElement | null } {
  return {
    toggle: document.querySelector<HTMLButtonElement>('[data-menu-toggle]'),
    menu: document.querySelector<HTMLElement>('[data-mobile-menu]')
  };
}

function setMenuOpen(open: boolean): void {
  const { toggle, menu } = elements();
  if (!toggle || !menu) return;
  toggle.setAttribute('aria-expanded', String(open));
  menu.hidden = !open;
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const toggle = event.target.closest('[data-menu-toggle]');
  if (toggle) {
    setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true');
    return;
  }
  if (event.target.closest('[data-mobile-menu] a')) setMenuOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenuOpen(false);
});

document.addEventListener('astro:before-swap', () => setMenuOpen(false));
document.addEventListener('astro:page-load', () => setMenuOpen(false));
setMenuOpen(false);
