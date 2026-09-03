import {
  advanceTrailHue,
  createTrailState,
  isPointerInGutter,
  setTrailTarget,
  updateTrailState,
  type Tendril,
  type TrailState
} from '@/lib/cursor-trail';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const FRAME_INTERVAL_MS = 1000 / 60;
const INPUT_IDLE_MS = 250;
const SETTLED_DISTANCE_PX = 0.1;
const SETTLED_VELOCITY_PX_PER_FRAME = 0.01;

let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let state: TrailState | undefined;
let animationFrame = 0;
let lastFrame = 0;
let lastPointerInput = 0;

function clearTrail(): void {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  lastFrame = 0;
  lastPointerInput = 0;
  state = undefined;
  if (canvas && context) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    canvas.dataset.cursorTrailState = 'idle';
  }
}

function isEnabled(): boolean {
  return !reducedMotion.matches && finePointer.matches;
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

function isTrailSettled(): boolean {
  const currentState = state;
  if (!currentState) return false;
  return currentState.tendrils.every(({ nodes }) => nodes.every((node) => (
    Math.hypot(node.x - currentState.target.x, node.y - currentState.target.y) < SETTLED_DISTANCE_PX
    && Math.hypot(node.vx, node.vy) < SETTLED_VELOCITY_PX_PER_FRAME
  )));
}

function render(time: number): void {
  if (!canvas || !context || !state || !isEnabled()) {
    clearTrail();
    return;
  }
  animationFrame = requestAnimationFrame(render);
  if (time - lastFrame < FRAME_INTERVAL_MS) return;
  lastFrame = time;
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = 'rgb(0 0 0 / 40%)';
  context.fillRect(0, 0, innerWidth, innerHeight);
  context.globalCompositeOperation = 'lighter';
  updateTrailState(state);
  if (performance.now() - lastPointerInput >= INPUT_IDLE_MS && isTrailSettled()) {
    clearTrail();
    return;
  }
  context.strokeStyle = `hsl(${Math.round(advanceTrailHue(state))} 90% 50% / 25%)`;
  context.lineWidth = 1;
  for (const tendril of state.tendrils) drawTendril(tendril);
}

function startTrail(): void {
  if (!animationFrame) animationFrame = requestAnimationFrame(render);
}

function resizeCanvas(): void {
  if (!canvas) return;
  clearTrail();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  context = canvas.getContext('2d');
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function syncCanvas(): void {
  const nextCanvas = document.querySelector<HTMLCanvasElement>('[data-cursor-trail]');
  if (!nextCanvas) {
    clearTrail();
    canvas = null;
    context = null;
    return;
  }
  if (canvas !== nextCanvas) {
    clearTrail();
    canvas = nextCanvas;
    context = canvas.getContext('2d');
  }
  resizeCanvas();
}

function handlePointerMove(event: PointerEvent): void {
  if (!canvas || !context || !isEnabled()) return;
  const boundary = document.querySelector<HTMLElement>('[data-content-boundary]');
  if (!boundary || !isPointerInGutter(event.clientX, boundary.getBoundingClientRect())) return;
  if (state) setTrailTarget(state, event.clientX, event.clientY);
  else state = createTrailState(event.clientX, event.clientY);
  lastPointerInput = performance.now();
  canvas.dataset.cursorTrailState = 'active';
  startTrail();
}

function handleCapabilityChange(): void {
  clearTrail();
}

window.addEventListener('pointermove', handlePointerMove, { passive: true });
window.addEventListener('resize', resizeCanvas, { passive: true });
reducedMotion.addEventListener('change', handleCapabilityChange);
finePointer.addEventListener('change', handleCapabilityChange);
document.addEventListener('astro:page-load', syncCanvas);
syncCanvas();
