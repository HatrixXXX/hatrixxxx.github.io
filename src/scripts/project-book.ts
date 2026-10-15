import { createTimeline } from 'animejs';

function sourceOffset(source: DOMRect, destination: DOMRect) {
  return {
    x: source.left - destination.left,
    y: source.top - destination.top,
    scale: source.width / destination.width
  };
}

type Carousel = { move: (direction: -1 | 1) => void; scroll: (delta: number) => void; reset: () => void; finish: () => void };

function bindCarousel(media: HTMLElement, reducedMotion: MediaQueryList): Carousel | undefined {
  const viewport = media.querySelector<HTMLElement>('[data-carousel-viewport]');
  const track = media.querySelector<HTMLElement>('[data-carousel-track]');
  const counter = media.querySelector<HTMLElement>('[data-carousel-counter]');
  if (!viewport || !track) return;
  const slides = Array.from(track.querySelectorAll<HTMLElement>('[data-carousel-slide]'));
  const length = slides.length;
  if (length < 2) return;

  const before = slides.slice(-2).map((slide) => slide.cloneNode(true) as HTMLElement);
  const after = slides.slice(0, 2).map((slide) => slide.cloneNode(true) as HTMLElement);
  for (const clone of [...before, ...after]) {
    clone.removeAttribute('data-carousel-slide');
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
  }
  track.prepend(...before);
  track.append(...after);

  const renderedSlides = Array.from(track.children) as HTMLElement[];
  let current = 2;
  let target = 2;
  let velocity = 0;
  let frameId: number | null = null;
  let lastTime: number | null = null;
  let announcedIndex = -1;
  let wheelTimer: number | undefined;
  let wheelDirection = 1;
  const normalize = () => {
    while (current < 1) { current += length; target += length; }
    while (current > length + 2) { current -= length; target -= length; }
  };
  const place = () => {
    renderedSlides.forEach((slide, index) => {
      const distance = index - current;
      const proximity = Math.abs(distance);
      slide.style.transform = `translateX(${-50 + distance * 60}%) scale(${1 - 0.42 * Math.min(proximity, 1)})`;
      slide.style.opacity = String(Math.max(0.18, 0.58 ** proximity));
      slide.style.zIndex = String(Math.round(100 - proximity * 10));
      slide.style.pointerEvents = proximity < 0.5 ? 'auto' : 'none';
    });
    const nearest = ((Math.round(current) - 2) % length + length) % length;
    if (counter && nearest !== announcedIndex) {
      announcedIndex = nearest;
      counter.textContent = `${String(nearest + 1).padStart(2, '0')} / ${String(length).padStart(2, '0')}`;
    }
  };
  const stopFrame = () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    lastTime = null;
  };
  const clearWheelTimer = () => {
    if (wheelTimer !== undefined) window.clearTimeout(wheelTimer);
    wheelTimer = undefined;
  };
  const nearestTarget = () => Math.round(target + wheelDirection * 0.001);
  const settle = () => {
    stopFrame();
    current = target;
    velocity = 0;
    normalize();
    delete media.dataset.carouselMoving;
    place();
  };
  const finish = () => {
    clearWheelTimer();
    target = nearestTarget();
    settle();
  };
  const step = (time: number) => {
    frameId = null;
    const dt = Math.min(lastTime === null ? 16 : time - lastTime, 50) / 1000;
    lastTime = time;
    velocity += (260 * (target - current) - 28 * velocity) * dt;
    current += velocity * dt;
    normalize();
    if (Math.abs(target - current) < 0.005 && Math.abs(velocity) < 0.005) {
      settle();
      return;
    }
    place();
    frameId = requestAnimationFrame(step);
  };
  const schedule = () => {
    if (reducedMotion.matches) {
      settle();
      return;
    }
    media.dataset.carouselMoving = '';
    if (frameId === null) frameId = requestAnimationFrame(step);
  };
  const move = (direction: -1 | 1) => {
    clearWheelTimer();
    target = Math.round(target) + direction;
    schedule();
  };
  const scroll = (delta: number) => {
    if (delta === 0) return;
    clearWheelTimer();
    wheelDirection = Math.sign(delta);
    target += delta / 240;
    schedule();
    wheelTimer = window.setTimeout(() => {
      wheelTimer = undefined;
      target = nearestTarget();
      schedule();
    }, 160);
  };
  const reset = () => {
    clearWheelTimer();
    stopFrame();
    current = 2;
    target = 2;
    velocity = 0;
    announcedIndex = -1;
    delete media.dataset.carouselMoving;
    place();
  };

  let startX: number | undefined;
  let pointerId: number | undefined;
  let suppressClick = false;
  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startX = event.clientX;
    pointerId = event.pointerId;
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener('pointerup', (event) => {
    if (startX === undefined || event.pointerId !== pointerId) return;
    const distance = event.clientX - startX;
    startX = undefined;
    pointerId = undefined;
    if (Math.abs(distance) < 42) return;
    suppressClick = true;
    move(distance < 0 ? 1 : -1);
    window.setTimeout(() => { suppressClick = false; }, 350);
  });
  viewport.addEventListener('pointercancel', () => { startX = undefined; pointerId = undefined; });
  viewport.addEventListener('click', (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  });
  viewport.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  });
  place();
  return { move, scroll, finish, reset };
}

