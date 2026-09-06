export const LOADING_DELAY = 120;
export const MINIMUM_VISIBLE_DURATION = 360;
export const HOMEPAGE_REVEAL_START_DELAY = 1000;
export const HOMEPAGE_REVEAL_DURATION = 500;
export const HOMEPAGE_REVEAL_PHASE_DURATION = 2000;
export const HOMEPAGE_COLLAPSE_DURATION = 1000;

export function isHomepageDestination(destination: unknown): boolean {
  if (destination instanceof URL) return destination.pathname === '/';
  if (typeof destination === 'string') {
    if (destination === '/') return true;
    try {
      const base = typeof window === 'undefined' ? 'https://localhost/' : window.location.href;
      return new URL(destination, base).pathname === '/';
    } catch {
      return false;
    }
  }
  if (destination && typeof destination === 'object' && 'pathname' in destination) {
    return String((destination as { pathname?: unknown }).pathname) === '/';
  }
  return false;
}

interface LoadingControllerOptions {
  now?: () => number;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
  show?: (homepageSequence?: boolean) => void;
  finishAnimation?: () => void;
  hide?: () => void;
}

export interface LoadingController {
  start: (immediate?: boolean) => void;
  finish: () => void;
  fail: () => void;
  destroy: () => void;
}

export function createLoadingController(options: LoadingControllerOptions = {}): LoadingController {
  const now = options.now ?? (() => Date.now());
  const schedule = options.setTimeout ?? globalThis.setTimeout;
  const cancel = options.clearTimeout ?? globalThis.clearTimeout;
  const show = options.show ?? (() => undefined);
  const finishAnimation = options.finishAnimation ?? (() => undefined);
  const hide = options.hide ?? (() => undefined);

  let pendingShow: ReturnType<typeof setTimeout> | undefined;
  let pendingFinish: ReturnType<typeof setTimeout> | undefined;
  let pendingHide: ReturnType<typeof setTimeout> | undefined;
  let visibleAt: number | undefined;
  let active = false;
  let finishing = false;
  let homepageSequence = false;

  const clearTimers = () => {
    if (pendingShow !== undefined) cancel(pendingShow);
    if (pendingFinish !== undefined) cancel(pendingFinish);
    if (pendingHide !== undefined) cancel(pendingHide);
    pendingShow = undefined;
    pendingFinish = undefined;
    pendingHide = undefined;
  };

  const hideNow = () => {
    clearTimers();
    visibleAt = undefined;
    active = false;
    finishing = false;
    homepageSequence = false;
    hide();
  };

  const finish = () => {
    if (!active || finishing) return;

    active = false;
    if (visibleAt === undefined) {
      hideNow();
      return;
    }

    finishing = true;

    if (homepageSequence) {
      const finishAfterReveal = () => {
        pendingFinish = undefined;
        if (!finishing) return;
        active = false;
        finishAnimation();
        pendingHide = schedule(hideNow, HOMEPAGE_COLLAPSE_DURATION);
      };
      const revealRemaining = Math.max(0, HOMEPAGE_REVEAL_PHASE_DURATION - (now() - visibleAt));
      pendingFinish = schedule(finishAfterReveal, revealRemaining);
      return;
    }

    finishAnimation();

    const remaining = Math.max(0, MINIMUM_VISIBLE_DURATION - (now() - visibleAt));
    pendingHide = schedule(hideNow, remaining);
  };

  const start = (immediate = false) => {
    clearTimers();
    active = true;
    finishing = false;
    homepageSequence = immediate;

    // A second navigation can begin while the previous overlay is collapsing.
    // Re-enter the visible phase immediately and reset its minimum-visible clock.
    if (immediate || visibleAt !== undefined) {
      visibleAt = now();
      show(homepageSequence);
      return;
    }

    pendingShow = schedule(() => {
      pendingShow = undefined;
      if (!active) return;
      visibleAt = now();
      show(false);
    }, LOADING_DELAY);
  };

  return {
    start,
    finish,
    fail: finish,
    destroy: () => {
      clearTimers();
      active = false;
      finishing = false;
      visibleAt = undefined;
    }
  };
}

function getOverlay(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-loading-overlay]');
}

function setOverlayState(state: 'loading' | 'finishing' | 'hidden') {
  const overlay = getOverlay();
  if (!overlay) return;
  overlay.dataset.loadingState = state;
  overlay.setAttribute('aria-busy', state !== 'hidden' ? 'true' : 'false');
}

function initializeLoadingOverlay() {
  if (typeof document === 'undefined') return;

  const controller = createLoadingController({
    show: (homepageSequence) => {
      const overlay = getOverlay();
      if (overlay) overlay.dataset.loadingHomepage = homepageSequence ? 'true' : 'false';
      setOverlayState('loading');
    },
    finishAnimation: () => setOverlayState('finishing'),
    hide: () => setOverlayState('hidden')
  });

  controller.start();
  document.addEventListener('astro:before-preparation', (event) => {
    const destination = (event as Event & { to?: URL }).to;
    controller.start(isHomepageDestination(destination));
    const signal = (event as Event & { signal?: AbortSignal }).signal;
    signal?.addEventListener('abort', controller.fail, { once: true });
  });
  document.addEventListener('astro:after-swap', controller.finish);
  document.addEventListener('astro:page-load', controller.finish);
  window.addEventListener('load', controller.finish, { once: true });
  window.addEventListener('pagehide', controller.destroy, { once: true });
}

initializeLoadingOverlay();
