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

  document.addEventListener('visibilitychange', () => { updateClock(); }, { signal });

  updateClock();
  const clockTimer = window.setInterval(() => { if (!document.hidden) updateClock(); }, 1000);
  cleanup = () => {
    controller.abort();
    window.clearInterval(clockTimer);
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
