/**
 * 全站页面加载遮罩（page-loader.ts）
 *
 * 架构说明
 * --------
 * PageLoader.astro 输出完整遮罩内容。首页首次硬导航由 head 内联脚本在首帧前
 * 标记 data-initial-page-loader，本脚本接管后改用 pl-visible class 控制显示。
 *
 * 触发规则
 * --------
 * - 首次硬导航到同会话内未访问过的页面显示圆环加载器。
 * - 同源 HTML 客户端跳转每次显示左右双瓣遮罩。
 * - 外部链接、非 HTML 目标（/rss.xml 等）不触发。
 * - 硬导航的访问记录存 sessionStorage，关标签重置。
 *
 * 时序
 * ----
 * VT 导航:
 *   astro:before-preparation → 两瓣闭合，与目标页请求并行
 *   闭合完成后交换页面；背景或首页资源就绪后两瓣展开
 *   导航中断时由 abort signal 收回遮罩
 *
 * 硬导航首次访问:
 *   astro:page-load → showLoader() + 快速跑满 → complete()
 *
 * 硬导航首页:
 *   head 同步标记 → 首帧显示 0% → DOMContentLoaded 接管并跑到 85%
 *   → waitHomeDone() → complete()
 *
 * 异常情况
 * --------
 * - 页面被导航到外部（RSS/锚点/下载）：visibilitychange + pageshow 检测到
 *   页面重新可见时若 pending 存在则立即 complete() 清理。
 * - The 8s deadline covers the player layout only; background, character, and fonts
 *   wait for readiness or a real load error before the homepage is revealed.
 */

const VISITED_KEY = 'hatrix-visited-pages';
const HOME_DEADLINE_MS = 8_000;
const SHUTTER_CLOSE_FALLBACK_MS = 540;

// ── 访问记录 ──────────────────────────────────────────────────────────────────

function getVisited(): string[] {
  try { return JSON.parse(sessionStorage.getItem(VISITED_KEY) ?? '[]') as string[]; }
  catch { return []; }
}
function markVisited(path: string): void {
  try {
    const v = getVisited();
    if (!v.includes(path)) { v.push(path); sessionStorage.setItem(VISITED_KEY, JSON.stringify(v)); }
  } catch { /* noop */ }
}
function hasVisited(path: string): boolean { return getVisited().includes(path); }

/** 判断目标是否是应该显示加载页的同源 HTML 页面 */
function isSameOriginPage(url: URL): boolean {
  if (url.origin !== location.origin) return false;
  // 排除明确的非 HTML 扩展名
  const ext = url.pathname.split('.').pop()?.toLowerCase() ?? '';
  const nonHtml = ['xml', 'json', 'txt', 'pdf', 'zip', 'png', 'jpg', 'svg', 'ico', 'webp'];
  return !nonHtml.includes(ext);
}

// ── DOM 模板 ──────────────────────────────────────────────────────────────────

const INNER_HTML = `
  <div class="pl-ring-wrap">
    <svg class="pl-svg" viewBox="0 0 200 200" aria-hidden="true">
      <circle class="pl-track" cx="100" cy="100" r="80"/>
      <circle class="pl-arc pl-arc--halo" cx="100" cy="100" r="80"
              pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
      <circle class="pl-arc pl-arc--tube" cx="100" cy="100" r="80"
              pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
      <circle class="pl-arc pl-arc--body" cx="100" cy="100" r="80"
              pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
    </svg>
    <div class="pl-pct" aria-hidden="true">
      <span class="pl-pct-num">0%</span>
    </div>
  </div>
  <div class="pl-label" aria-label="加载中">
    <span class="pl-text pl-text--halo" aria-hidden="true">LOADING</span>
    <span class="pl-text pl-text--tube"  aria-hidden="true">LOADING</span>
    <span class="pl-text pl-text--core"  aria-hidden="true">LOADING</span>
  </div>`;

// ── State ─────────────────────────────────────────────────────────────────────

const SHUTTER_HTML = `
  <div class="pl-shutter-leaf pl-shutter-leaf--left"></div>
  <div class="pl-shutter-leaf pl-shutter-leaf--right"></div>`;

interface State {
  el:       HTMLElement;
  arcs:     SVGCircleElement[];
  numEl:    HTMLElement | null;
  mode:     'initial' | 'transition';
  progress: number;
  raf:      number;
  finished: boolean;
}

function buildState(el: HTMLElement, mode: State['mode']): State {
  return {
    el,
    arcs:  Array.from(el.querySelectorAll<SVGCircleElement>('.pl-arc')),
    numEl: el.querySelector<HTMLElement>('.pl-pct-num'),
    mode,
    progress: 0, raf: 0, finished: false,
  };
}

function applyPct(s: State, pct: number): void {
  const p = Math.max(0, Math.min(100, pct));
  s.progress = p;
  s.arcs.forEach(a => a.setAttribute('stroke-dashoffset', String(100 - p)));
  if (s.numEl) s.numEl.textContent = `${Math.round(p)}%`;
}

