/**
 * 全站页面加载遮罩（page-loader.ts）
 *
 * 架构说明
 * --------
 * PageLoader.astro 输出一个空 <div id="page-loader" transition:persist>，
 * CSS 默认 display:none，本脚本通过 pl-visible class 控制显示。
 *
 * 触发规则
 * --------
 * - 只对同源、同会话内未访问过的页面显示遮罩。
 * - 外部链接、非 HTML 目标（/rss.xml 等）不触发。
 * - 访问记录存 sessionStorage，关标签重置。
 *
 * 时序
 * ----
 * VT 导航到未访问页:
 *   astro:before-preparation → showLoader() + fakeProgress(80%) → pending = state
 *   astro:page-load          → complete(pending) → 淡出
 *
 * VT 导航到已访问页:
 *   before-preparation 跳过，page-load 跳过
 *
 * 硬导航首次访问:
 *   astro:page-load → showLoader() + 快速跑满 → complete()
 *
 * 硬导航首页:
 *   astro:page-load → showLoader() + fakeProgress(85%) → waitHomeDone() → complete()
 *
 * 异常情况
 * --------
 * - 页面被导航到外部（RSS/锚点/下载）：visibilitychange + pageshow 检测到
 *   页面重新可见时若 pending 存在则立即 complete() 清理。
 * - 8s 兜底防止永久卡住。
 */

const VISITED_KEY = 'hatrix-visited-pages';

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

interface State {
  el:       HTMLElement;
  arcs:     SVGCircleElement[];
  numEl:    HTMLElement | null;
  progress: number;
  raf:      number;
  finished: boolean;
}

function buildState(el: HTMLElement): State {
  return {
    el,
    arcs:  Array.from(el.querySelectorAll<SVGCircleElement>('.pl-arc')),
    numEl: el.querySelector<HTMLElement>('.pl-pct-num'),
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

function showLoader(): State | null {
  const el = document.getElementById('page-loader');
  if (!el) return null;
  el.innerHTML = INNER_HTML;
  el.classList.add('pl-visible');
  const s = buildState(el);
  applyPct(s, 0);
  return s;
}

function complete(s: State): void {
  if (s.finished) return;
  s.finished = true;
  cancelAnimationFrame(s.raf);
  applyPct(s, 100);
  s.el.classList.add('pl-done');
  const cleanup = (): void => {
    s.el.classList.remove('pl-visible', 'pl-done');
    s.el.innerHTML = '';
  };
  s.el.addEventListener('transitionend', cleanup, { once: true });
  window.setTimeout(cleanup, 700); // transitionend 兜底
}

// ── 首页：等背景图 + 立绘都就绪 ──────────────────────────────────────────────

function waitHomeDone(s: State): void {
  let imgDone = false;
  let bgDone  = false;
  const guard = window.setTimeout(() => complete(s), 8_000);

  const tryComplete = (): void => {
    if (imgDone && bgDone) { window.clearTimeout(guard); complete(s); }
  };

  // ── 立绘 img ──
  const img = document.querySelector<HTMLImageElement>('[data-home-character] img');
  const onImgDone = (): void => { imgDone = true; tryComplete(); };
  if (!img || (img.complete && img.naturalWidth > 0)) {
    imgDone = true;
  } else {
    img.addEventListener('load',  onImgDone, { once: true });
    img.addEventListener('error', onImgDone, { once: true });
  }

  // ── 背景图（CSS background-image via CSS var on [data-home-canvas]） ──
  const canvas = document.querySelector<HTMLElement>('[data-home-canvas]');
  const bgUrl  = canvas
    ? (canvas.style.getPropertyValue('--home-background-image') || '')
        .replace(/^url\(["']?/, '').replace(/["']?\)$/, '').trim()
    : '';

  if (!bgUrl) {
    bgDone = true;
  } else {
    const probe = new Image();
    probe.onload  = (): void => { bgDone = true; tryComplete(); };
    probe.onerror = (): void => { bgDone = true; tryComplete(); };
    probe.src = bgUrl;
    if (probe.complete) { bgDone = true; }
  }

  // 两个条件都满足才 complete（处理已缓存的情况）
  tryComplete();
}

// ── 跨事件状态 ────────────────────────────────────────────────────────────────

let pending: State | null = null;

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
  const to = (raw as unknown as { to?: URL }).to;
  if (!to || !isSameOriginPage(to) || hasVisited(to.pathname)) return;
  const s = showLoader();
  if (!s) return;
  fakeProgress(s, 80);
  pending = s;
});

// ── page-load：页面激活 ──────────────────────────────────────────────────────

document.addEventListener('astro:page-load', () => {
  const path   = location.pathname;
  const isHome = document.documentElement.dataset.pageKind === 'home';

  if (pending) {
    // VT 导航完成，消费 pending
    const s = pending;
    pending = null;
    markVisited(path);
    if (isHome) { waitHomeDone(s); } else { complete(s); }
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
    fakeProgress(s, 100, 500);
    window.setTimeout(() => complete(s), 550);
  }
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