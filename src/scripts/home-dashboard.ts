import { HOME_QUOTES, HOME_QUOTE_INTERVAL } from '@/data/home-quotes';
import { getHomeLevel } from '@/lib/home-level';

let cleanup: (() => void) | undefined;

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
  const quote = stage.querySelector<HTMLButtonElement>('[data-home-quote]')!;
  const quoteText = stage.querySelector<HTMLElement>('[data-quote-text]')!;
  const pause = stage.querySelector<HTMLButtonElement>('[data-quote-pause]')!;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let quoteIndex = 0;
  let paused = motion.matches;
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
  const syncPause = (): void => {
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? '恢复金句自动切换' : '暂停金句自动切换');
  };
  const scheduleQuote = (): void => {
    window.clearTimeout(quoteTimer);
    if (!paused && !document.hidden) quoteTimer = window.setTimeout(nextQuote, HOME_QUOTE_INTERVAL);
  };
  const nextQuote = (): void => {
    animation?.cancel();
    quoteIndex = (quoteIndex + 1) % HOME_QUOTES.length;
    quoteText.textContent = HOME_QUOTES[quoteIndex];
    quote.setAttribute('aria-label', `金句：${HOME_QUOTES[quoteIndex]}。双击切换；键盘按 Enter 或空格切换`);
    if (!motion.matches) {
      animation = quoteText.animate([
        { transform: 'translateY(100%)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 }
      ], { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)' });
    }
    scheduleQuote();
  };

  quote.addEventListener('dblclick', nextQuote, { signal });
  quote.addEventListener('click', (event) => { if (event.detail === 0) nextQuote(); }, { signal });
  pause.addEventListener('click', () => { paused = !paused; syncPause(); scheduleQuote(); }, { signal });
  document.addEventListener('visibilitychange', () => { updateClock(); scheduleQuote(); }, { signal });
  motion.addEventListener('change', () => {
    if (motion.matches) { animation?.cancel(); paused = true; syncPause(); scheduleQuote(); }
  }, { signal });

  updateClock();
  syncPause();
  scheduleQuote();
  const clockTimer = window.setInterval(() => { if (!document.hidden) updateClock(); }, 1000);
  cleanup = () => {
    controller.abort();
    window.clearInterval(clockTimer);
    window.clearTimeout(quoteTimer);
    animation?.cancel();
  };
}

document.addEventListener('astro:page-load', initializeHomeDashboard);
document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
window.addEventListener('pagehide', () => { cleanup?.(); cleanup = undefined; });
window.addEventListener('pageshow', (event) => { if (event.persisted) initializeHomeDashboard(); });
