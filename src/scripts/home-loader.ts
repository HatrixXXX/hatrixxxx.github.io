/**
 * 首页首次加载遮罩控制器。
 *
 * 触发条件：
 *   - 当前页面是首页（data-page-kind="home"）
 *   - 是硬导航（performance.navigation.type === 0 或 PerformanceNavigationTiming type === 'navigate'）
 *     View Transitions 内部跳转不重新触发。
 *
 * 消失条件：立绘 img[data-home-character-img] 的 load 事件，或最长等待 8s 兜底。
 */

const FALLBACK_MS = 8_000;

function getLoader(): HTMLElement | null {
  return document.getElementById('home-loader');
}

function dismiss(loader: HTMLElement): void {
  loader.classList.add('is-done');
  // transition 结束后从 DOM 移除，避免遮住链接
  loader.addEventListener('transitionend', () => loader.remove(), { once: true });
}

function isHardNavigation(): boolean {
  // PerformanceNavigationTiming（现代）
  const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (entries.length > 0) return entries[0].type === 'navigate' || entries[0].type === 'reload';
  // 旧 API 兜底
  return (performance.navigation?.type ?? 0) <= 1;
}

function initLoader(): void {
  const loader = getLoader();
  if (!loader) return;

  // View Transitions 二次进入首页时：loader 已被上次 remove，无需处理
  // 但若用户从其他页 back/forward 回首页，loader 不在 DOM 里，也无需处理
  // 只需处理真正的首次硬导航
  if (!isHardNavigation()) {
    loader.remove();
    return;
  }

  // 等立绘加载完
  const img = document.querySelector<HTMLImageElement>('[data-home-character] img');

  const done = (): void => {
    window.clearTimeout(fallback);
    dismiss(loader);
  };

  const fallback = window.setTimeout(done, FALLBACK_MS);

  if (!img) {
    // 找不到立绘元素，短暂后退出
    window.setTimeout(done, 300);
    return;
  }

  if (img.complete && img.naturalWidth > 0) {
    // 图片已缓存，直接消失（给极短的展示时间让用户感知到动画）
    window.setTimeout(done, 120);
    return;
  }

  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', done, { once: true });
}

// 仅在首页执行
if (document.documentElement.dataset.pageKind === 'home') {
  initLoader();
}

// View Transitions：从首页导航到其他页再 back 不重新触发（loader 已从 DOM 移除）
// 如有需要未来可在 astro:page-load 里检查并重新插入，但目前需求不含此场景
