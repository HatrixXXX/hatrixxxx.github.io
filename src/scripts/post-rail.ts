import {
  clampRailPosition,
  createMotionState,
  stepDampedMotion,
  stepInertialMotion,
  type DampedMotionState
} from '@/lib/post-rail-motion';

const RAIL_SELECTOR = '[data-post-rail]';
const DRAG_THRESHOLD = 4;
const DRAG_SAMPLE_WINDOW = 100;
const MIN_INERTIAL_VELOCITY = 0.15;
const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

interface DragSample {
  time: number;
  x: number;
}

interface RailRuntimeState {
  motion: DampedMotionState;
  animationFrame: number | null;
  lastFrameTime: number | null;
  reducedMotion: boolean;
  dragSamples: DragSample[];
  animationMode: 'damped' | 'inertial' | null;
}

interface DragState {
  pointerId: number;
  rail: HTMLElement;
  startX: number;
  startScrollLeft: number;
  moved: boolean;
}

let dragState: DragState | null = null;
const railStates = new WeakMap<HTMLElement, RailRuntimeState>();
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

function maximumScrollLeft(rail: HTMLElement): number {
  return Math.max(0, rail.scrollWidth - rail.clientWidth);
}

function runtimeFor(rail: HTMLElement): RailRuntimeState {
  const existing = railStates.get(rail);
  if (existing) {
    existing.reducedMotion = reducedMotionMedia.matches;
    return existing;
  }

  const position = rail.scrollLeft;
  const runtime: RailRuntimeState = {
    motion: createMotionState(position),
    animationFrame: null,
    lastFrameTime: null,
    reducedMotion: reducedMotionMedia.matches,
    dragSamples: [],
    animationMode: null
  };
  railStates.set(rail, runtime);
  return runtime;
}

function syncMotionPosition(rail: HTMLElement): RailRuntimeState {
  const runtime = runtimeFor(rail);
  const position = clampRailPosition(rail.scrollLeft, maximumScrollLeft(rail));
  runtime.motion = createMotionState(position);
  return runtime;
}

function cancelAnimation(rail: HTMLElement): RailRuntimeState {
  const runtime = runtimeFor(rail);
  if (runtime.animationFrame !== null) cancelAnimationFrame(runtime.animationFrame);
  runtime.animationFrame = null;
  runtime.lastFrameTime = null;
  runtime.animationMode = null;
  return runtime;
}

function finishAnimation(rail: HTMLElement, runtime: RailRuntimeState): void {
  runtime.animationFrame = null;
  runtime.lastFrameTime = null;
  runtime.animationMode = null;
  runtime.motion.velocity = 0;
  runtime.motion.position = clampRailPosition(runtime.motion.position, maximumScrollLeft(rail));
  runtime.motion.target = runtime.motion.position;
}

function requestMotionFrame(rail: HTMLElement, mode: 'damped' | 'inertial'): void {
  const runtime = runtimeFor(rail);
  runtime.animationMode = mode;
  if (runtime.animationFrame !== null) return;

  const frame = (time: number): void => {
    runtime.animationFrame = null;
    if (runtime.animationMode !== mode || runtime.reducedMotion) {
      if (runtime.reducedMotion) syncMotionPosition(rail);
      finishAnimation(rail, runtime);
      return;
    }

    const deltaMs = runtime.lastFrameTime === null
      ? 16
      : Math.min(32, Math.max(0, time - runtime.lastFrameTime));
    runtime.lastFrameTime = time;
    const maximum = maximumScrollLeft(rail);
    runtime.motion = mode === 'damped'
      ? stepDampedMotion(runtime.motion, deltaMs, maximum)
      : stepInertialMotion(runtime.motion, deltaMs, maximum);
    rail.scrollLeft = runtime.motion.position;

    if (runtime.motion.velocity === 0 && runtime.motion.position === runtime.motion.target) {
      finishAnimation(rail, runtime);
      return;
    }
    runtime.animationFrame = requestAnimationFrame(frame);
  };

  runtime.animationFrame = requestAnimationFrame(frame);
}

function startDampedAnimation(rail: HTMLElement): void {
  const runtime = runtimeFor(rail);
  if (runtime.reducedMotion) {
    rail.scrollLeft = runtime.motion.target;
    syncMotionPosition(rail);
    return;
  }
  requestMotionFrame(rail, 'damped');
}

