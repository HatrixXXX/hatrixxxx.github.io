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
  const row = element.closest<HTMLElement>('.quote-row')!;
  const availableWidth = row.clientWidth - Number.parseFloat(getComputedStyle(row).columnGap) - 4;
  const requiredWidth = element.scrollWidth + source.scrollWidth;
  const fittedSize = availableWidth === 0 || requiredWidth <= availableWidth
    ? QUOTE_MAX_FONT_SIZE
    : Math.max(QUOTE_MIN_FONT_SIZE, QUOTE_MAX_FONT_SIZE * availableWidth / requiredWidth);
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

function initializeLevelSpin(stage: HTMLElement, motion: MediaQueryList, signal: AbortSignal): () => void {
  const button = stage.querySelector<HTMLButtonElement>('[data-level-impulse]')!;
  const wheels = [
    stage.querySelector<SVGGElement>('.level-tick-wheel')!,
    stage.querySelector<SVGGElement>('.level-armor-wheel')!,
  ];
  const pushRates = [120, 190];
  const maxChargeMs = 3_000;
  const haloSpreadMs = 900;
  let animations: Animation[] = [];
  let energy = 0;
  let initialEnergy = 0;
  let releaseGlow = 0;
  let frame = 0;
  let lastTime = 0;
  let highlightTimer = 0;
  let chargeFrame = 0;
  let chargeStart = 0;
  let pressSource: 'pointer' | 'keyboard' | undefined;
  let pointerId = -1;
  let ignoreKeyboardClick = false;

  const stop = (): void => {
    cancelAnimationFrame(frame);
    frame = 0;
    energy = 0;
    window.clearTimeout(highlightTimer);
    highlightTimer = 0;
    animations.forEach((animation) => animation.updatePlaybackRate(1));
    animations = [];
    button.removeAttribute('data-impulsing');
    button.style.removeProperty('--impulse-strength');
    button.style.removeProperty('--release-glow');
    button.style.removeProperty('--release-spread');
  };
  const cancelCharge = (): void => {
    cancelAnimationFrame(chargeFrame);
    chargeFrame = 0;
    pressSource = undefined;
    pointerId = -1;
    button.removeAttribute('data-charging');
    button.removeAttribute('data-charge-full');
    button.style.removeProperty('--charge');
    button.style.removeProperty('--charge-spread');
    button.style.removeProperty('--charge-glow');
  };
  const updateCharge = (time: number): void => {
    chargeFrame = 0;
    if (!pressSource) return;
    const progress = Math.min((time - chargeStart) / maxChargeMs, 1);
    button.style.setProperty('--charge', String(progress));
    button.style.setProperty('--charge-spread', String(Math.min((time - chargeStart) / haloSpreadMs, 1)));
    button.style.setProperty('--charge-glow', String(1 - (1 - progress) ** 3));
    if (progress >= 1) button.setAttribute('data-charge-full', '');
    else chargeFrame = requestAnimationFrame(updateCharge);
  };
  const step = (time: number): void => {
    frame = 0;
    energy *= Math.exp(-Math.min(time - lastTime, 64) / 780);
    lastTime = time;
    if (energy < 0.001 || motion.matches || document.hidden) {
      stop();
      return;
    }
    button.style.setProperty('--impulse-strength', String(energy / initialEnergy));
    button.style.setProperty('--release-glow', String(releaseGlow * energy / initialEnergy));
    animations.forEach((animation, index) => animation.updatePlaybackRate(1 + pushRates[index] * energy));
    frame = requestAnimationFrame(step);
  };
  const push = (force: number, glow = 0): void => {
    window.clearTimeout(highlightTimer);
    highlightTimer = 0;
    button.setAttribute('data-impulsing', '');
    initialEnergy = force;
    releaseGlow = glow;
    button.style.setProperty('--impulse-strength', '1');
    button.style.setProperty('--release-glow', String(glow));
    if (motion.matches) {
      highlightTimer = window.setTimeout(stop, 320);
      return;
    }
    animations = wheels.map((wheel) => wheel.getAnimations()[0]).filter((animation): animation is Animation => !!animation);
    if (animations.length !== wheels.length) {
      highlightTimer = window.setTimeout(stop, 320);
      return;
    }
    energy = force;
    animations.forEach((animation, index) => animation.updatePlaybackRate(1 + pushRates[index] * energy));
    lastTime = performance.now();
    if (!frame) frame = requestAnimationFrame(step);
  };
  const beginCharge = (source: 'pointer' | 'keyboard'): void => {
    if (pressSource) return;
    pressSource = source;
    chargeStart = performance.now();
    button.style.setProperty('--charge', '0');
    button.style.setProperty('--charge-spread', '0');
    button.style.setProperty('--charge-glow', '0');
    button.setAttribute('data-charging', '');
    chargeFrame = requestAnimationFrame(updateCharge);
  };
  const releaseCharge = (source: 'pointer' | 'keyboard'): void => {
    if (pressSource !== source) return;
    const progress = Math.min((performance.now() - chargeStart) / maxChargeMs, 1);
    const glow = Number(getComputedStyle(button, '::before').opacity);
    const spread = button.style.getPropertyValue('--charge-spread');
    cancelCharge();
    button.style.setProperty('--release-spread', spread);
    push(0.25 + progress, glow);
  };
  button.disabled = false;
  button.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (pressSource) return;
    beginCharge('pointer');
    pointerId = event.pointerId;
    button.setPointerCapture(event.pointerId);
  }, { signal });
  button.addEventListener('pointerup', (event) => {
    if (event.pointerId === pointerId) releaseCharge('pointer');
  }, { signal });
  button.addEventListener('pointercancel', () => {
    if (pressSource === 'pointer') cancelCharge();
  }, { signal });
  button.addEventListener('lostpointercapture', () => {
    if (pressSource === 'pointer') cancelCharge();
  }, { signal });
  button.addEventListener('keydown', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) beginCharge('keyboard');
  }, { signal });
  button.addEventListener('keyup', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (pressSource !== 'keyboard') return;
    releaseCharge('keyboard');
    ignoreKeyboardClick = true;
    window.setTimeout(() => { ignoreKeyboardClick = false; }, 0);
  }, { signal });
  button.addEventListener('click', (event) => {
    if (event.detail !== 0 || ignoreKeyboardClick || pressSource) return;
    push(0.25);
  }, { signal });
  button.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
  button.addEventListener('blur', () => {
    if (pressSource === 'keyboard') cancelCharge();
  }, { signal });
  motion.addEventListener('change', () => { if (motion.matches) stop(); }, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelCharge();
      stop();
    }
  }, { signal });
  return () => {
    cancelCharge();
    stop();
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
  quote.removeAttribute('disabled');
  const quoteText = quote.querySelector<HTMLElement>('[data-quote-text]')!;
  const quoteSource = quote.querySelector<HTMLElement>('[data-quote-source]')!;
  const quoteAnnouncement = stage.querySelector<HTMLElement>('[data-quote-announcement]')!;
  const fitQuote = (): void => {
    quoteSource.style.width = '';
    fitQuoteText(quoteText, quoteSource);
  };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stopPanelMotion = initializePanelMotion(stage, motion, signal);
  const stopLevelSpin = initializeLevelSpin(stage, motion, signal);
  const allQuoteIndices = Array.from({ length: HOME_QUOTES.length }, (_, index) => index);
  let quoteIndex = HOME_QUOTES.findIndex(({ text, source }) =>
    quoteText.textContent === text && quoteSource.textContent === `— ${source}`);
  if (quoteIndex < 0) {
    quoteIndex = 0;
    quoteText.textContent = HOME_QUOTES[0].text;
    quoteSource.textContent = `— ${HOME_QUOTES[0].source}`;
  }
  fitQuote();
  let quoteOrder = shuffleQuoteOrder(allQuoteIndices.filter((index) => index !== quoteIndex));
  let typingTimer: number | undefined;
  let quoteTimer: number | undefined;
  let lastActivationAt = -Infinity;
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
    levelBadge.closest('button')?.setAttribute('aria-label', `${description}；按住最多 3 秒蓄力，松开推动圆环`);
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

  const queueTyping = (step: () => void, delay: number): void => {
    typingTimer = window.setTimeout(step, delay);
  };
  const showQuote = (index: number, initial = false): void => {
    window.clearTimeout(typingTimer);
    const next = HOME_QUOTES[index];
    const finish = (): void => {
      quote.removeAttribute('data-quote-phase');
      quote.dataset.quoteCursor = 'source';
      quoteAnnouncement.textContent = `${next.text}，出处：${next.source}`;
    };
    if (motion.matches || document.hidden) {
      quoteText.textContent = next.text;
      quoteSource.textContent = `— ${next.source}`;
      fitQuote();
      finish();
      return;
    }
    const type = (): void => {
      quoteSource.textContent = `— ${next.source}`;
      quoteText.textContent = next.text;
      fitQuote();
      quoteText.textContent = '';
      quoteSource.textContent = '';
      quote.dataset.quotePhase = 'typing';
      const typeInto = (element: HTMLElement, value: string, done: () => void): void => {
        const characters = Array.from(value);
        let position = 0;
        const step = (): void => {
          position += 1;
          element.textContent = characters.slice(0, position).join('');
          if (position < characters.length) queueTyping(step, 55);
          else done();
        };
        queueTyping(step, 55);
      };
      quote.dataset.quoteCursor = 'text';
      typeInto(quoteText, next.text, () => {
        quote.dataset.quoteCursor = 'source';
        typeInto(quoteSource, `— ${next.source}`, finish);
      });
    };
    if (initial) {
      type();
      return;
    }
    quote.dataset.quotePhase = 'deleting';
    const erase = (element: HTMLElement, done: () => void): void => {
      const characters = Array.from(element.textContent ?? '');
      if (characters.length === 0) {
        done();
        return;
      }
      characters.pop();
      element.textContent = characters.join('');
      queueTyping(() => erase(element, done), 18);
    };
    quote.dataset.quoteCursor = 'source';
    erase(quoteSource, () => {
      quote.dataset.quoteCursor = 'text';
      erase(quoteText, type);
    });
  };
  const scheduleQuote = (): void => {
    window.clearTimeout(quoteTimer);
    if (HOME_QUOTES.length > 1 && !document.hidden) quoteTimer = window.setTimeout(nextQuote, HOME_QUOTE_INTERVAL);
  };
  const nextQuote = (): void => {
    lastActivationAt = -Infinity;
    if (quoteOrder.length === 0) {
      quoteOrder = shuffleQuoteOrder(allQuoteIndices, quoteIndex);
    }
    quoteIndex = quoteOrder.shift() ?? quoteIndex;
    showQuote(quoteIndex);
    scheduleQuote();
  };

  quote.addEventListener('click', (event) => {
    if (quote.hasAttribute('data-quote-phase') || event.detail !== 0) return;
    const now = performance.now();
    if (now - lastActivationAt < 350) nextQuote();
    else lastActivationAt = now;
  }, { signal });
  quote.addEventListener('dblclick', () => {
    if (!quote.hasAttribute('data-quote-phase')) nextQuote();
  }, { signal });
  document.addEventListener('visibilitychange', () => {
    updateClock();
    if (document.hidden) showQuote(quoteIndex);
    scheduleQuote();
  }, { signal });
  motion.addEventListener('change', () => {
    if (motion.matches) showQuote(quoteIndex);
  }, { signal });

  showQuote(quoteIndex, true);
  scheduleQuote();
  updateClock();
  const clockTimer = window.setInterval(() => { if (!document.hidden) updateClock(); }, 1000);
  cleanup = () => {
    controller.abort();
    stopPanelMotion();
    stopLevelSpin();
    window.clearInterval(clockTimer);
    window.clearTimeout(quoteTimer);
    window.clearTimeout(typingTimer);
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
