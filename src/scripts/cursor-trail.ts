import {
  advanceTrailFrameClock,
  advanceTrailHue,
  classifyTrailRegion,
  createTrailHueState,
  createTrailState,
  isCursorTrailExcludedPathname,
  setTrailTarget,
  updateTrailState,
  type Tendril,
  type TrailRegion,
  type TrailState
} from '@/lib/cursor-trail';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const INPUT_IDLE_MS = 250;
const SETTLED_DISTANCE_PX = 0.1;
const SETTLED_VELOCITY_PX_PER_FRAME = 0.01;
const FADE_TAIL_FRAMES = 24;

type ActiveTrailRegion = Exclude<TrailRegion, null>;
type TrailSession = {
  state: TrailState;
  region: ActiveTrailRegion;
  status: 'active' | 'retiring';
  lastInput: number;
};

let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
const hueState = createTrailHueState();
let sessions: TrailSession[] = [];
let activeSession: TrailSession | undefined;
let animationFrame = 0;
let lastFrame: number | undefined;
let activeRegion: TrailRegion = null;
let fadeFramesRemaining = 0;

function hardResetTrail(): void {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  lastFrame = undefined;
  sessions = [];
  activeSession = undefined;
  activeRegion = null;
  fadeFramesRemaining = 0;
  if (canvas && context) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    canvas.dataset.cursorTrailState = 'idle';
  }
}

function isRouteExcluded(): boolean {
  return isCursorTrailExcludedPathname(location.pathname);
}

function isEnabled(): boolean {
  return !isRouteExcluded() && !reducedMotion.matches && finePointer.matches;
}

function drawTendril(tendril: Tendril): void {
  if (!context || tendril.nodes.length < 2) return;
  const nodes = tendril.nodes;
  context.beginPath();
  context.moveTo(nodes[0].x, nodes[0].y);
  let index = 1;
  for (; index < nodes.length - 2; index += 1) {
    const node = nodes[index];
    const next = nodes[index + 1];
    context.quadraticCurveTo(node.x, node.y, (node.x + next.x) / 2, (node.y + next.y) / 2);
  }
  const node = nodes[index];
  const next = nodes[index + 1];
  context.quadraticCurveTo(node.x, node.y, next.x, next.y);
  context.stroke();
}

function isTrailSettled(trail: TrailState): boolean {
  return trail.tendrils.every(({ nodes }) => nodes.every((node) => (
    Math.hypot(node.x - trail.target.x, node.y - trail.target.y) < SETTLED_DISTANCE_PX
    && Math.hypot(node.vx, node.vy) < SETTLED_VELOCITY_PX_PER_FRAME
  )));
}

function retireActiveSession(): void {
  if (activeSession) activeSession.status = 'retiring';
  activeSession = undefined;
  activeRegion = null;
  if (sessions.length > 0 && canvas) canvas.dataset.cursorTrailState = 'fading';
}

function render(time: number): void {
  if (!canvas || !context || !isEnabled()) {
    hardResetTrail();
    return;
  }
  animationFrame = requestAnimationFrame(render);
  const frame = advanceTrailFrameClock(lastFrame, time);
  lastFrame = frame.lastFrame;
  if (!frame.shouldRender) return;
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = 'rgb(0 0 0 / 40%)';
  context.fillRect(0, 0, innerWidth, innerHeight);
  context.globalCompositeOperation = 'lighter';

  if (
    activeSession
    && performance.now() - activeSession.lastInput >= INPUT_IDLE_MS
    && isTrailSettled(activeSession.state)
  ) {
    retireActiveSession();
  }

  if (sessions.length > 0) {
    context.strokeStyle = `hsl(${Math.round(advanceTrailHue(hueState))} 90% 50% / 25%)`;
    context.lineWidth = 1;
    for (const session of sessions) {
      updateTrailState(session.state);
      for (const tendril of session.state.tendrils) drawTendril(tendril);
    }
  }

  const hadSessions = sessions.length > 0;
  sessions = sessions.filter((session) => (
    session.status === 'active' || !isTrailSettled(session.state)
  ));
  const becameEmpty = hadSessions && sessions.length === 0;
  if (becameEmpty) {
    fadeFramesRemaining = FADE_TAIL_FRAMES;
    if (canvas) canvas.dataset.cursorTrailState = 'fading';
  } else if (sessions.length === 0) {
    fadeFramesRemaining -= 1;
    if (fadeFramesRemaining <= 0) hardResetTrail();
  }
}

