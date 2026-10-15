import { animate, createTimeline } from 'animejs';

interface ReelLink {
  element: HTMLButtonElement;
  title: string;
  category: string;
  description: string;
  url: string;
}

const rowPositions = [
  { y: 0, tilt: 0, scale: 1, opacity: 1 },
  { y: 72, tilt: -24, scale: .94, opacity: .84 },
  { y: 127, tilt: -47, scale: .83, opacity: .49 },
  { y: 168, tilt: -65, scale: .72, opacity: .2 }
];

function bindBookmarkArchive(): void {
  const root = document.querySelector<HTMLElement>('[data-favorites]:not([data-bound])');
  if (!root) return;
  const reel = root.querySelector<HTMLElement>('[data-favorites-reel]')!;
  const items: ReelLink[] = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-favorites-item]')).map((element) => ({
    element,
    title: element.dataset.title!,
    category: element.dataset.category!,
    description: element.dataset.description!,
    url: element.dataset.url!
  }));
  if (!items.length) return;
  root.dataset.bound = '';
  const consoleElement = root;

  const category = root.querySelector<HTMLElement>('[data-favorites-category]')!;
  const title = root.querySelector<HTMLElement>('[data-favorites-selected]')!;
  const domain = root.querySelector<HTMLElement>('[data-favorites-domain]')!;
  const description = root.querySelector<HTMLElement>('[data-favorites-description]')!;
  const visit = root.querySelector<HTMLAnchorElement>('[data-favorites-visit]')!;
  const status = root.querySelector<HTMLElement>('[data-favorites-status]')!;
  const randomIcon = root.querySelector<SVGElement>('[data-favorites-random] svg');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  let selected = 0;
  let spinTimeline: ReturnType<typeof createTimeline> | undefined;
  let iconAnimation: ReturnType<typeof animate> | undefined;
  let settleTimer: number | undefined;
  let pointerY: number | undefined;
  let didDrag = false;
  let suppressClickUntil = 0;
  let lastWheelAt = 0;

  function render(announce = true): void {
    items.forEach(({ element }, index) => {
      let offset = (index - selected + items.length) % items.length;
      if (offset > items.length / 2) offset -= items.length;
      const distance = Math.abs(offset);
      const pose = rowPositions[Math.min(distance, 3)];
      const visible = distance <= 3;
      element.style.setProperty('--row-y', `${Math.sign(offset) * (visible ? pose.y : 218)}px`);
      element.style.setProperty('--row-angle', `${Math.sign(offset) * pose.tilt}deg`);
      element.style.setProperty('--row-scale', String(pose.scale));
      element.style.setProperty('--row-opacity', String(visible ? pose.opacity : 0));
      element.style.zIndex = String(4 - Math.min(distance, 4));
      element.dataset.selected = String(index === selected);
      element.setAttribute('aria-pressed', String(index === selected));
      element.setAttribute('aria-hidden', String(!visible));
      element.tabIndex = index === selected ? 0 : -1;
    });

    const current = items[selected];
    category.textContent = current.category;
    title.textContent = current.title;
    domain.textContent = new URL(current.url).hostname;
    description.textContent = current.description;
    visit.href = current.url;
    if (announce) status.textContent = `已选中：${current.title}`;
  }

  function cancelSpin(): void {
    spinTimeline?.cancel();
    iconAnimation?.revert();
    if (settleTimer !== undefined) window.clearTimeout(settleTimer);
    spinTimeline = undefined;
    iconAnimation = undefined;
    settleTimer = undefined;
    reel.removeAttribute('aria-busy');
    consoleElement.removeAttribute('data-spinning');
    consoleElement.removeAttribute('data-settling');
  }

  function settle(): void {
    consoleElement.dataset.settling = '';
    settleTimer = window.setTimeout(() => {
      consoleElement.removeAttribute('data-settling');
      settleTimer = undefined;
    }, 420);
  }

  function select(index: number, announce = true): void {
    selected = (index + items.length) % items.length;
    render(announce);
  }

  function step(direction: number): void {
    cancelSpin();
    select(selected + direction);
  }

  function spin(): void {
    cancelSpin();
    const advance = 1 + Math.floor(Math.random() * (items.length - 1));
    if (reduced.matches) {
      select(selected + advance);
      return;
    }
    const total = items.length + advance;
    consoleElement.dataset.spinning = '';
    reel.setAttribute('aria-busy', 'true');
    status.textContent = '正在随机转动…';
    if (randomIcon) iconAnimation = animate(randomIcon, { rotate: '1turn', duration: 750, ease: 'linear', loop: true });
    const timeline = createTimeline();
    spinTimeline = timeline;
    let at = 0;
    for (let count = 1; count <= total; count += 1) {
      timeline.call(() => select(selected + 1, false), at);
      at += count === total ? 320 : 28 + 120 * (count / total) ** 3;
    }
    timeline.call(() => {
      cancelSpin();
      status.textContent = `已选中：${items[selected].title}`;
      settle();
    }, at);
  }

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-favorites-previous]')) step(-1);
    else if (target.closest('[data-favorites-next]')) step(1);
    else if (target.closest('[data-favorites-random]')) spin();
    else {
      const item = target.closest<HTMLButtonElement>('[data-favorites-item]');
      if (item && performance.now() >= suppressClickUntil) {
        cancelSpin();
        select(Number(item.dataset.index));
        reel.focus({ preventScroll: true });
      }
    }
  }, { signal: abort.signal });

  reel.addEventListener('wheel', (event) => {
    if (!event.deltaY) return;
    event.preventDefault();
    reel.focus({ preventScroll: true });
    const now = performance.now();
    if (now - lastWheelAt < 80) return;
    lastWheelAt = now;
    step(Math.sign(event.deltaY));
  }, { passive: false, signal: abort.signal });

  reel.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancelSpin();
    pointerY = event.clientY;
    didDrag = false;
    reel.setPointerCapture(event.pointerId);
  }, { signal: abort.signal });
  reel.addEventListener('pointermove', (event) => {
    if (pointerY === undefined) return;
    const delta = pointerY - event.clientY;
    if (Math.abs(delta) < 42) return;
    didDrag = true;
    reel.focus({ preventScroll: true });
    step(Math.sign(delta));
    pointerY = event.clientY;
  }, { signal: abort.signal });
  const release = () => {
    if (didDrag) suppressClickUntil = performance.now() + 240;
    pointerY = undefined;
  };
  reel.addEventListener('pointerup', release, { signal: abort.signal });
  reel.addEventListener('pointercancel', release, { signal: abort.signal });
  reel.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    step(event.key === 'ArrowDown' ? 1 : -1);
    reel.focus({ preventScroll: true });
  }, { signal: abort.signal });
  reduced.addEventListener('change', () => {
    if (reduced.matches && spinTimeline) {
      cancelSpin();
      status.textContent = `已选中：${items[selected].title}`;
    }
  }, { signal: abort.signal });
  document.addEventListener('astro:before-swap', () => {
    cancelSpin();
    abort.abort();
  }, { once: true, signal: abort.signal });
  window.addEventListener('pagehide', cancelSpin, { signal: abort.signal });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !spinTimeline) return;
    cancelSpin();
    status.textContent = `已选中：${items[selected].title}`;
  }, { signal: abort.signal });

  render();
}

document.addEventListener('astro:page-load', bindBookmarkArchive);
bindBookmarkArchive();
