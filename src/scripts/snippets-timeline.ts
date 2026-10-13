let stopTimeline: (() => void) | undefined;
const scrollKey = 'hatrix:snippets:scroll';
const returnKey = 'hatrix:snippets:return';

function initSnippetsTimeline() {
  stopTimeline?.();
  stopTimeline = undefined;

  const root = document.querySelector<HTMLElement>('[data-snippets-timeline]');
  const body = root?.querySelector<HTMLElement>('[data-timeline-body]');
  if (!body) return;

  let restoredPosition: number | null = null;
  try {
    if (sessionStorage.getItem(returnKey) === '1') {
      const saved = sessionStorage.getItem(scrollKey);
      sessionStorage.removeItem(returnKey);
      sessionStorage.removeItem(scrollKey);
      if (saved !== null && Number.isFinite(Number(saved))) {
        restoredPosition = Number(saved);
        window.scrollTo({ top: restoredPosition, behavior: 'instant' });
      }
    }
  } catch { /* Storage may be unavailable; the link still works. */ }

  const entries = [...body.querySelectorAll<HTMLElement>('[data-timeline-entry]')];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const { signal } = controller;
  let frame = 0;
  let transitionFrame = 0;
  let restoreFrame = 0;
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
      entry.dataset.revealed = visibleDepth >= junctions[index] ? 'true' : 'false';
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
    if (transitionFrame) window.cancelAnimationFrame(transitionFrame);
    frame = 0;
    transitionFrame = 0;
    lastFrame = 0;
    body.dataset.transitions = 'off';
    body.dataset.motion = motionPreference.matches ? 'reduced' : 'active';
    renderedDepth = scrollDepth();
    paint(renderedDepth);
    if (!motionPreference.matches) {
      transitionFrame = window.requestAnimationFrame(() => {
        transitionFrame = 0;
        if (!signal.aborted) body.dataset.transitions = 'on';
      });
    }
  };

  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', schedule, { passive: true, signal });
  root?.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.snippet-card')) return;
    try { sessionStorage.setItem(scrollKey, String(window.scrollY)); } catch { /* Navigation still works. */ }
  }, { signal });
  body.addEventListener('focusin', (event) => {
    const entry = (event.target as Element).closest<HTMLElement>('[data-timeline-entry]');
    entry?.scrollIntoView({ block: 'center', behavior: motionPreference.matches ? 'instant' : 'smooth' });
    schedule();
  }, { signal });
  body.addEventListener('focusout', schedule, { signal });
  motionPreference.addEventListener('change', onMotionChange, { signal });
  document.addEventListener('visibilitychange', () => {
    body.dataset.paused = document.hidden ? 'true' : 'false';
    if (!document.hidden) onMotionChange();
  }, { signal });
  onMotionChange();
  if (restoredPosition !== null) {
    const position = restoredPosition;
    restoreFrame = window.requestAnimationFrame(() => {
      restoreFrame = 0;
      if (!signal.aborted && window.scrollY === 0 && position > 0) {
        window.scrollTo({ top: position, behavior: 'instant' });
        onMotionChange();
      }
    });
  }

  stopTimeline = () => {
    controller.abort();
    if (frame) window.cancelAnimationFrame(frame);
    if (transitionFrame) window.cancelAnimationFrame(transitionFrame);
    if (restoreFrame) window.cancelAnimationFrame(restoreFrame);
  };
}

document.addEventListener('astro:page-load', initSnippetsTimeline);
document.addEventListener('astro:before-swap', () => stopTimeline?.());
initSnippetsTimeline();
