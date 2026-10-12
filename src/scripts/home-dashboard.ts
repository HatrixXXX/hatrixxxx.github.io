import { getHomeLevel } from '@/lib/home-level';
import { createPanelView, type Point } from '@/lib/home-projection';
import { shuffleQuoteOrder } from '@/lib/quote-order';
import { HOME_QUOTES, HOME_QUOTE_INTERVAL } from '@/data/home-quotes';

let cleanup: (() => void) | undefined;
const QUOTE_MAX_FONT_SIZE = 17;
const QUOTE_MIN_FONT_SIZE = 10;

function fitQuoteText(element: HTMLElement, source: HTMLElement): void {
  element.style.fontSize = `${QUOTE_MAX_FONT_SIZE}px`;
  source.style.fontSize = `${(QUOTE_MAX_FONT_SIZE * 0.618).toFixed(2)}px`;
  const availableWidth = element.clientWidth;
  const requiredWidth = element.scrollWidth;
  const fittedSize = availableWidth === 0 || requiredWidth <= availableWidth
    ? QUOTE_MAX_FONT_SIZE
    : Math.max(QUOTE_MIN_FONT_SIZE, QUOTE_MAX_FONT_SIZE * (availableWidth - 2) / requiredWidth);
  element.style.fontSize = `${fittedSize.toFixed(2)}px`;
  source.style.fontSize = `${(fittedSize * 0.618).toFixed(2)}px`;
}

function initializePanelMotion(stage: HTMLElement, motion: MediaQueryList, signal: AbortSignal): () => void {
  const canvas = stage.querySelector<HTMLElement>('[data-home-canvas]')!;
  const left = stage.querySelector<HTMLElement>('[data-home-tilt="left"]')!;
  const rightSide = stage.querySelector<HTMLElement>('[data-home-side="right"]')!;
  const right = stage.querySelector<HTMLElement>('[data-home-plane="right"]')!;
  const rightStaticStyle = right.getAttribute('style')!;
  const rightMatrix = new DOMMatrixReadOnly(right.style.transform);
  const rightWidth = right.offsetWidth;
  const rightHeight = right.offsetHeight;
  const rightCorners: Point[] = [[0, 0], [rightWidth, 0], [rightWidth, rightHeight], [0, rightHeight]]
    .map(([x, y]) => {
      const point = new DOMPoint(x, y).matrixTransform(rightMatrix);
      return [point.x / point.w, point.y / point.w];
    });
  const canvasWidth = canvas.offsetWidth;
  const canvasHeight = canvas.offsetHeight;
  const leftView = createPanelView(canvasWidth, canvasHeight,
    [[0, 0], [canvasWidth, 0], [canvasWidth, canvasHeight], [0, canvasHeight]], 1000);
  const rightView = createPanelView(rightWidth, rightHeight, rightCorners, 1000);
  let sideOffset = 0;
  const updateSideOffset = (): void => {
    sideOffset = new DOMMatrixReadOnly(getComputedStyle(rightSide).transform).m41;
  };
  updateSideOffset();
  let frame = 0;
  let previousTime = 0;
  let pitch = 0;
  let yaw = 0;
  let targetPitch = 0;
  let targetYaw = 0;

  const clearTilt = (): void => {
    left.style.transform = '';
    left.style.willChange = '';
    right.setAttribute('style', rightStaticStyle);
  };
  const render = (time: number): void => {
    frame = 0;
    const blend = 1 - Math.exp(-Math.min(time - (previousTime || time - 16), 64) / 85);
    previousTime = time;
    pitch += (targetPitch - pitch) * blend;
    yaw += (targetYaw - yaw) * blend;
    if (Math.abs(targetPitch - pitch) < 0.005 && Math.abs(targetYaw - yaw) < 0.005) {
      pitch = targetPitch;
      yaw = targetYaw;
      if (pitch === 0 && yaw === 0) {
        clearTilt();
        return;
      }
    }
    left.style.transform = `matrix3d(${leftView(yaw, pitch, [canvasWidth / 2 + sideOffset, canvasHeight / 2]).join(',')})`;
    right.style.transform = `matrix3d(${rightView(yaw, pitch, [canvasWidth / 2 - sideOffset, canvasHeight / 2]).join(',')})`;
    if (pitch !== targetPitch || yaw !== targetYaw) frame = requestAnimationFrame(render);
    else {
      left.style.willChange = '';
      right.style.willChange = '';
    }
  };
  const schedule = (): void => {
    if (frame) return;
    left.style.willChange = 'transform';
    right.style.willChange = 'transform';
    previousTime = 0;
    frame = requestAnimationFrame(render);
  };
  const reset = (): void => {
    targetPitch = 0;
    targetYaw = 0;
    if (motion.matches || document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      pitch = 0;
      yaw = 0;
      clearTilt();
    } else if (pitch !== 0 || yaw !== 0) schedule();
  };

  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || motion.matches || document.hidden) return;
    targetPitch = (event.clientY / window.innerHeight * 2 - 1) * 0.55;
    targetYaw = (event.clientX / window.innerWidth * 2 - 1) * 0.75;
    schedule();
  }, { passive: true, signal });
  window.addEventListener('resize', () => {
    updateSideOffset();
    if (pitch !== 0 || yaw !== 0) schedule();
  }, { signal });
  stage.addEventListener('pointerleave', reset, { signal });
  window.addEventListener('blur', reset, { signal });
  motion.addEventListener('change', reset, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); }, { signal });

  return () => {
    cancelAnimationFrame(frame);
    clearTilt();
  };
}

