/**
 * 首页加载遮罩控制器。
 *
 * HomeLoader.astro 的内联脚本已在 HTML 解析时决定遮罩是否可见。
 * 本模块负责：在 astro:page-load（首页激活）时找到遮罩并监听立绘加载完成，
 * 之后淡出并从 DOM 移除。
 *
 * 关键点：
 * - 遮罩用 sessionStorage 标记控制只在会话首次访问首页时出现。
 * - View Transitions 回到首页时遮罩已被 remove()，此处 getLoader() 返回 null，直接跳过。
 * - 图片已缓存（img.complete）时给 120ms 展示后快速消失。
 * - 8s 兜底防止图片加载失败时永久卡住。
 */

const FALLBACK_MS = 8_000;

function getLoader(): HTMLElement | null {
  return document.getElementById('home-loader');
}

function dismiss(loader: HTMLElement): void {
  loader.classList.add('is-done');
  loader.addEventListener('transitionend', () => loader.remove(), { once: true });
  // 保底：transition 可能因 prefers-reduced-motion 很短，600ms 后强制移除
  window.setTimeout(() => loader.remove(), 700);
}

function initLoader(): void {
  const loader = getLoader();
  // 不在首页，或遮罩已被移除（View Transitions 回首页）：跳过
  if (!loader) return;
  // 遮罩存在但是 hidden（sessionStorage 已标记，不该显示）：直接移除
  if (loader.hidden) {
    loader.remove();
    return;
  }

  const img = document.querySelector<HTMLImageElement>('[data-home-character] img');

  const done = (): void => {
    window.clearTimeout(fallback);
    dismiss(loader);
  };

  const fallback = window.setTimeout(done, FALLBACK_MS);

  if (!img) {
    window.setTimeout(done, 300);
    return;
  }

  if (img.complete && img.naturalWidth > 0) {
    // 图片已缓存：极短展示后消失
    window.setTimeout(done, 120);
    return;
  }

  img.addEventListener('load',  done, { once: true });
  img.addEventListener('error', done, { once: true });
}

// 每次首页激活都检查（首次硬导航 + View Transitions 回首页均会触发）
document.addEventListener('astro:page-load', initLoader);
// 首次硬导航时 astro:page-load 也会触发，无需单独调用