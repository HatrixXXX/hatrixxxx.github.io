import { createAnimatable } from 'animejs';

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
  let transitionFrame = 0;
  let restoreFrame = 0;

  const scrollDepth = () => {
    const atPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    return atPageEnd
      ? body.offsetHeight
      : Math.max(0, Math.min(body.offsetHeight, window.innerHeight * 0.76 - body.getBoundingClientRect().top));
  };

  const flow = { depth: scrollDepth() };
  let flowMotion: ReturnType<typeof createAnimatable> | null = null;

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
      const revealed = visibleDepth >= junctions[index];
      if (!revealed) {
        delete entry.dataset.connectFlash;
      } else if (entry.dataset.revealed === 'false' && body.dataset.transitions === 'on' && !document.hidden) {
        entry.dataset.connectFlash = 'true';
      }
      entry.dataset.revealed = revealed ? 'true' : 'false';
    });
  };

  const schedule = () => {
    if (motionPreference.matches || document.hidden) return;
    flowMotion?.depth(scrollDepth());
  };

  const onMotionChange = () => {
    if (transitionFrame) window.cancelAnimationFrame(transitionFrame);
    transitionFrame = 0;
    flowMotion?.revert();
    flowMotion = null;
    body.dataset.transitions = 'off';
    body.dataset.motion = motionPreference.matches ? 'reduced' : 'active';
    entries.forEach((entry) => { delete entry.dataset.connectFlash; });
    flow.depth = scrollDepth();
    paint(flow.depth);
    if (!motionPreference.matches) {
      flowMotion = createAnimatable(flow, { depth: { duration: 180, ease: 'outCubic' } });
      flowMotion.animations.depth.onRender = () => paint(flow.depth);
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
    flowMotion?.revert();
    if (transitionFrame) window.cancelAnimationFrame(transitionFrame);
    if (restoreFrame) window.cancelAnimationFrame(restoreFrame);
  };
}

document.addEventListener('astro:page-load', initSnippetsTimeline);
document.addEventListener('hatrix:protected-content-ready', initSnippetsTimeline);
document.addEventListener('astro:before-swap', () => stopTimeline?.());
initSnippetsTimeline();