function startInertialAnimation(rail: HTMLElement, velocity: number): void {
  const runtime = runtimeFor(rail);
  if (runtime.reducedMotion || Math.abs(velocity) < MIN_INERTIAL_VELOCITY) {
    cancelAnimation(rail);
    syncMotionPosition(rail);
    return;
  }
  const position = clampRailPosition(rail.scrollLeft, maximumScrollLeft(rail));
  runtime.motion = createMotionState(position, position, velocity);
  requestMotionFrame(rail, 'inertial');
}

function recordDragSample(rail: HTMLElement, x: number): void {
  const runtime = runtimeFor(rail);
  const now = performance.now();
  runtime.dragSamples.push({ time: now, x });
  while (runtime.dragSamples.length > 2 && now - runtime.dragSamples[0].time > DRAG_SAMPLE_WINDOW) {
    runtime.dragSamples.shift();
  }
}

function dragVelocity(rail: HTMLElement): number {
  const samples = runtimeFor(rail).dragSamples;
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const elapsed = Math.max(1, last.time - first.time);
  return -((last.x - first.x) / elapsed) * 16;
}

document.addEventListener('wheel', (event) => {
  const rail = railFromEvent(event);
  if (!rail) return;
  const delta = wheelDelta(event, rail);
  if (delta === 0) return;

  const maximum = maximumScrollLeft(rail);
  const canMove = delta < 0 ? rail.scrollLeft > 1 : rail.scrollLeft < maximum - 1;
  if (!canMove) return;

  event.preventDefault();
  const runtime = runtimeFor(rail);
  if (runtime.animationMode === null) syncMotionPosition(rail);
  else if (runtime.animationMode === 'inertial') cancelAnimation(rail);
  const nextTarget = clampRailPosition(runtime.motion.target + delta, maximum);
  runtime.motion.target = nextTarget;
  runtime.motion.velocity = 0;
  startDampedAnimation(rail);
}, { passive: false });

document.addEventListener('pointerdown', (event) => {
  const rail = railFromEvent(event);
  if (!rail || event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;

  cancelAnimation(rail);
  syncMotionPosition(rail);
  runtimeFor(rail).dragSamples = [];
  dragState = {
    pointerId: event.pointerId,
    rail,
    startX: event.clientX,
    startScrollLeft: rail.scrollLeft,
    moved: false
  };
});

document.addEventListener('pointermove', (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const distance = event.clientX - dragState.startX;
  if (!dragState.moved && Math.abs(distance) < DRAG_THRESHOLD) return;

  if (!dragState.moved) {
    dragState.moved = true;
    dragState.rail.setPointerCapture(event.pointerId);
    recordDragSample(dragState.rail, event.clientX);
  }
  dragState.rail.dataset.dragging = 'true';
  event.preventDefault();
  const rail = dragState.rail;
  const runtime = runtimeFor(rail);
  const position = clampRailPosition(
    dragState.startScrollLeft - distance,
    maximumScrollLeft(rail)
  );
  rail.scrollLeft = position;
  runtime.motion = createMotionState(position);
  recordDragSample(rail, event.clientX);
});

function finishDrag(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { rail, moved, pointerId } = dragState;
  if (rail.hasPointerCapture(pointerId)) rail.releasePointerCapture(pointerId);
  delete rail.dataset.dragging;
  const velocity = moved ? dragVelocity(rail) : 0;
  runtimeFor(rail).dragSamples = [];
  dragState = null;
  if (!moved) return;

  suppressedClicks.add(rail);
  window.setTimeout(() => suppressedClicks.delete(rail), 0);
  startInertialAnimation(rail, velocity);
}

function stopReducedMotionAnimations(): void {
  if (!reducedMotionMedia.matches) return;
  document.querySelectorAll<HTMLElement>(RAIL_SELECTOR).forEach((rail) => {
    const runtime = railStates.get(rail);
    if (!runtime) return;
    runtime.reducedMotion = true;
    cancelAnimation(rail);
    syncMotionPosition(rail);
  });
}

reducedMotionMedia.addEventListener('change', stopReducedMotionAnimations);
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