function initializeHomeDashboard(): void {
  cleanup?.();
  cleanup = undefined;
  const stage = document.querySelector<HTMLElement>('[data-home-stage]');
  if (!stage) return;
  const controller = new AbortController();
  const { signal } = controller;
  const clock = stage.querySelector<HTMLTimeElement>('[data-home-clock]')!;
  const digits = [...clock.querySelectorAll<HTMLElement>('[data-clock-digit]')];
  const levelBadge = stage.querySelector<HTMLElement>('[data-home-level]')!;
  const levelNumber = stage.querySelector<HTMLElement>('[data-level-number]')!;
  const levelRing = stage.querySelector<SVGCircleElement>('[data-level-progress]')!;
  const quote = stage.querySelector<HTMLElement>('[data-home-quote]')!;
  const quoteText = quote.querySelector<HTMLElement>('[data-quote-text]')!;
  const quoteSource = quote.querySelector<HTMLElement>('[data-quote-source]')!;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stopPanelMotion = initializePanelMotion(stage, motion, signal);
  const allQuoteIndices = Array.from({ length: HOME_QUOTES.length }, (_, index) => index);
  let quoteIndex = HOME_QUOTES.findIndex(({ text, source }) =>
    quoteText.textContent === text && quoteSource.textContent === `— ${source}`);
  if (quoteIndex < 0) {
    quoteIndex = 0;
    quoteText.textContent = HOME_QUOTES[0].text;
    quoteSource.textContent = `— ${HOME_QUOTES[0].source}`;
  }
  fitQuoteText(quoteText, quoteSource);
  let quoteOrder = shuffleQuoteOrder(allQuoteIndices.filter((index) => index !== quoteIndex));
  let animation: Animation | undefined;
  let quoteTimer: number | undefined;
  let displayedLevelDay = '';

  const updateLevel = (now: Date): void => {
    const { level, elapsedDays, yearDays, progress } = getHomeLevel(now);
    const levelDay = `${level}:${elapsedDays}`;
    if (levelDay === displayedLevelDay) return;
    displayedLevelDay = levelDay;
    const percent = Number((progress * 100).toFixed(2));
    const description = `${level} 岁；年度进度 ${percent}%，已过 ${elapsedDays} / ${yearDays} 天（北京时间）`;
    levelNumber.textContent = String(level);
    levelRing.setAttribute('stroke-dashoffset', String(100 * (1 - progress)));
    levelBadge.setAttribute('aria-valuenow', String(percent));
    levelBadge.setAttribute('aria-valuetext', description);
    levelBadge.title = description;
  };

  const updateClock = (): void => {
    const now = new Date();
    updateLevel(now);
    const pad = (value: number) => String(value).padStart(2, '0');
    const text = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    clock.dateTime = now.toISOString();
    clock.setAttribute('aria-label', text);
    const numbers = text.replace(/\D/g, '');
    digits.forEach((digit, index) => {
      if (digit.textContent !== numbers[index]) digit.textContent = numbers[index];
    });
  };

  const scheduleQuote = (): void => {
    window.clearTimeout(quoteTimer);
    if (HOME_QUOTES.length > 1 && !document.hidden) {
      quoteTimer = window.setTimeout(nextQuote, HOME_QUOTE_INTERVAL);
    }
  };
  const nextQuote = (): void => {
    animation?.cancel();
    if (quoteOrder.length === 0) {
      quoteOrder = shuffleQuoteOrder(allQuoteIndices, quoteIndex);
    }
    quoteIndex = quoteOrder.shift() ?? quoteIndex;
    const next = HOME_QUOTES[quoteIndex];
    quoteText.textContent = next.text;
    quoteSource.textContent = `— ${next.source}`;
    fitQuoteText(quoteText, quoteSource);
    if (!motion.matches) {
      animation = quoteText.animate([
        { transform: 'translateY(100%)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ], { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)' });
    }
    scheduleQuote();
  };

  document.addEventListener('visibilitychange', () => {
    updateClock();
    scheduleQuote();
  }, { signal });
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    animation?.cancel();
  }, { signal });

  scheduleQuote();
  updateClock();
  const clockTimer = window.setInterval(() => { if (!document.hidden) updateClock(); }, 1000);
  cleanup = () => {
    controller.abort();
    stopPanelMotion();
    window.clearInterval(clockTimer);
    window.clearTimeout(quoteTimer);
    animation?.cancel();
  };
}

