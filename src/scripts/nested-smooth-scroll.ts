import Lenis from 'lenis';
import { scrollPageBy } from './smooth-scroll';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compactFriends = window.matchMedia('(max-width: 1024px)');
const instances: Array<{
  element: HTMLElement;
  lenis: Lenis;
  attribute: 'data-lenis-prevent' | 'data-lenis-prevent-horizontal';
  hadPrevent: boolean;
  observer?: MutationObserver;
}> = [];
const proseObservers = new Map<HTMLElement, MutationObserver>();
const active = new Set<Lenis>();
let frame: number | undefined;
let mounted = false;

function animate(time: number): void {
  frame = undefined;
  for (const lenis of active) {
    lenis.raf(time);
    if (!lenis.isSmooth) active.delete(lenis);
  }
  if (active.size > 0) frame = requestAnimationFrame(animate);
}

function startAnimation(lenis: Lenis): void {
  const wrapper = lenis.rootElement;
  if (lenis.dimensions.width !== wrapper.clientWidth ||
      lenis.dimensions.height !== wrapper.clientHeight ||
      lenis.dimensions.scrollWidth !== wrapper.scrollWidth ||
      lenis.dimensions.scrollHeight !== wrapper.scrollHeight) {
    lenis.resize();
  }
  // A dormant instance needs a fresh clock before the next animation frame.
  lenis.raf(performance.now());
  active.add(lenis);
  if (frame === undefined) frame = requestAnimationFrame(animate);
}

function destroyEntry(entry: (typeof instances)[number]): void {
  entry.observer?.disconnect();
  active.delete(entry.lenis);
  entry.lenis.destroy();
  if (!entry.hadPrevent) entry.element.removeAttribute(entry.attribute);
}

function destroy(): void {
  mounted = false;
  for (const observer of proseObservers.values()) observer.disconnect();
  proseObservers.clear();
  for (const entry of instances) destroyEntry(entry);
  instances.length = 0;
  active.clear();
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
}

function add(element: HTMLElement, horizontal = false): void {
  const allowPageAtEdge = element.matches('.post-comments-screen');
  const attribute = horizontal ? 'data-lenis-prevent-horizontal' : 'data-lenis-prevent';
  const hadPrevent = element.hasAttribute(attribute);
  // The parent Lenis sees this wrapper in the event path; this instance does not.
  if (!allowPageAtEdge) element.setAttribute(attribute, '');
  const lenis = new Lenis({
    wrapper: element,
    content: element.firstElementChild ?? element,
    orientation: horizontal ? 'horizontal' : 'vertical',
    gestureOrientation: horizontal ? 'horizontal' : 'vertical',
    virtualScroll: ({ deltaX, deltaY, event }) => {
      const aligned = horizontal
        ? Math.abs(deltaX) > Math.abs(deltaY)
        : Math.abs(deltaY) >= Math.abs(deltaX);
      if (!aligned || !allowPageAtEdge || event.type !== 'wheel') return aligned;

      const limit = Math.max(0, element.scrollHeight - element.clientHeight);
      if (lenis.limit !== limit) lenis.resize();
      const target = Math.max(0, Math.min(limit, lenis.targetScroll + deltaY));
      const overflow = lenis.targetScroll + deltaY - target;
      if (overflow === 0) return true;

      if (event.cancelable) event.preventDefault();
      (event as WheelEvent & { lenisStopPropagation?: boolean }).lenisStopPropagation = true;
      if (target !== lenis.targetScroll) {
        lenis.scrollTo(target, { programmatic: false, lerp: lenis.options.lerp });
        startAnimation(lenis);
      }
      scrollPageBy(overflow);
      return false;
    },
    lerp: 0.14,
    overscroll: allowPageAtEdge,
  });
  lenis.on('virtual-scroll', () => startAnimation(lenis));

  const entry: (typeof instances)[number] = { element, lenis, attribute, hadPrevent };
  if (element.matches('.search-results')) {
    // Search populates this list asynchronously without changing its capped box size.
    entry.observer = new MutationObserver(() => lenis.resize());
    entry.observer.observe(element, { childList: true });
  }
  instances.push(entry);
}

function reconcileHorizontal(): void {
  if (!mounted || reducedMotion.matches) return;
  for (const [element, observer] of proseObservers) {
    if (element.isConnected) continue;
    observer.disconnect();
    proseObservers.delete(element);
  }
  for (let index = instances.length - 1; index >= 0; index--) {
    const entry = instances[index];
    if (entry.attribute === 'data-lenis-prevent-horizontal' &&
        (!entry.element.isConnected || entry.element.scrollWidth <= entry.element.clientWidth + 1)) {
      destroyEntry(entry);
      instances.splice(index, 1);
    }
  }
  document.querySelectorAll<HTMLElement>('.prose pre, .prose table, .prose .katex-display, .prose .mermaid')
    .forEach((element) => {
      if (element.scrollWidth <= element.clientWidth + 1 ||
          element.parentElement?.closest('.prose pre, .prose table, .prose .katex-display, .prose .mermaid')) return;
      if (!instances.some((entry) => entry.element === element)) add(element, true);
    });
  for (const entry of instances) {
    if (entry.attribute === 'data-lenis-prevent-horizontal') entry.lenis.resize();
  }
}

function observeProse(): void {
  if (!mounted || reducedMotion.matches) return;
  document.querySelectorAll<HTMLElement>('.prose').forEach((element) => {
    if (proseObservers.has(element)) return;
    const observer = new MutationObserver(reconcileHorizontal);
    observer.observe(element, { childList: true, subtree: true });
    proseObservers.set(element, observer);
  });
  reconcileHorizontal();
}

function mount(): void {
  destroy();
  if (reducedMotion.matches) return;
  mounted = true;

  const selectors = [
    '.search-results',
    '.guestbook-screen',
    '.post-comments-screen',
    '.mobile-nav',
    ...(compactFriends.matches
      ? ['.friends-main']
      : ['.friends-content', '.friends-main [data-sidebar-stack]']),
  ];

  document.querySelectorAll<HTMLElement>(selectors.join(', ')).forEach((element) => add(element));
  observeProse();
}

document.addEventListener('astro:before-swap', destroy);
document.addEventListener('astro:page-load', mount);
document.addEventListener('hatrix:protected-content-ready', observeProse);
window.addEventListener('resize', reconcileHorizontal);
document.fonts.addEventListener('loadingdone', reconcileHorizontal);
reducedMotion.addEventListener('change', mount);
compactFriends.addEventListener('change', mount);
mount();
