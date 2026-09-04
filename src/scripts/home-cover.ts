import { prefetch } from 'astro:prefetch';
import { navigate } from 'astro:transitions/client';

const BLOG_PATH = '/blog/';
const TAGLINE = '轻松即单纯，速成即精准';
const TYPE_DELAY = 300;
const TYPE_SPEED = 150;
const DELETE_SPEED = 50;
const COMPLETE_HOLD = 700;
const REVEAL_DURATION = 620;
const RESET_DURATION = 320;
const VELOCITY_FRESHNESS = 120;
const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, summary, [contenteditable="true"], [role="button"], [role="link"]';

let cleanupCurrentPage: (() => void) | undefined;
let pendingReveal: { attempt: number; distance: number } | undefined;
let revealAttempt = 0;

function prefetchBlog(): void {
  try {
    prefetch(BLOG_PATH);
  } catch {
    // Prefetching is an optimization and must never gate navigation.
  }
}

function clearPendingReveal(): void {
  pendingReveal = undefined;
  if (document.documentElement.dataset.homeReveal === 'pending') {
    delete document.documentElement.dataset.homeReveal;
  }
}

function isHomeRevealNavigation(event: { to: URL; info?: unknown }): boolean {
  return (
    event.to.pathname === BLOG_PATH &&
    typeof event.info === 'object' &&
    event.info !== null &&
    'kind' in event.info &&
    event.info.kind === 'home-reveal'
  );
}

function prepareReveal(distance = 0): number {
  const attempt = ++revealAttempt;
  pendingReveal = {
    attempt,
    distance
  };
  document.documentElement.dataset.homeReveal = 'pending';
  return attempt;
}

function goToBlog(sourceElement: Element, distance = 0): void {
  const attempt = prepareReveal(distance);
  void navigate(BLOG_PATH, { sourceElement, info: { kind: 'home-reveal' } }).catch(() => {
    if (pendingReveal?.attempt !== attempt) return;
    clearPendingReveal();
    location.assign(BLOG_PATH);
  });
}

