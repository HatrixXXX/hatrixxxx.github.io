const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const controlSelector = 'a[href], button, summary, input:not([type="hidden" i]), textarea, select, [role="button"], [contenteditable="true"], label, .sakana-character';
const homeAttractionRadius = 72;

let pageFrame: HTMLElement | null = null;
let activeFrame: HTMLElement | null = null;
let homeTiles: HTMLElement[] = [];
let pendingMove: PointerEvent | null = null;
let moveFrame = 0;
let homeMorphFrame = 0;
let pendingHomeMorph: (() => void) | null = null;

function hideFrame(): void {
  activeFrame?.removeAttribute('data-active');
  activeFrame?.style.removeProperty('opacity');
  activeFrame?.style.removeProperty('transition');
  pendingMove = null;
  if (moveFrame) cancelAnimationFrame(moveFrame);
  moveFrame = 0;
  if (homeMorphFrame) cancelAnimationFrame(homeMorphFrame);
  homeMorphFrame = 0;
  pendingHomeMorph = null;
}

function syncFrame(): void {
  hideFrame();
  pageFrame = document.querySelector<HTMLElement>('body > [data-magnetic-frame]');
  activeFrame = pageFrame;
  homeTiles = [...document.querySelectorAll<HTMLElement>('.home-stage .tile[href], .home-stage [data-home-magnetic]')];
  pageFrame?.setAttribute('data-magnetic-ready', '');
}

function nearbyHomeTile(x: number, y: number): { tile: HTMLElement; strength: number } | null {
  let closest: HTMLElement | null = null;
  let shortest = homeAttractionRadius;
  for (const tile of homeTiles) {
    if (!tile.isConnected) continue;
    const rect = tile.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    if (distance < shortest) {
      closest = tile;
      shortest = distance;
    }
  }
  return closest ? { tile: closest, strength: 1 - shortest / homeAttractionRadius } : null;
}

function interactiveTarget(element: Element): Element | null {
  if (element.closest('.snippet-card')) return null;
  const card = element.closest<HTMLElement>('[data-post-card]');
  if (card) return card;

  const player = element.closest<HTMLElement>('[data-music-player][data-display-mode="dock"][data-ui-state="expanded"]');
  if (player && !element.closest('button, input, label, a')) return player;

  const control = element.closest(controlSelector);
  if (!control) return element.closest('.twikoo-comments[data-twikoo-variant="guestbook"] .tk-comment');
  if (control.closest('[inert], [aria-disabled="true"]') || control.matches(':disabled')) return null;
  if (control instanceof HTMLLabelElement && (!control.control || control.control.matches(':disabled'))) return null;
  return control;
}

function frameFor(target: Element): { element: HTMLElement; originX: number; originY: number; tile?: HTMLElement; panel?: HTMLElement } | null {
  if (target.matches('.home-stage .tile, .home-stage [data-home-magnetic]')) {
    const tile = target as HTMLElement;
    const panel = tile.closest<HTMLElement>('[data-home-panel]');
    if (!panel) return null;
    let element = panel.querySelector<HTMLElement>(':scope > [data-magnetic-frame]');
    if (!element) {
      element = document.createElement('span');
      element.dataset.magneticFrame = '';
      element.dataset.homeTileFrame = '';
      element.setAttribute('aria-hidden', 'true');
      panel.append(element);
    }
    return { element, originX: 0, originY: 0, tile, panel };
  }

  const dialog = target.closest<HTMLDialogElement>('dialog[open]');
  if (!dialog) return pageFrame?.isConnected ? { element: pageFrame, originX: 0, originY: 0 } : null;

  let element = dialog.querySelector<HTMLElement>(':scope > [data-magnetic-frame]');
  if (!element) {
    element = document.createElement('span');
    element.dataset.magneticFrame = '';
    element.dataset.dialogFrame = '';
    element.setAttribute('aria-hidden', 'true');
    dialog.append(element);
  }
  const rect = dialog.getBoundingClientRect();
  return { element, originX: rect.left - dialog.scrollLeft, originY: rect.top - dialog.scrollTop };
}

