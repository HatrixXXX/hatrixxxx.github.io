import { changedDigitIndexes, formatClockTime, pointsForClock } from '@/lib/dot-clock';

const PARTICLE_COLORS = ['#67e8f9', '#a78bfa', '#f472b6', '#facc15'] as const;
const MAX_PARTICLES = 360;
const DAY_MS = 86_400_000;
const START_DAY_UTC = Date.UTC(2025, 1, 17);
const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
}

function runningDaysAt(now: Date): number {
  const parts = shanghaiDate.formatToParts(now);
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const currentDay = Date.UTC(number('year'), number('month') - 1, number('day'));
  return Math.max(0, Math.floor((currentDay - START_DAY_UTC) / DAY_MS) + 1);
}

function visitorValue(): string | null {
  const value = document.querySelector<HTMLElement>('[data-visitor-count-source]')
    ?.textContent?.trim();
  return value && value !== 'Loading' ? value : null;
}

function synchronizeVisitorCount(): void {
  const value = visitorValue();
  if (!value) return;
  document.querySelectorAll<HTMLElement>('[data-visitor-count]').forEach((node) => {
    node.textContent = value;
  });
}

function bindVisitorSource(): void {
  const source = document.querySelector<HTMLElement>('[data-visitor-count-source]');
  if (!source || source.dataset.visitorCountBound === 'true') return;
  source.dataset.visitorCountBound = 'true';
  new MutationObserver(synchronizeVisitorCount).observe(source, {
    characterData: true,
    childList: true,
    subtree: true
  });
}

function bindSiteStats(root: HTMLElement): void {
  if (root.dataset.siteStatsBound === 'true') return;

  const runningDays = root.querySelector<HTMLElement>(
    '[data-running-days], [data-stat="running-days"]'
  );
  const visitors = root.querySelector<HTMLElement>(
    '[data-visitor-count], [data-stat="visitors"]'
  );
  const time = root.querySelector<HTMLTimeElement>('[data-clock-text]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-dot-clock]');
  if (!runningDays || !visitors || !time || !canvas) return;
  runningDays.setAttribute('data-running-days', '');
  visitors.setAttribute('data-visitor-count', '');

  const context = canvas.getContext('2d');
  if (!context) return;
  root.dataset.siteStatsBound = 'true';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let currentTime = formatClockTime(new Date());
  let particles: Particle[] = [];
  let animationFrame = 0;
  let previousFrame = 0;

  const pointPosition = (x: number, y: number): [number, number, number] => {
    const spacing = Math.max(2, Math.min((width - 16) / 39, (height - 12) / 6));
    const clockWidth = 39 * spacing;
    const clockHeight = 6 * spacing;
    return [
      (width - clockWidth) / 2 + x * spacing,
      (height - clockHeight) / 2 + y * spacing,
      Math.max(1.25, spacing * 0.2)
    ];
  };

  const draw = (): void => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = getComputedStyle(root).getPropertyValue('--color-accent').trim() || '#67e8f9';
    for (const point of pointsForClock(currentTime)) {
      const [x, y, radius] = pointPosition(point.x, point.y);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    for (const particle of particles) {
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
  };

  const setParticleState = (): void => {
    if (particles.length > 0) canvas.dataset.clockParticles = 'active';
    else canvas.removeAttribute('data-clock-particles');
  };

  const animate = (timestamp: number): void => {
    if (document.hidden || reducedMotion.matches || !root.isConnected) {
      animationFrame = 0;
      return;
    }
    const elapsed = previousFrame ? Math.min((timestamp - previousFrame) / 1_000, 0.05) : 0;
    previousFrame = timestamp;
    for (const particle of particles) {
      particle.x += particle.vx * elapsed;
      particle.y += particle.vy * elapsed;
      particle.vy += 110 * elapsed;
    }
    particles = particles.filter(
      ({ x, y, radius }) =>
        x + radius >= 0 && x - radius <= width && y + radius >= 0 && y - radius <= height
    );
    setParticleState();
    draw();
    animationFrame = particles.length > 0 ? requestAnimationFrame(animate) : 0;
  };

  const startAnimation = (): void => {
    if (animationFrame || particles.length === 0) return;
    previousFrame = 0;
    setParticleState();
    animationFrame = requestAnimationFrame(animate);
  };

  const addParticles = (previous: string, next: string): void => {
    if (reducedMotion.matches || document.hidden) return;
    const changed = new Set(changedDigitIndexes(previous, next));
    const created = pointsForClock(previous)
      .filter(({ characterIndex }) => changed.has(characterIndex))
      .map(({ x, y }, index): Particle => {
        const [particleX, particleY, radius] = pointPosition(x, y);
        return {
          x: particleX,
          y: particleY,
          vx: (Math.random() - 0.5) * 90,
          vy: -25 - Math.random() * 35,
          color: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
          radius
        };
      });
    particles = [...particles, ...created].slice(-MAX_PARTICLES);
    startAnimation();
  };

  const render = (now: Date, animateChanges: boolean): void => {
    const nextTime = formatClockTime(now);
    if (animateChanges && nextTime !== currentTime) addParticles(currentTime, nextTime);
    currentTime = nextTime;
    time.textContent = nextTime;
    time.dateTime = now.toISOString();
    runningDays.textContent = String(runningDaysAt(now));
    draw();
  };

  const resize = (): void => {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = bounds.width;
    const nextHeight = bounds.height;
    const pixelRatio = window.devicePixelRatio || 1;
    const backingWidth = Math.max(1, Math.round(nextWidth * pixelRatio));
    const backingHeight = Math.max(1, Math.round(nextHeight * pixelRatio));
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
    width = nextWidth;
    height = nextHeight;
    draw();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const clearParticles = (): void => {
    particles = [];
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    previousFrame = 0;
    setParticleState();
  };

  const handleVisibility = (): void => {
    clearParticles();
    if (!document.hidden) render(new Date(), false);
  };

  const handleMotionPreference = (): void => {
    if (reducedMotion.matches) clearParticles();
    draw();
  };

  const cleanup = (): void => {
    clearInterval(timer);
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', handleVisibility);
    reducedMotion.removeEventListener('change', handleMotionPreference);
    clearParticles();
  };

  resize();
  render(new Date(), false);
  document.addEventListener('visibilitychange', handleVisibility);
  reducedMotion.addEventListener('change', handleMotionPreference);
  const timer = window.setInterval(() => {
    if (!root.isConnected) {
      cleanup();
      return;
    }
    if (!document.hidden) render(new Date(), true);
  }, 1_000);
}

export function initializeSiteStats(): void {
  bindVisitorSource();
  document.querySelectorAll<HTMLElement>('[data-site-stats]').forEach(bindSiteStats);
  synchronizeVisitorCount();
}

document.addEventListener('astro:page-load', initializeSiteStats);
initializeSiteStats();