function initializeHome(): void {
  cleanupCurrentPage?.();
  cleanupCurrentPage = undefined;

  const stage = document.querySelector<HTMLElement>('[data-home-stage]');
  const typing = document.querySelector<HTMLElement>('[data-home-typing]');
  if (!stage || !typing || document.documentElement.dataset.pageKind !== 'home') return;

  const root = document.documentElement;
  const controller = new AbortController();
  const timers = new Set<number>();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const requestIdle = (
    window as unknown as {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    }
  ).requestIdleCallback;
  let idleHandle: number | undefined;
  let idleFallback: number | undefined;
  let resetTimer: number | undefined;
  let pointerId: number | undefined;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastTime = 0;
  let lastVelocity = 0;
  let lastVelocityTime = Number.NEGATIVE_INFINITY;
  let dragX = 0;
  let navigating = false;

  const setDragState = (state: 'idle' | 'dragging' | 'resetting' | 'committing'): void => {
    stage.dataset.homeDragState = state;
    root.dataset.homeDragState = state;
  };

  const schedule = (callback: () => void, delay: number): void => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const startTyping = (): void => {
    if (reducedMotion) {
      typing.textContent = TAGLINE;
      typing.dataset.homeTypingState = 'complete';
      return;
    }

    let length = 0;
    typing.textContent = '';
    typing.dataset.homeTypingState = 'typing';

    const typeNext = (): void => {
      length += 1;
      typing.textContent = TAGLINE.slice(0, length);
      if (length < TAGLINE.length) {
        schedule(typeNext, TYPE_SPEED);
        return;
      }

      typing.dataset.homeTypingState = 'complete';
      schedule(deleteNext, COMPLETE_HOLD);
    };

    const deleteNext = (): void => {
      length -= 1;
      typing.textContent = TAGLINE.slice(0, Math.max(length, 0));
      if (length > 0) {
        schedule(deleteNext, DELETE_SPEED);
        return;
      }

      typing.dataset.homeTypingState = 'typing';
      schedule(typeNext, TYPE_DELAY);
    };

    schedule(typeNext, TYPE_DELAY);
  };

  const releasePointer = (): void => {
    if (pointerId === undefined) return;
    const capturedPointer = pointerId;
    pointerId = undefined;
    if (root.hasPointerCapture(capturedPointer)) root.releasePointerCapture(capturedPointer);
  };

  const resetDrag = (): void => {
    releasePointer();
    dragX = 0;
    root.style.setProperty('--home-drag-x', '0px');
    if (reducedMotion) {
      setDragState('idle');
      root.style.removeProperty('--home-drag-x');
      return;
    }

    setDragState('resetting');
    if (resetTimer !== undefined) window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      resetTimer = undefined;
      setDragState('idle');
      root.style.removeProperty('--home-drag-x');
    }, RESET_DURATION);
  };

  const finishDrag = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    const distance = Math.max(-dragX, 0);
    const velocityIsFresh = event.timeStamp - lastVelocityTime <= VELOCITY_FRESHNESS;
    const shouldNavigate =
      distance >= innerWidth * 0.16 ||
      (velocityIsFresh && lastVelocity >= 0.7 && distance >= 48);
    releasePointer();

    if (!shouldNavigate) {
      resetDrag();
      return;
    }

    navigating = true;
    setDragState('committing');
    goToBlog(stage, distance);
  };

  stage.addEventListener(
    'pointerdown',
    (event) => {
      if (
        navigating ||
        event.button !== 0 ||
        !event.isPrimary ||
        !(event.target instanceof Element) ||
        event.target.closest(INTERACTIVE_SELECTOR)
      ) {
        return;
      }

      event.preventDefault();
      prefetchBlog();
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      lastX = event.clientX;
      lastTime = event.timeStamp;
      lastVelocity = 0;
      lastVelocityTime = Number.NEGATIVE_INFINITY;
      dragX = 0;
      if (resetTimer !== undefined) {
        window.clearTimeout(resetTimer);
        resetTimer = undefined;
      }
      setDragState('dragging');
      root.setPointerCapture(event.pointerId);
    },
    { signal: controller.signal }
  );

  root.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId !== pointerId) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 12) {
        resetDrag();
        return;
      }

      const elapsed = event.timeStamp - lastTime;
      if (elapsed >= 8) {
        lastVelocity = Math.max((lastX - event.clientX) / elapsed, 0);
        lastVelocityTime = event.timeStamp;
        lastX = event.clientX;
        lastTime = event.timeStamp;
      }
      dragX = Math.min(deltaX, 0);
      if (!reducedMotion) root.style.setProperty('--home-drag-x', `${dragX}px`);
    },
    { signal: controller.signal }
  );

  root.addEventListener('pointerup', finishDrag, { signal: controller.signal });
  root.addEventListener(
    'pointercancel',
    (event) => {
      if (event.pointerId !== pointerId) return;
      resetDrag();
    },
    { signal: controller.signal }
  );
  window.addEventListener(
    'blur',
    () => {
      if (pointerId !== undefined) resetDrag();
    },
    { signal: controller.signal }
  );

  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-home-blog-link]')) {
    link.addEventListener('pointerenter', prefetchBlog, { signal: controller.signal });
    link.addEventListener('focus', prefetchBlog, { signal: controller.signal });
    link.addEventListener(
      'click',
      (event) => {
        if (
          navigating ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        navigating = true;
        goToBlog(link);
      },
      { signal: controller.signal }
    );
  }

  setDragState('idle');
  startTyping();
  if (requestIdle) {
    idleHandle = requestIdle(prefetchBlog, { timeout: 1200 });
  } else {
    idleFallback = window.setTimeout(prefetchBlog, 1200);
  }

  cleanupCurrentPage = () => {
    controller.abort();
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
    if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
    if (idleFallback !== undefined) window.clearTimeout(idleFallback);
    if (resetTimer !== undefined) window.clearTimeout(resetTimer);
    releasePointer();
    root.style.removeProperty('--home-drag-x');
    delete root.dataset.homeDragState;
  };
}

document.addEventListener('astro:before-preparation', (event) => {
  if (!isHomeRevealNavigation(event)) clearPendingReveal();
});

document.addEventListener('astro:before-swap', (event) => {
  cleanupCurrentPage?.();
  cleanupCurrentPage = undefined;

  if (!isHomeRevealNavigation(event)) {
    clearPendingReveal();
    return;
  }
  if (!pendingReveal) return;
  const { distance } = pendingReveal;
  pendingReveal = undefined;
  const newRoot = event.newDocument.documentElement;
  newRoot.dataset.homeReveal = 'active';
  newRoot.style.setProperty('--home-reveal-distance', `${distance}px`);
  newRoot.style.setProperty('--home-reveal-duration', `${REVEAL_DURATION}ms`);
  void event.viewTransition.finished.finally(() => {
    const currentRoot = document.documentElement;
    delete currentRoot.dataset.homeReveal;
    currentRoot.style.removeProperty('--home-reveal-distance');
    currentRoot.style.removeProperty('--home-reveal-duration');
  });
});

document.addEventListener('astro:page-load', initializeHome);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cleanupCurrentPage?.();
    cleanupCurrentPage = undefined;
  } else {
    initializeHome();
  }
});
window.addEventListener('pagehide', () => {
  cleanupCurrentPage?.();
  cleanupCurrentPage = undefined;
});
