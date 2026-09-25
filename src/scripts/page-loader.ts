/**
 * 全站页面加载遮罩。
 *
 * DOM 结构：PageLoader.astro 只输出一个空 <div id="page-loader">，
 * 默认 display:none。需要显示时本脚本填入内容并加 pl-visible class。
 * transition:persist 让 Astro 在 VT swap 时保留此元素。
 *
 * 时序：
 *   VT 导航到未访问页：before-preparation → showLoader → page-load → complete
 *   VT 导航到已访问页：before-preparation 跳过，page-load 跳过
 *   硬导航首次访问：  page-load → showLoader → complete（非首页快速完成）
 *   硬导航首页：      page-load → showLoader → waitHomeImage → complete
 */

const VISITED_KEY = 'hatrix-visited-pages';

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

// ── DOM ──────────────────────────────────────────────────────────────────────

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

function getEl(): HTMLElement | null {
  return document.getElementById('page-loader');
}

// ── State ────────────────────────────────────────────────────────────────────

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
    arcs:     Array.from(el.querySelectorAll<SVGCircleElement>('.pl-arc')),
    numEl:    el.querySelector<HTMLElement>('.pl-pct-num'),
    progress: 0, raf: 0, finished: false,
  };
}

function applyPct(s: State, pct: number): void {
  const p = Math.max(0, Math.min(100, pct));
  s.progress = p;
  s.arcs.forEach(a => a.setAttribute('stroke-dashoffset', String(100 - p)));
  if (s.numEl) s.numEl.textContent = `${Math.round(p)}%`;
}

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
  const el = getEl();
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
  // 直接开始淡出，不停顿
  s.el.classList.add('pl-done');
  const cleanup = () => {
    s.el.classList.remove('pl-visible', 'pl-done');
    s.el.innerHTML = '';
  };
  s.el.addEventListener('transitionend', cleanup, { once: true });
  window.setTimeout(cleanup, 700);
}

// ── 首页：等立绘 ──────────────────────────────────────────────────────────────

function waitHomeImage(s: State): void {
  const img = document.querySelector<HTMLImageElement>('[data-home-character] img');
  const guard = window.setTimeout(() => complete(s), 8_000);
  const done  = (): void => { window.clearTimeout(guard); complete(s); };
  if (!img)                                 { window.setTimeout(done, 400); return; }
  if (img.complete && img.naturalWidth > 0) { window.setTimeout(done, 100); return; }
  img.addEventListener('load',  done, { once: true });
  img.addEventListener('error', done, { once: true });
}

// ── 跨事件状态 ────────────────────────────────────────────────────────────────

let pending: State | null = null;   // before-preparation 创建，page-load 完成

// ── before-preparation ────────────────────────────────────────────────────────

document.addEventListener('astro:before-preparation', (raw) => {
  const targetPath = (raw as unknown as { to?: URL }).to?.pathname ?? '';
  if (!targetPath || hasVisited(targetPath)) return;
  const s = showLoader();
  if (!s) return;
  fakeProgress(s, 80);
  pending = s;
});

// ── page-load ─────────────────────────────────────────────────────────────────

document.addEventListener('astro:page-load', () => {
  const path   = location.pathname;
  const isHome = document.documentElement.dataset.pageKind === 'home';

  // VT 导航完成
  if (pending) {
    const s = pending;
    pending = null;
    markVisited(path);
    if (isHome) { waitHomeImage(s); } else { complete(s); }
    return;
  }

  // 硬导航
  if (hasVisited(path)) return;   // 已访问，不显示

  const s = showLoader();
  if (!s) return;
  markVisited(path);

  if (isHome) {
    fakeProgress(s, 85);
    waitHomeImage(s);
  } else {
    fakeProgress(s, 100, 500);
    window.setTimeout(() => complete(s), 550);
  }
});