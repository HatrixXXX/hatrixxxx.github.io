let stopTimeline: (() => void) | undefined;

function initSnippetsTimeline() {
  stopTimeline?.();
  stopTimeline = undefined;

  const root = document.querySelector<HTMLElement>('[data-snippets-timeline]');
  const body = root?.querySelector<HTMLElement>('[data-timeline-body]');
  if (!body) return;

  const entries = [...body.querySelectorAll<HTMLElement>('[data-timeline-entry]')];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const { signal } = controller;
  let frame = 0;
  let lastFrame = 0;
  let renderedDepth = 0;

  const scrollDepth = () => {
    const atPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    return atPageEnd
      ? body.offsetHeight
      : Math.max(0, Math.min(body.offsetHeight, window.innerHeight * 0.76 - body.getBoundingClientRect().top));
  };

  const paint = (depth: number) => {
    const height = body.offsetHeight;
    const visibleDepth = Math.max(0, Math.min(height, depth));
    const bodyTop = body.getBoundingClientRect().top;
    const junctions = entries.map((entry) =>
      entry.getBoundingClientRect().top - bodyTop + entry.offsetHeight / 2
    );

    body.style.setProperty('--flow-length', `${visibleDepth.toFixed(1)}px`);
    body.style.setProperty('--flow-progress', String(height > 0 ? visibleDepth / height : 1));
    entries.forEach((entry, index) => {
      const distance = visibleDepth - junctions[index];
      const focused = entry.matches(':focus-within');
      const branch = index === 0 || focused || distance >= 0 ? 1 : 0;
      const card = index === 0 || focused || distance >= 100 ? 1 : 0;
      entry.style.setProperty('--branch-progress', String(branch));
      entry.style.setProperty('--card-mask', card ? '0%' : '100%');
      entry.style.setProperty('--content-opacity', String(card));
    });
  };

  const tick = (now: number) => {
    const target = scrollDepth();
    const elapsed = lastFrame ? Math.min(now - lastFrame, 64) : 16;
    lastFrame = now;
    renderedDepth += (target - renderedDepth) * (1 - Math.exp(-elapsed / 90));
    if (Math.abs(target - renderedDepth) < 0.4) renderedDepth = target;
    paint(renderedDepth);
    if (renderedDepth !== target) {
      frame = window.requestAnimationFrame(tick);
    } else {
      frame = 0;
      lastFrame = 0;
    }
  };

  const schedule = () => {
    if (motionPreference.matches || frame) return;
    frame = window.requestAnimationFrame(tick);
  };

  const onMotionChange = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    body.dataset.motion = motionPreference.matches ? 'reduced' : 'active';
    renderedDepth = scrollDepth();
    paint(renderedDepth);
  };

  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', schedule, { passive: true, signal });
  body.addEventListener('focusin', schedule, { signal });
  body.addEventListener('focusout', schedule, { signal });
  motionPreference.addEventListener('change', onMotionChange, { signal });
  document.addEventListener('visibilitychange', () => {
    body.dataset.paused = document.hidden ? 'true' : 'false';
    if (!document.hidden) onMotionChange();
  }, { signal });
  onMotionChange();

  stopTimeline = () => {
    controller.abort();
    if (frame) window.cancelAnimationFrame(frame);
  };
}

document.addEventListener('astro:page-load', initSnippetsTimeline);
document.addEventListener('astro:before-swap', () => stopTimeline?.());
initSnippetsTimeline();
