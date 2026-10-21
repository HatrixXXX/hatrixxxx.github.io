import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

let pageScroll: Lenis | undefined;

export function scrollPageTo(target: number | HTMLElement, block: ScrollLogicalPosition = 'start'): void {
  if (pageScroll) {
    const offset = target instanceof HTMLElement && block === 'center'
      ? (target.getBoundingClientRect().height - window.innerHeight) / 2
      : 0;
    pageScroll.scrollTo(target, { offset });
    return;
  }

  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  if (typeof target === 'number') window.scrollTo({ top: target, behavior });
  else target.scrollIntoView({ behavior, block });
}

export function scrollPageToBottom(): void {
  if (pageScroll) {
    pageScroll.resize();
    pageScroll.scrollTo('bottom');
    return;
  }

  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
}

export function scrollPageBy(delta: number): void {
  if (pageScroll) {
    pageScroll.scrollTo(pageScroll.targetScroll + delta, {
      programmatic: false,
      lerp: pageScroll.options.lerp,
    });
    return;
  }

  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  window.scrollBy({ top: delta, behavior });
}

function initializePageScroll(): void {
  pageScroll?.destroy();
  pageScroll = undefined;

  if (document.documentElement.dataset.pageKind === 'home' ||
      document.body.classList.contains('blog-page') ||
      document.body.classList.contains('friends-page')) return;

  pageScroll = new Lenis({
    autoRaf: true,
    lerp: 0.16,
    smoothWheel: true,
    syncTouch: false,
    respectReducedMotion: true,
    stopInertiaOnNavigate: true,
    allowNestedScroll: true,
    prevent: (node) => node.matches(
      '[data-post-coverflow], [data-post-rail], [data-project-dialog], [data-cube-dialog], [data-search-overlay], [data-mobile-menu], [data-gallery-track]'
    )
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('astro:before-swap', () => {
    pageScroll?.destroy();
    pageScroll = undefined;
  });
  document.addEventListener('astro:page-load', initializePageScroll);
  initializePageScroll();
}
