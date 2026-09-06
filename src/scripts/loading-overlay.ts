export const LOADING_DELAY = 120;
export const MINIMUM_VISIBLE_DURATION = 360;

interface LoadingControllerOptions {
  now?: () => number;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
  show?: () => void;
  hide?: () => void;
}

export interface LoadingController {
  start: () => void;
  finish: () => void;
  fail: () => void;
  destroy: () => void;
}

export function createLoadingController(options: LoadingControllerOptions = {}): LoadingController {
  const now = options.now ?? (() => Date.now());
  const schedule = options.setTimeout ?? globalThis.setTimeout;
  const cancel = options.clearTimeout ?? globalThis.clearTimeout;
  const show = options.show ?? (() => undefined);
  const hide = options.hide ?? (() => undefined);

  let pendingShow: ReturnType<typeof setTimeout> | undefined;
  let pendingHide: ReturnType<typeof setTimeout> | undefined;
  let visibleAt: number | undefined;
  let active = false;

  const clearTimers = () => {
    if (pendingShow !== undefined) cancel(pendingShow);
    if (pendingHide !== undefined) cancel(pendingHide);
    pendingShow = undefined;
    pendingHide = undefined;
  };

  const hideNow = () => {
    clearTimers();
    visibleAt = undefined;
    active = false;
    hide();
  };

  const finish = () => {
    if (!active) {
      hide();
      return;
    }

    active = false;
    if (visibleAt === undefined) {
      hideNow();
      return;
    }

    const remaining = Math.max(0, MINIMUM_VISIBLE_DURATION - (now() - visibleAt));
    pendingHide = schedule(hideNow, remaining);
  };

  const start = () => {
    clearTimers();
    active = true;
    pendingShow = schedule(() => {
      pendingShow = undefined;
      if (!active) return;
      visibleAt = now();
      show();
    }, LOADING_DELAY);
  };

  return {
    start,
    finish,
    fail: finish,
    destroy: () => {
      clearTimers();
      active = false;
      visibleAt = undefined;
    }
  };
}

function getOverlay(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-loading-overlay]');
}

function setOverlayState(state: 'loading' | 'hidden') {
  const overlay = getOverlay();
  if (!overlay) return;
  overlay.dataset.loadingState = state;
  overlay.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

function initializeLoadingOverlay() {
  if (typeof document === 'undefined') return;

  const controller = createLoadingController({
    show: () => setOverlayState('loading'),
    hide: () => setOverlayState('hidden')
  });

  controller.start();
  document.addEventListener('astro:before-preparation', controller.start);
  document.addEventListener('astro:page-load', controller.finish);
  document.addEventListener('astro:navigation-error', controller.fail);
  window.addEventListener('pagehide', controller.destroy, { once: true });
}

initializeLoadingOverlay();