/** ease-out cubic 假进度推到 target */
function fakeProgress(s: State, target: number, ms = 2400): void {
  const from = s.progress;
  const t0   = performance.now();
  const tick = (now: number): void => {
    if (s.finished) return;
    const t = Math.min((now - t0) / ms, 1);
    applyPct(s, from + (target - from) * (1 - (1 - t) ** 3));
    if (t < 1) s.raf = requestAnimationFrame(tick);
  };
  s.raf = requestAnimationFrame(tick);
}

// ── Show / Complete ───────────────────────────────────────────────────────────

let activeLoader: State | null = null;

function showLoader(mode: State['mode'] = 'initial'): State | null {
  const el = document.getElementById('page-loader');
  if (!el) return null;
  el.innerHTML = mode === 'transition' ? SHUTTER_HTML : INNER_HTML;
  el.classList.remove('pl-done', 'pl-transition', 'pl-closed');
  el.classList.add('pl-visible');
  if (mode === 'transition') {
    el.classList.add('pl-transition');
    void el.offsetWidth;
    el.classList.add('pl-closed');
  }
  delete document.documentElement.dataset.initialPageLoader;
  const s = buildState(el, mode);
  activeLoader = s;
  applyPct(s, 0);
  return s;
}

function waitForShutterClose(s: State): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const leaf = s.el.querySelector<HTMLElement>('.pl-shutter-leaf--left');
  if (!leaf) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      leaf.removeEventListener('transitionend', onEnd);
      window.clearTimeout(fallback);
      resolve();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === leaf && event.propertyName === 'transform') finish();
    };
    const fallback = window.setTimeout(finish, SHUTTER_CLOSE_FALLBACK_MS);
    leaf.addEventListener('transitionend', onEnd);
  });
}

function complete(s: State): void {
  if (s.finished || activeLoader !== s) return;
  s.finished = true;
  cancelAnimationFrame(s.raf);
  applyPct(s, 100);
  s.el.classList.add('pl-done');
  const cleanup = (): void => {
    if (activeLoader !== s) return;
    activeLoader = null;
    delete document.documentElement.dataset.initialPageLoader;
    delete document.documentElement.dataset.initialPageLoaderStartedAt;
    s.el.classList.remove('pl-visible', 'pl-done', 'pl-transition', 'pl-closed');
    s.el.innerHTML = '';
  };
  if (s.mode === 'transition' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.setTimeout(cleanup, 0);
    return;
  }
  s.el.addEventListener('transitionend', cleanup, { once: true });
  window.setTimeout(cleanup, 700); // transitionend 兜底
}

// ── 首页：等背景图、立绘终态和播放器布局就绪 ─────────────────────────────────

let cancelHomeWait: ((resetOverlay?: boolean) => void) | null = null;

function waitForState(
  element: HTMLElement | null,
  key: string,
  terminal: readonly string[],
  eventName: string,
  signal: AbortSignal,
): Promise<void> {
  if (!element || terminal.includes(element.dataset[key] ?? '')) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      if (!terminal.includes(element.dataset[key] ?? '')) return;
      resolve();
    };
    document.addEventListener(eventName, finish, { signal });
  });
}