function startTrail(): void {
  if (!animationFrame) animationFrame = requestAnimationFrame(render);
}

function resizeCanvas(): void {
  if (!canvas) return;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.round(innerWidth * ratio);
  const height = Math.round(innerHeight * ratio);
  if (context && canvas.width === width && canvas.height === height) return;
  hardResetTrail();
  canvas.width = width;
  canvas.height = height;
  context = canvas.getContext('2d');
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function syncCanvas(): void {
  const nextCanvas = document.querySelector<HTMLCanvasElement>('[data-cursor-trail]');
  if (!nextCanvas) {
    hardResetTrail();
    canvas = null;
    context = null;
    return;
  }
  if (canvas !== nextCanvas) {
    hardResetTrail();
    canvas = nextCanvas;
    context = canvas.getContext('2d');
  }
  const routeExcluded = isRouteExcluded();
  nextCanvas.hidden = routeExcluded;
  if (routeExcluded) {
    hardResetTrail();
    return;
  }
  retireActiveSession();
  resizeCanvas();
}

function pointerRegion(event: PointerEvent): TrailRegion {
  if (document.querySelector('.pswp--open')) return null;
  const horizontal = document.querySelector<HTMLElement>('[data-content-boundary]');
  const vertical = document.querySelector<HTMLElement>('main, [data-cursor-trail-region]');
  if (!horizontal || !vertical) return null;
  const horizontalBounds = horizontal.getBoundingClientRect();
  const verticalBounds = vertical.getBoundingClientRect();
  return classifyTrailRegion(event.clientX, event.clientY, {
    left: horizontalBounds.left,
    right: horizontalBounds.right,
    top: verticalBounds.top,
    bottom: verticalBounds.bottom
  });
}

function endPointerSession(): void {
  retireActiveSession();
}

function handlePointerExit(event: PointerEvent): void {
  if (event.relatedTarget === null) endPointerSession();
}

function handlePointerMove(event: PointerEvent): void {
  if (!canvas || !context || !isEnabled()) return;
  const nextRegion = pointerRegion(event);
  if (nextRegion === null) {
    endPointerSession();
    return;
  }
  const inputTime = performance.now();
  if (activeSession && activeRegion === nextRegion) {
    setTrailTarget(activeSession.state, event.clientX, event.clientY);
    activeSession.lastInput = inputTime;
  } else {
    retireActiveSession();
    activeSession = {
      state: createTrailState(event.clientX, event.clientY),
      region: nextRegion,
      status: 'active',
      lastInput: inputTime
    };
    sessions.push(activeSession);
    activeRegion = nextRegion;
    fadeFramesRemaining = 0;
  }
  canvas.dataset.cursorTrailState = 'active';
  startTrail();
}

function handleCapabilityChange(): void {
  hardResetTrail();
}

window.addEventListener('pointermove', handlePointerMove, { passive: true });
window.addEventListener('pointerout', handlePointerExit, { passive: true });
window.addEventListener('pointerleave', handlePointerExit, { passive: true });
window.addEventListener('pointercancel', endPointerSession, { passive: true });
window.addEventListener('blur', endPointerSession);
window.addEventListener('resize', resizeCanvas, { passive: true });
reducedMotion.addEventListener('change', handleCapabilityChange);
finePointer.addEventListener('change', handleCapabilityChange);
document.addEventListener('astro:page-load', syncCanvas);
syncCanvas();
