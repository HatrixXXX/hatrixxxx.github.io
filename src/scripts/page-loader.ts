/**
 * 全站页面加载遮罩控制器。
 *
 * 架构原则：每个页面都包含 PageLoader.astro，其 inline script 在 HTML 解析阶段
 * 决定是否显示遮罩（首次访问该 URL 则显示）。
 * 本脚本只负责：在 astro:page-load 时启动进度、完成进度、移除遮罩。
 * 不在 astro:before-preparation 注入任何元素，避免 View Transitions DOM swap
 * 把注入的元素替换掉导致状态失联。
 *
 * 流程：
 *   astro:page-load
 *     ├─ 找到 #page-loader
 *     ├─ hidden=true  → 已访问过，直接 remove()
 *     └─ hidden=false → 首次访问，markVisited，启动进度
 *          ├─ 首页：runFakeProgress(85%) + waitHomeImage → complete
 *          └─ 其余：runFakeProgress(100%, 600ms) → complete
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
  state.arcs.forEach(a => a.setAttribute('stroke-dashoffset', String(100 - p)));
  if (state.numEl) state.numEl.textContent = `${Math.round(p)}%`;
}

/** ease-out cubic 假进度推到 targetPct */
function runFakeProgress(state: State, targetPct: number, durationMs = 2400): void {
  const from = state.progress;
  const t0   = performance.now();
  const tick = (now: number) => {
    if (state.finished) return;
    const t = Math.min((now - t0) / durationMs, 1);
    applyProgress(state, from + (targetPct - from) * (1 - (1 - t) ** 3));
    if (t < 1) state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}

/** 跳到 100%，停顿 160ms，淡出，移除 */
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
  const guard = window.setTimeout(() => complete(state), 8_000);
  const done  = () => { window.clearTimeout(guard); complete(state); };

  if (!img)                                 { window.setTimeout(done, 400); return; }
  if (img.complete && img.naturalWidth > 0) { window.setTimeout(done, 100); return; }
  img.addEventListener('load',  done, { once: true });
  img.addEventListener('error', done, { once: true });
}

// ── 主入口：每次页面激活 ──────────────────────────────────────────────────────

document.addEventListener('astro:page-load', () => {
  const path   = location.pathname;
  const loader = document.getElementById(LOADER_ID);

  if (!loader) return;

  if (loader.hidden) {
    // 已访问过（inline script 留了 hidden），直接移除
    loader.remove();
    return;
  }

  // 首次访问：标记并启动进度
  markVisited(path);
  const state = makeState(loader);
  applyProgress(state, 0);

  const isHome = document.documentElement.dataset.pageKind === 'home';
  if (isHome) {
    runFakeProgress(state, 85);
    waitHomeImage(state);
  } else {
    // 非首页：page-load 触发时内容已就绪，快速跑满
    runFakeProgress(state, 100, 550);
    window.setTimeout(() => complete(state), 600);
  }
});