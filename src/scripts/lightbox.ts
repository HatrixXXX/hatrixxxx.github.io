let photoSwipePromise: Promise<typeof import('photoswipe')> | undefined;
let photoSwipeStylePromise: Promise<unknown> | undefined;

async function openImage(image: HTMLImageElement): Promise<void> {
  photoSwipePromise ??= import('photoswipe');
  photoSwipeStylePromise ??= import('photoswipe/style.css');
  const [{ default: PhotoSwipe }] = await Promise.all([photoSwipePromise, photoSwipeStylePromise]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lightbox = new PhotoSwipe({
    dataSource: [
      {
        element: image,
        src: image.currentSrc || image.src,
        msrc: image.currentSrc || image.src,
        width: image.naturalWidth || image.width || 1600,
        height: image.naturalHeight || image.height || 900,
        alt: image.alt
      }
    ],
    index: 0,
    mainClass: 'post-image-lightbox',
    paddingFn: ({ x, y }) => ({ top: y * 0.1, bottom: y * 0.1, left: x * 0.1, right: x * 0.1 }),
    initialZoomLevel: 'fit',
    secondaryZoomLevel: 'fit',
    maxZoomLevel: 'fit',
    imageClickAction: 'close',
    bgClickAction: 'close',
    tapAction: 'close',
    doubleTapAction: 'close',
    zoom: false,
    arrowPrev: false,
    arrowNext: false,
    counter: false,
    closeTitle: '关闭大图',
    showHideAnimationType: 'zoom',
    showAnimationDuration: reducedMotion ? 0 : 320,
    hideAnimationDuration: reducedMotion ? 0 : 320,
    easing: 'cubic-bezier(.45, 0, .55, 1)',
    bgOpacity: 0.68
  });
  let readyToClose = false;
  let closeRequested = false;
  lightbox.on('openingAnimationEnd', () => {
    readyToClose = true;
    if (closeRequested) lightbox.close();
  });
  lightbox.on('afterInit', () => {
    lightbox.element?.style.setProperty('--pswp-bg', 'var(--color-bg)');
    lightbox.element?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (readyToClose) lightbox.close();
      else closeRequested = true;
    }, { capture: true });
  });
  lightbox.init();
}

function articleImage(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof Element)) return null;
  const image = target.closest<HTMLImageElement>('article[data-post] .prose img');
  if (!image || image.closest('a')) return null;
  return image;
}

function markImages(): void {
  document.querySelectorAll<HTMLImageElement>('article[data-post] .prose img:not([data-lightbox-image])').forEach((image) => {
    image.dataset.lightboxImage = '';
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', image.alt ? `查看大图：${image.alt}` : '查看大图');
  });
}

document.addEventListener('click', (event) => {
  const image = articleImage(event.target);
  if (image) void openImage(image);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const image = articleImage(event.target);
  if (!image) return;
  event.preventDefault();
  void openImage(image);
});

document.addEventListener('astro:page-load', markImages);
document.addEventListener('hatrix:protected-content-ready', markImages);
markImages();
