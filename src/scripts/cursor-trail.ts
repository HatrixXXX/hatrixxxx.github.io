import { ambientTrailCount } from '@/lib/ambient-trail';
import { isCursorTrailExcludedPathname } from '@/lib/cursor-trail';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;

function clearCanvas(): void {
  if (!canvas || !context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function randomBetween(min: number, max: number): number { return min + Math.random() * (max - min); }

function drawSide(start: number, end: number, top: number, bottom: number, direction: 1 | -1): void {
  if (!context) return;
  const width = Math.abs(end - start);
  for (let index = 0; index < ambientTrailCount(width); index += 1) {
    const inset = randomBetween(12, Math.max(13, width - 12));
    const x = direction === 1 ? start + inset : start - inset;
    const drift = randomBetween(width * 0.12, width * 0.42) * direction;
    context.beginPath();
    context.moveTo(x, randomBetween(top, bottom));
    context.bezierCurveTo(x + drift, randomBetween(top, bottom), x - drift, randomBetween(top, bottom), x + randomBetween(-width * 0.12, width * 0.12) * direction, randomBetween(top, bottom));
    context.stroke();
  }
}

function render(): void {
  if (!canvas || !context || reducedMotion.matches || isCursorTrailExcludedPathname(location.pathname)) { if (canvas) canvas.hidden = true; clearCanvas(); return; }
  const horizontal = document.querySelector<HTMLElement>('[data-content-boundary]');
  const vertical = document.querySelector<HTMLElement>('main, [data-cursor-trail-region]');
  if (!horizontal || !vertical) return;
  const x = horizontal.getBoundingClientRect();
  const y = vertical.getBoundingClientRect();
  canvas.hidden = false;
  clearCanvas();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.globalCompositeOperation = 'source-over';
  context.strokeStyle = 'rgb(126 231 255 / 16%)';
  context.lineWidth = 1;
  drawSide(x.left, 0, Math.max(0, y.top), Math.min(innerHeight, y.bottom), 1);
  drawSide(x.right, innerWidth, Math.max(0, y.top), Math.min(innerHeight, y.bottom), -1);
}

function resize(): void {
  if (!canvas) return;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  render();
}

function sync(): void { canvas = document.querySelector<HTMLCanvasElement>('[data-cursor-trail]'); context = canvas?.getContext('2d') ?? null; resize(); }

window.addEventListener('resize', resize, { passive: true });
reducedMotion.addEventListener('change', sync);
document.addEventListener('astro:page-load', sync);
sync();