function updateFrame(event: PointerEvent): void {
  if (!finePointer.matches || event.pointerType !== 'mouse') {
    hideFrame();
    return;
  }
  const element = event.target instanceof Element ? event.target : null;
  const hovered = element ? interactiveTarget(element) : null;
  const nearby = !hovered && !element?.closest(controlSelector)
    ? nearbyHomeTile(event.clientX, event.clientY)
    : null;
  const target = hovered ?? nearby?.tile;
  if (!target?.isConnected) {
    hideFrame();
    return;
  }

  const selected = frameFor(target);
  if (!selected) {
    hideFrame();
    return;
  }
  if (activeFrame !== selected.element) hideFrame();
  activeFrame = selected.element;

  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    hideFrame();
    return;
  }
  if (selected.tile && selected.panel) {
    const tile = selected.tile;
    let tileX = 0;
    let tileY = 0;
    for (let node: HTMLElement | null = tile; node && node !== selected.panel; node = node.offsetParent as HTMLElement | null) {
      tileX += node.offsetLeft;
      tileY += node.offsetTop;
    }
    const widthRatio = tile.offsetWidth / rect.width;
    const heightRatio = tile.offsetHeight / rect.height;
    const strength = reducedMotion.matches ? 1 : nearby?.strength ?? 1;
    const pull = reducedMotion.matches ? 0 : 0.12;
    const x = tileX - 4 + (event.clientX - rect.left - rect.width / 2) * widthRatio * pull;
    const y = tileY - 4 + (event.clientY - rect.top - rect.height / 2) * heightRatio * pull;
    const frame = activeFrame;
    const applyTarget = () => {
      frame.style.width = `${tile.offsetWidth + 8}px`;
      frame.style.height = `${tile.offsetHeight + 8}px`;
      frame.style.opacity = String(0.35 + strength * 0.65);
      frame.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame.setAttribute('data-active', '');
    };
    if (!activeFrame.hasAttribute('data-active') && !reducedMotion.matches) {
      const cursorWidth = 24 * widthRatio;
      const cursorHeight = 24 * heightRatio;
      activeFrame.style.transition = 'none';
      activeFrame.style.width = `${cursorWidth}px`;
      activeFrame.style.height = `${cursorHeight}px`;
      activeFrame.style.transform = `translate3d(${tileX + (event.clientX - rect.left) * widthRatio - cursorWidth / 2}px, ${tileY + (event.clientY - rect.top) * heightRatio - cursorHeight / 2}px, 0)`;
      activeFrame.style.opacity = '0';
      activeFrame.setAttribute('data-active', '');
      pendingHomeMorph = applyTarget;
      homeMorphFrame = requestAnimationFrame(() => {
        homeMorphFrame = 0;
        const finish = pendingHomeMorph;
        pendingHomeMorph = null;
        if (activeFrame !== frame || !frame.hasAttribute('data-active')) return;
        frame.style.removeProperty('transition');
        finish?.();
      });
      return;
    }
    if (homeMorphFrame) pendingHomeMorph = applyTarget;
    else applyTarget();
    return;
  }
  const verticalInset = target.matches('.desktop-nav > ul > li > a') ? 4 : -4;
  const width = rect.width + 8;
  const height = rect.height - verticalInset * 2;
  if (activeFrame.style.width !== `${width}px`) activeFrame.style.width = `${width}px`;
  if (activeFrame.style.height !== `${height}px`) activeFrame.style.height = `${height}px`;

  const pull = reducedMotion.matches ? 0 : 0.12;
  const x = rect.left - selected.originX - 4 + (event.clientX - rect.left - rect.width / 2) * pull;
  const y = rect.top - selected.originY + verticalInset + (event.clientY - rect.top - rect.height / 2) * pull;
  activeFrame.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  activeFrame.setAttribute('data-active', '');
}

document.addEventListener('pointermove', (event) => {
  pendingMove = event;
  if (moveFrame) return;
  moveFrame = requestAnimationFrame(() => {
    moveFrame = 0;
    const move = pendingMove;
    pendingMove = null;
    if (move) updateFrame(move);
  });
}, { passive: true });

window.addEventListener('resize', hideFrame);
window.addEventListener('blur', hideFrame);
finePointer.addEventListener('change', hideFrame);
document.addEventListener('scroll', (event) => {
  if (event.target instanceof Element && event.target.classList.contains('home-stage')) return;
  hideFrame();
}, true);
document.addEventListener('pointercancel', hideFrame);
document.addEventListener('pointerout', (event) => {
  if (!event.relatedTarget) hideFrame();
});
document.addEventListener('astro:before-swap', hideFrame);
document.addEventListener('astro:page-load', syncFrame);
syncFrame();