document.addEventListener('astro:page-load', initializeHomeDashboard);
document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
window.addEventListener('pagehide', () => { cleanup?.(); cleanup = undefined; });
window.addEventListener('pageshow', (event) => { if (event.persisted) initializeHomeDashboard(); });

// 首次进入页面时在 DOMContentLoaded 就立即刷新时钟和等级，
// 不等 View Transitions 的 astro:page-load，消除"—"占位闪烁。
function earlyClockUpdate(): void {
  const stage = document.querySelector<HTMLElement>('[data-home-stage]');
  if (!stage) return;
  const clock = stage.querySelector<HTMLTimeElement>('[data-home-clock]');
  const digits = clock ? [...clock.querySelectorAll<HTMLElement>('[data-clock-digit]')] : [];
  const levelBadge = stage.querySelector<HTMLElement>('[data-home-level]');
  const levelNumber = stage.querySelector<HTMLElement>('[data-level-number]');
  const levelRing = stage.querySelector<SVGCircleElement>('[data-level-progress]');
  if (!clock || !levelBadge || !levelNumber || !levelRing) return;
  const now = new Date();
  const { level, elapsedDays, yearDays, progress } = getHomeLevel(now);
  const percent = Number((progress * 100).toFixed(2));
  levelNumber.textContent = String(level);
  levelRing.setAttribute('stroke-dashoffset', String(100 * (1 - progress)));
  levelBadge.setAttribute('aria-valuenow', String(percent));
  levelBadge.setAttribute('aria-valuetext', `${level} 岁；年度进度 ${percent}%，已过 ${elapsedDays} / ${yearDays} 天（北京时间）`);
  const pad = (v: number) => String(v).padStart(2, '0');
  const text = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  clock.dateTime = now.toISOString();
  clock.setAttribute('aria-label', text);
  const numbers = text.replace(/\D/g, '');
  digits.forEach((digit, i) => { digit.textContent = numbers[i] ?? ''; });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', earlyClockUpdate, { once: true });
} else {
  earlyClockUpdate();
}
