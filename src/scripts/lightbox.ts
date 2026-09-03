let photoSwipePromise: Promise<typeof import('photoswipe')> | undefined;
let photoSwipeStylePromise: Promise<unknown> | undefined;

async function openImage(image: HTMLImageElement): Promise<void> {
  photoSwipePromise ??= import('photoswipe');
  photoSwipeStylePromise ??= import('photoswipe/style.css');
  const [{ default: PhotoSwipe }] = await Promise.all([photoSwipePromise, photoSwipeStylePromise]);
  const lightbox = new PhotoSwipe({
    dataSource: [
      {
        src: image.currentSrc || image.src,
        width: image.naturalWidth || image.width || 1600,
        height: image.naturalHeight || image.height || 900,
        alt: image.alt
      }
    ],
    index: 0,
    bgOpacity: 0.9
  });
  lightbox.init();
}

function articleImage(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof Element)) return null;
  const image = target.closest<HTMLImageElement>('article img');
  if (!image || image.closest('a')) return null;
  return image;
}

function markImages(): void {
  document.querySelectorAll<HTMLImageElement>('article img:not([data-lightbox-image])').forEach((image) => {
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
