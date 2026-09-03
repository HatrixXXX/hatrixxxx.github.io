const RAIL_SELECTOR = '[data-post-rail]';
const DRAG_THRESHOLD = 4;

interface DragState {
  pointerId: number;
  rail: HTMLElement;
  startX: number;
  startScrollLeft: number;
  moved: boolean;
}

let dragState: DragState | null = null;
const suppressedClicks = new WeakSet<HTMLElement>();

function railFromEvent(event: Event): HTMLElement | null {
  return event.target instanceof Element
    ? event.target.closest<HTMLElement>(RAIL_SELECTOR)
    : null;
}

function wheelDelta(event: WheelEvent, rail: HTMLElement): number {
  const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return raw * 24;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return raw * rail.clientWidth;
  return raw;
}

document.addEventListener('wheel', (event) => {
  const rail = railFromEvent(event);
  if (!rail) return;
  const delta = wheelDelta(event, rail);
  if (delta === 0) return;

  const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);
  const canMove = delta < 0 ? rail.scrollLeft > 1 : rail.scrollLeft < maximum - 1;
  if (!canMove) return;

  event.preventDefault();
  rail.scrollLeft = Math.min(maximum, Math.max(0, rail.scrollLeft + delta));
}, { passive: false });

document.addEventListener('pointerdown', (event) => {
  const rail = railFromEvent(event);
  if (!rail || event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;

  dragState = {
    pointerId: event.pointerId,
    rail,
    startX: event.clientX,
    startScrollLeft: rail.scrollLeft,
    moved: false
  };
  rail.setPointerCapture(event.pointerId);
});

document.addEventListener('pointermove', (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const distance = event.clientX - dragState.startX;
  if (!dragState.moved && Math.abs(distance) < DRAG_THRESHOLD) return;

  dragState.moved = true;
  dragState.rail.dataset.dragging = 'true';
  event.preventDefault();
  dragState.rail.scrollLeft = dragState.startScrollLeft - distance;
});

function finishDrag(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { rail, moved, pointerId } = dragState;
  if (rail.hasPointerCapture(pointerId)) rail.releasePointerCapture(pointerId);
  delete rail.dataset.dragging;
  dragState = null;
  if (!moved) return;

  suppressedClicks.add(rail);
  window.setTimeout(() => suppressedClicks.delete(rail), 0);
}

document.addEventListener('pointerup', finishDrag);
document.addEventListener('pointercancel', finishDrag);
document.addEventListener('dragstart', (event) => {
  if (railFromEvent(event)) event.preventDefault();
});
document.addEventListener('click', (event) => {
  const rail = railFromEvent(event);
  if (!rail || !suppressedClicks.has(rail)) return;

  suppressedClicks.delete(rail);
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