function bindProjectShowcase(): void {
  const showcase = document.querySelector<HTMLElement>('[data-project-showcase]:not([data-bound])');
  if (!showcase) return;
  showcase.dataset.bound = '';

  const dialog = showcase.querySelector<HTMLDialogElement>('[data-detail-panel]');
  if (!dialog) return;
  const badges = Array.from(showcase.querySelectorAll<HTMLButtonElement>('[data-project-badge]'));
  const details = Array.from(dialog.querySelectorAll<HTMLElement>('[data-project-detail]'));
  const status = showcase.querySelector<HTMLElement>('[data-showcase-status]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const carousels = new Map<HTMLElement, Carousel>();
  dialog.querySelectorAll<HTMLElement>('[data-project-carousel]').forEach((media) => {
    const carousel = bindCarousel(media, reducedMotion);
    if (carousel) carousels.set(media, carousel);
  });
  let motionTimeline: ReturnType<typeof createTimeline> | undefined;
  const motion = { x: 0, y: 0, scale: 1, card: 0, cardX: -36, backdrop: 0 };
  let sourceBadge: HTMLButtonElement | undefined;
  let previousOverflow = '';
  let active = false;
  let closing = false;

  const selected = () => Number(showcase.dataset.selected);
  const expandedVessel = () => details[selected()]?.querySelector<HTMLElement>('[data-expanded-vessel]');
  const infoCard = () => details[selected()]?.querySelector<HTMLElement>('[data-info-card]');
  const renderMotion = () => {
    const vessel = expandedVessel();
    const card = infoCard();
    if (vessel) vessel.style.transform = `translate(${motion.x}px, ${motion.y}px) scale(${motion.scale})`;
    if (card) {
      card.style.opacity = String(motion.card);
      card.style.transform = `translateX(${motion.cardX}px)`;
    }
    dialog.style.setProperty('--showcase-backdrop-alpha', String(motion.backdrop));
  };

  const cleanup = (returnFocus: boolean) => {
    if (!active) return;
    motionTimeline?.cancel();
    motionTimeline = undefined;
    carousels.forEach((carousel) => carousel.finish());
    expandedVessel()?.style.removeProperty('transform');
    infoCard()?.style.removeProperty('transform');
    infoCard()?.style.removeProperty('opacity');
    dialog.style.removeProperty('--showcase-backdrop-alpha');
    sourceBadge?.style.removeProperty('visibility');
    document.documentElement.style.overflow = previousOverflow;
    delete dialog.dataset.ready;
    delete dialog.dataset.closing;
    active = false;
    closing = false;
    if (returnFocus) sourceBadge?.focus({ preventScroll: true });
  };

  const finishClose = () => {
    if (dialog.open) dialog.close();
    cleanup(true);
  };

  const finishOpen = () => {
    motionTimeline?.cancel();
    motionTimeline = undefined;
    Object.assign(motion, { x: 0, y: 0, scale: 1, card: 1, cardX: 0, backdrop: 0.78 });
    expandedVessel()?.style.removeProperty('transform');
    infoCard()?.style.removeProperty('transform');
    infoCard()?.style.removeProperty('opacity');
    dialog.style.setProperty('--showcase-backdrop-alpha', '0.78');
    dialog.dataset.ready = '';
  };

  const closeDetail = () => {
    if (!dialog.open || closing) return;
    closing = true;
    const vessel = expandedVessel();
    const source = sourceBadge?.querySelector<HTMLElement>('.showcase-vessel');
    if (reducedMotion.matches || !vessel || !source) return finishClose();

    motionTimeline?.cancel();
    vessel.style.transform = 'none';
    const destinationBounds = vessel.getBoundingClientRect();
    renderMotion();
    const destination = sourceOffset(source.getBoundingClientRect(), destinationBounds);
    dialog.dataset.closing = '';
    motionTimeline = createTimeline({
      onUpdate: renderMotion,
      onComplete: () => { if (dialog.open) finishClose(); }
    })
      .add(motion, { x: destination.x, y: destination.y, scale: destination.scale, duration: 380, ease: 'inOut(2)' }, 0)
      .add(motion, { card: 0, cardX: -36, duration: 180, ease: 'in(2)' }, 0)
      .add(motion, { backdrop: 0, duration: 380, ease: 'in(2)' }, 0);
  };

  const openDetail = (index: number) => {
    if (dialog.open || closing) return;
    // A native close event can arrive after the dialog has already been reopened.
    if (active) cleanup(false);
    const detail = details[index];
    const badge = badges[index];
    const source = badge?.querySelector<HTMLElement>('.showcase-vessel');
    if (!detail || !badge || !source) return;
    const sourceBounds = source.getBoundingClientRect();
    showcase.dataset.selected = String(index);
    badges.forEach((item, badgeIndex) => item.setAttribute('aria-pressed', badgeIndex === index ? 'true' : 'false'));
    details.forEach((item, detailIndex) => {
      item.hidden = detailIndex !== index;
      item.inert = detailIndex !== index;
    });
    const media = detail.querySelector<HTMLElement>('[data-project-carousel]');
    if (media) carousels.get(media)?.reset();
    const title = badge.textContent?.trim() ?? '';
    if (status) status.textContent = `当前作品：${title}`;
    dialog.setAttribute('aria-label', `作品详情：${title}`);
    sourceBadge = badge;
    previousOverflow = document.documentElement.style.overflow;
    active = true;
    dialog.style.setProperty('--showcase-backdrop-alpha', '0');
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    badge.style.visibility = 'hidden';
    dialog.focus({ preventScroll: true });

    const vessel = expandedVessel();
    const card = detail.querySelector<HTMLElement>('[data-info-card]');
    if (reducedMotion.matches || !vessel || !card) {
      dialog.style.setProperty('--showcase-backdrop-alpha', '0.78');
      dialog.dataset.ready = '';
      return;
    }
    Object.assign(motion, sourceOffset(sourceBounds, vessel.getBoundingClientRect()), { card: 0, cardX: -36, backdrop: 0 });
    renderMotion();
    motionTimeline = createTimeline({
      onUpdate: renderMotion,
      onComplete: () => {
        Object.assign(motion, { x: 0, y: 0, scale: 1, card: 1, cardX: 0, backdrop: 0.78 });
        renderMotion();
        if (dialog.open && !closing) dialog.dataset.ready = '';
      }
    })
      .add(motion, { x: 0, y: 0, scale: 1, duration: 520, ease: 'out(3)' }, 0)
      .add(motion, { backdrop: 0.78, duration: 520, ease: 'out(2)' }, 0)
      .add(motion, { card: 1, cardX: 0, duration: 260, ease: 'out(3)' }, 520);
  };

  dialog.addEventListener('cancel', (event) => { event.preventDefault(); void closeDetail(); });
  dialog.addEventListener('close', () => { if (!dialog.open) cleanup(true); });
  dialog.addEventListener('click', () => { void closeDetail(); });
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches || !dialog.open) return;
    carousels.forEach((carousel) => carousel.finish());
    if (closing) return finishClose();
    finishOpen();
  }, { signal: controller.signal });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    carousels.forEach((carousel) => carousel.finish());
    if (!dialog.open) return;
    if (closing) finishClose();
    else finishOpen();
  }, { signal: controller.signal });
  document.addEventListener('wheel', (event) => {
    if (!dialog.open) return;
    const target = event.target;
    const media = target instanceof Element ? target.closest<HTMLElement>('[data-project-carousel]') : null;
    const carousel = media ? carousels.get(media) : undefined;
    if (carousel) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const direction = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const normalized = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? direction * 24
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? direction * 300
        : direction;
      carousel.scroll(normalized);
      return;
    }
    if (target instanceof Node && target !== dialog && dialog.contains(target) && dialog.scrollHeight > dialog.clientHeight) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false, signal: controller.signal });
  document.addEventListener('astro:before-swap', () => {
    if (dialog.open) finishClose();
    controller.abort();
  }, { once: true, signal: controller.signal });
  showcase.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const badge = event.target.closest<HTMLButtonElement>('[data-project-badge]');
    if (badge) openDetail(Number(badge.dataset.projectBadge));
  });
}

document.addEventListener('astro:page-load', bindProjectShowcase);
bindProjectShowcase();
