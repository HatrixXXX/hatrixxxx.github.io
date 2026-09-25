/**
 * 全站页面加载遮罩控制器。
 *
 * 两个入口：
 * A. 硬导航（首次打开网站）
 *    - PageLoader.astro 内联脚本已在 HTML 解析时决定显示/隐藏遮罩
 *    - astro:page-load 触发时处理：首页等立绘，其余直接完成
 *
 * B. View Transitions 导航
 *    - astro:before-preparation：目标页未访问过则插入遮罩，开始假进度
 *    - astro:page-load：完成进度，淡出
 *
 * 访问记录：sessionStorage['hatrix-visited-pages']，关标签重置。
 */

const VISITED_KEY = 'hatrix-visited-pages';
const LOADER_ID   = 'page-loader';

// ── 访问记录 ─────────────────────────────────────────────────────────────────

function getVisited(): string[] {
  try { return JSON.parse(sessionStorage.getItem(VISITED_KEY) ?? '[]') as string[]; }
  catch { return []; }
}
function markVisited(path: string): void {
  try {
    const v = getVisited();
    if (!v.includes(path)) { v.push(path); sessionStorage.setItem(VISITED_KEY, JSON.stringify(v)); }
  } catch { /* ignore */ }
}
function hasVisited(path: string): boolean { return getVisited().includes(path); }

// ── 遮罩模板（供 View Transitions 复用） ─────────────────────────────────────

let loaderTemplate: HTMLElement | null = null;

function saveTemplate(loader: HTMLElement): void {
  if (!loaderTemplate) loaderTemplate = loader.cloneNode(true) as HTMLElement;
}

function injectLoader(): HTMLElement | null {
  if (!loaderTemplate) return null;
  const el = loaderTemplate.cloneNode(true) as HTMLElement;
  el.removeAttribute('hidden');
  el.classList.remove('is-done');
  el.style.cssText = '';          // 清除残留 inline style
  document.body.prepend(el);
  return el;
}

// ── 进度动画 ─────────────────────────────────────────────────────────────────

interface State {
  loader:   HTMLElement;
  arcs:     SVGCircleElement[];
  numEl:    HTMLElement | null;
  progress: number;
  raf:      number;
  finished: boolean;
}

function makeState(loader: HTMLElement): State {
  return {
    loader,
    arcs:     Array.from(loader.querySelectorAll<SVGCircleElement>('.pl-arc')),
    numEl:    loader.querySelector<HTMLElement>('#pl-pct-num'),
    progress: 0, raf: 0, finished: false,
  };
}

function applyProgress(state: State, pct: number): void {
  const p = Math.max(0, Math.min(100, pct));
  state.progress = p;
  const offset = 100 - p;
  state.arcs.forEach(a => a.setAttribute('stroke-dashoffset', String(offset)));
  if (state.numEl) state.numEl.textContent = `${Math.round(p)}%`;
}

/** ease-out cubic 假进度，推到 targetPct */
function runFakeProgress(state: State, targetPct: number, durationMs = 2400): void {
  const from  = state.progress;
  const t0    = performance.now();
  const tick  = (now: number) => {
    if (state.finished) return;
    const t = Math.min((now - t0) / durationMs, 1);
    applyProgress(state, from + (targetPct - from) * (1 - (1 - t) ** 3));
    if (t < 1) state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}

/** 跳到 100%，停顿，淡出，移除 */
function complete(state: State): void {
  if (state.finished) return;
  state.finished = true;
  cancelAnimationFrame(state.raf);
  applyProgress(state, 100);
  window.setTimeout(() => {
    state.loader.classList.add('is-done');
    const remove = () => state.loader.remove();
    state.loader.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, 700);
  }, 160);
}

// ── 首页：等立绘 ─────────────────────────────────────────────────────────────

function waitHomeImage(state: State): void {
  const img = document.querySelector<HTMLImageElement>('[data-home-character] img');
  const done = () => complete(state);
  const guard = window.setTimeout(done, 8_000);
  const finish = () => { window.clearTimeout(guard); done(); };

  if (!img)                                   { window.setTimeout(done, 400); return; }
  if (img.complete && img.naturalWidth > 0)   { window.setTimeout(done, 100); return; }
  img.addEventListener('load',  finish, { once: true });
  img.addEventListener('error', finish, { once: true });
}

// ── 当前活跃状态 ─────────────────────────────────────────────────────────────

let activeState: State | null = null;

// ── 硬导航：astro:page-load ───────────────────────────────────────────────────

// 这里处理两种情况：
//   1. 硬导航首次进入（遮罩由内联脚本显示，hidden=false）
//   2. View Transitions 导航后激活（遮罩已在 before-preparation 插入）
document.addEventListener('astro:page-load', () => {
  const path = location.pathname;

  // ─ 情况2：View Transitions 导航后 ─
  if (activeState) {
    // before-preparation 已启动假进度，now complete
    complete(activeState);
    markVisited(path);
    activeState = null;
    return;
  }

  // ─ 情况1：硬导航 ─
  const loader = document.getElementById(LOADER_ID);
  if (!loader) return;

  saveTemplate(loader);       // 保存模板供 VT 复用

  if (loader.hidden) {
    // 已访问过（但这是硬导航，理论上不会出现；兜底移除）
    loader.remove();
    return;
  }

  // 首次访问此页
  markVisited(path);
  const state = makeState(loader);
  applyProgress(state, 0);

  const isHome = document.documentElement.dataset.pageKind === 'home';
  if (isHome) {
    runFakeProgress(state, 85);
    waitHomeImage(state);
  } else {
    // 非首页硬导航：页面已在 page-load 时完全就绪，直接跑满
    runFakeProgress(state, 100, 400);
    window.setTimeout(() => complete(state), 450);
  }
});

// ── View Transitions：导航开始 ────────────────────────────────────────────────

document.addEventListener('astro:before-preparation', (rawEvent) => {
  // 取目标路径（Astro 4/5 两种 API 均兼容）
  const ev = rawEvent as CustomEvent;
  const to  = (ev as unknown as { to?: URL }).to;
  const targetPath: string = to?.pathname ?? '';

  if (!targetPath || hasVisited(targetPath)) return;  // 已访问，不显示

  const loader = injectLoader();
  if (!loader) return;

  const state = makeState(loader);
  applyProgress(state, 0);
  runFakeProgress(state, 80);
  activeState = state;
});