function waitForBackground(isHome: boolean): Promise<boolean> {
  const element = isHome ? document.querySelector<HTMLElement>('[data-home-canvas]') : document.body;
  const value = element?.style.getPropertyValue(isHome ? '--home-background-image' : '--page-bg-image') ?? '';
  const src = value.replace(/^url\(["']?/, '').replace(/["']?\)$/, '').trim();
  if (!src) return Promise.resolve(false);
  const probe = new Image();
  probe.src = src;
  return probe.decode().then(() => true, () => false);
}

function getRemainingHomeDeadline(): number {
  const startedAt = Number(document.documentElement.dataset.initialPageLoaderStartedAt);
  if (!Number.isFinite(startedAt)) return HOME_DEADLINE_MS;
  const elapsed = Math.max(0, Date.now() - startedAt);
  return Math.max(0, Math.min(HOME_DEADLINE_MS, HOME_DEADLINE_MS - elapsed));
}

function waitHomeDone(s: State): void {
  cancelHomeWait?.();
  const rig = document.querySelector<HTMLElement>('[data-char-rig]');
  const player = document.querySelector<HTMLElement>('[data-music-player]');
  const controller = new AbortController();
  let settled = false;
  let guard = 0;
  const dispose = (resetOverlay = false) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(guard);
    controller.abort();
    cancelAnimationFrame(s.raf);
    if (resetOverlay) {
      s.finished = true;
      if (activeLoader === s) activeLoader = null;
      delete document.documentElement.dataset.initialPageLoader;
      delete document.documentElement.dataset.initialPageLoaderStartedAt;
      s.el.classList.remove('pl-visible', 'pl-done');
      s.el.innerHTML = '';
    }
    if (cancelHomeWait === dispose) cancelHomeWait = null;
  };
  const finish = () => {
    if (settled) return;
    dispose();
    complete(s);
  };
  const accessoryDeadline = new Promise<void>((resolve) => {
    guard = window.setTimeout(() => {
      if (settled) return;
      resolve();
    }, getRemainingHomeDeadline());
  });
  cancelHomeWait = dispose;

  void Promise.all([
    waitForBackground(true),
    document.fonts?.ready ?? Promise.resolve(),
    waitForState(rig, 'characterState', ['ready', 'error'], 'hatrix:character-state', controller.signal),
    Promise.race([
      waitForState(player, 'layoutState', ['ready'], 'hatrix:player-layout-ready', controller.signal),
      accessoryDeadline,
    ]),
  ]).then(finish);
}

// ── 跨事件状态 ────────────────────────────────────────────────────────────────

let pending: State | null = null;
let initialHomeBootstrapped = false;
let pageBackgroundWait = 0;

function waitPageBackgroundDone(s: State, background: Promise<boolean>, minimumMs = 0): void {
  const wait = ++pageBackgroundWait;
  fakeProgress(s, 85);
  void Promise.all([background, new Promise((resolve) => window.setTimeout(resolve, minimumMs))]).then(() => {
    if (wait === pageBackgroundWait) complete(s);
  });
}

/** 清理悬空的 pending（页面重新可见时调用） */
function drainPending(): void {
  if (pending) {
    const s = pending;
    pending = null;
    complete(s);
  }
}

// ── before-preparation：VT 导航开始 ─────────────────────────────────────────

document.addEventListener('astro:before-preparation', (raw) => {
  const event = raw as unknown as { to?: URL; loader?: () => Promise<void>; signal?: AbortSignal };
  const to = event.to;
  const replacesOverlay = !!to && isSameOriginPage(to);
  cancelHomeWait?.(!replacesOverlay);
  if (!to || !replacesOverlay) return;
  const s = showLoader('transition');
  if (!s) return;
  pageBackgroundWait += 1;
  pending = s;
  event.signal?.addEventListener('abort', () => {
    window.setTimeout(() => {
      if (pending !== s) return;
      pending = null;
      complete(s);
    }, 0);
  }, { once: true });
  if (event.loader) {
    const load = event.loader;
    const closed = waitForShutterClose(s);
    event.loader = async () => {
      try {
        await Promise.all([load(), closed]);
      } catch (error) {
        if (pending === s) pending = null;
        complete(s);
        throw error;
      }
    };
  }
});

document.addEventListener('astro:before-swap', (raw) => {
  const next = (raw as unknown as { newDocument?: Document }).newDocument;
  if (next?.body.style.getPropertyValue('--page-bg-image')) {
    next.documentElement.dataset.pageBackground = 'loading';
  }
  initialHomeBootstrapped = false;
  cancelHomeWait?.();
});
window.addEventListener('pagehide', () => cancelHomeWait?.(true));

// ── page-load：页面激活 ──────────────────────────────────────────────────────

function onPageLoad(): void {
  const path   = location.pathname;
  const isHome = document.documentElement.dataset.pageKind === 'home';
  const body = document.body;
  const background = !isHome
    ? waitForBackground(false).then((ready) => {
        if (ready && document.body === body) delete document.documentElement.dataset.pageBackground;
        return ready;
      })
    : null;

  if (pending) {
    // VT 导航完成，消费 pending
    const s = pending;
    pending = null;
    markVisited(path);
    if (isHome) { waitHomeDone(s); } else { waitPageBackgroundDone(s, background!); }
    return;
  }

  // 首帧遮罩已独立超时，说明客户端模块加载过慢或刚从失败中恢复。
  // 此时保留降级后的可见页面，不能再把遮罩盖回去。
  if (document.documentElement.dataset.initialPageLoader === 'expired') {
    delete document.documentElement.dataset.initialPageLoader;
    delete document.documentElement.dataset.initialPageLoaderStartedAt;
    markVisited(path);
    return;
  }

  // 硬导航：已访问则跳过
  if (hasVisited(path)) return;

  const s = showLoader();
  if (!s) return;
  markVisited(path);

  if (isHome) {
    fakeProgress(s, 85);
    waitHomeDone(s);
  } else {
    waitPageBackgroundDone(s, background!, 550);
  }
}

function bootstrapInitialHome(): void {
  if (document.documentElement.dataset.pageKind !== 'home') return;
  initialHomeBootstrapped = true;
  onPageLoad();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapInitialHome, { once: true });
} else {
  bootstrapInitialHome();
}
document.addEventListener('astro:page-load', () => {
  if (initialHomeBootstrapped) {
    initialHomeBootstrapped = false;
    return;
  }
  onPageLoad();
});

// ── 防止 pending 泄漏：页面重新可见时清理 ───────────────────────────────────

// 处理点击 RSS/外链/下载后 back 回来的情况：
// before-preparation 触发了（pending 被设置），但 page-load 从未触发，
// 页面重新可见时 pending 仍然悬空。
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') drainPending();
});
window.addEventListener('pageshow', (e) => {
  // bfcache 恢复时 e.persisted === true
  if (e.persisted) drainPending();
});
