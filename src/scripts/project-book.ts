import { wrapIndex } from '@/lib/project-showcase';

type Carousel = { move: (direction: -1 | 1) => void; reset: () => void };

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function bindCarousel(media: HTMLElement): Carousel | undefined {
  const track = media.querySelector<HTMLElement>('[data-carousel-track]');
  const viewport = media.querySelector<HTMLElement>('[data-carousel-viewport]');
  const counter = media.querySelector<HTMLElement>('[data-carousel-counter]');
  if (!track || !viewport) return;

  const slides = Array.from(track.querySelectorAll<HTMLElement>('[data-carousel-slide]'));
  const length = slides.length;
  if (length < 2) return;

  const firstClone = slides[0].cloneNode(true) as HTMLElement;
  const lastClone = slides[length - 1].cloneNode(true) as HTMLElement;
  for (const clone of [firstClone, lastClone]) {
    clone.removeAttribute('data-carousel-slide');
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
  }
  track.prepend(lastClone);
  track.append(firstClone);

  let logical = 0;
  let position = 1;
  let animating = false;
  let pending: -1 | 0 | 1 = 0;

  const place = (animated: boolean) => {
    track.toggleAttribute('data-no-transition', !animated);
    track.style.transform = `translate3d(${-position * 100}%, 0, 0)`;
    if (!animated) {
      void track.offsetWidth;
      track.removeAttribute('data-no-transition');
    }
    if (counter) counter.textContent = `${String(logical + 1).padStart(2, '0')} / ${String(length).padStart(2, '0')}`;
  };

  const move = (direction: -1 | 1) => {
    if (animating) {
      pending = direction;
      return;
    }
    logical = wrapIndex(logical + direction, length);
    position += direction;
    if (reducedMotion()) {
      position = logical + 1;
      place(false);
      return;
    }
    animating = true;
    place(true);
  };

  const settle = () => {
    if (!animating) return;
    animating = false;
    position = logical + 1;
    place(false);
    if (pending !== 0) {
      const next = pending;
      pending = 0;
      move(next);
    }
  };
  const onTransitionStop = (event: TransitionEvent) => {
    if (event.target === track && event.propertyName === 'transform') settle();
  };
  track.addEventListener('transitionend', onTransitionStop);
  track.addEventListener('transitioncancel', onTransitionStop);
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionController = new AbortController();
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) settle();
  }, { signal: motionController.signal });
  document.addEventListener('astro:before-swap', () => motionController.abort(), { once: true, signal: motionController.signal });

  let touchStart: number | undefined;
  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') touchStart = event.clientX;
  });
  viewport.addEventListener('pointerup', (event) => {
    if (touchStart === undefined) return;
    const distance = event.clientX - touchStart;
    touchStart = undefined;
    if (Math.abs(distance) > 42) move(distance < 0 ? 1 : -1);
  });
  viewport.addEventListener('pointercancel', () => { touchStart = undefined; });
  viewport.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  });

  place(false);
  return {
    move,
    reset: () => {
      pending = 0;
      animating = false;
      logical = 0;
      position = 1;
      place(false);
    }
  };
}

function bindProjectShowcase(): void {
  const showcase = document.querySelector<HTMLElement>('[data-project-showcase]:not([data-bound])');
  if (!showcase) return;
  showcase.dataset.bound = '';

  const badges = Array.from(showcase.querySelectorAll<HTMLButtonElement>('[data-project-badge]'));
  const details = Array.from(showcase.querySelectorAll<HTMLElement>('[data-project-detail]'));
  const pages = Array.from(showcase.querySelectorAll<HTMLElement>('[data-catalog-page]'));
  const pageCount = showcase.querySelector<HTMLElement>('[data-catalog-count]');
  const status = showcase.querySelector<HTMLElement>('[data-showcase-status]');
  const carousels = new Map<HTMLElement, Carousel>();
  showcase.querySelectorAll<HTMLElement>('[data-carousel]').forEach((media) => {
    const carousel = bindCarousel(media);
    if (carousel) carousels.set(media, carousel);
  });

  let currentPage = 0;
  const setPage = (page: number) => {
    if (pages.length === 0) return;
    currentPage = wrapIndex(page, pages.length);
    pages.forEach((item, index) => { item.hidden = index !== currentPage; });
    if (pageCount) pageCount.textContent = `${currentPage + 1} / ${pages.length}`;
  };

  const select = (index: number, scrollToDetail = false) => {
    if (!details[index]) return;
    showcase.dataset.selected = String(index);
    badges.forEach((badge, badgeIndex) => badge.setAttribute('aria-pressed', badgeIndex === index ? 'true' : 'false'));
    details.forEach((detail, detailIndex) => {
      detail.hidden = detailIndex !== index;
      detail.inert = detailIndex !== index;
    });
    setPage(Math.floor(index / 6));
    const media = details[index].querySelector<HTMLElement>('[data-carousel]');
    if (media) carousels.get(media)?.reset();
    details[index].querySelector<HTMLElement>('[data-detail-scroll]')?.scrollTo({ top: 0 });
    if (status) status.textContent = `当前作品：${badges[index]?.textContent?.trim() ?? ''}`;
    if (scrollToDetail && window.matchMedia('(max-width: 959px)').matches) {
      showcase.dataset.mobileView = 'detail';
      details[index].querySelector<HTMLButtonElement>('[data-back-catalog]')?.focus({ preventScroll: true });
    }
  };

  showcase.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const badge = event.target.closest<HTMLButtonElement>('[data-project-badge]');
    if (badge) return select(Number(badge.dataset.projectBadge), true);
    if (event.target.closest('[data-back-catalog]')) {
      showcase.dataset.mobileView = 'catalog';
      badges[Number(showcase.dataset.selected)]?.focus({ preventScroll: true });
      return;
    }
    if (event.target.closest('[data-catalog-prev], [data-catalog-next]')) {
      const direction = event.target.closest('[data-catalog-next]') ? 1 : -1;
      return select(wrapIndex(currentPage + direction, pages.length) * 6);
    }
    const carouselButton = event.target.closest<HTMLButtonElement>('[data-carousel-prev], [data-carousel-next]');
    const media = carouselButton?.closest<HTMLElement>('[data-carousel]');
    if (media) carousels.get(media)?.move(carouselButton?.hasAttribute('data-carousel-next') ? 1 : -1);
  });
}

document.addEventListener('astro:page-load', bindProjectShowcase);
bindProjectShowcase();
