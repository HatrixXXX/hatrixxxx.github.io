let observer: IntersectionObserver | undefined;

function waitForImages(): Promise<void> {
  const pending = Array.from(document.images).filter((image) => !image.complete);
  if (pending.length === 0) return Promise.resolve();

  const images = Promise.all(
    pending.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
      })
    )
  ).then(() => undefined);
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 300));
  return Promise.race([images, timeout]);
}

async function scrollToHeading(slug: string): Promise<void> {
  const heading = document.getElementById(slug);
  if (!heading) return;

  await waitForImages();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
  history.pushState(null, '', `#${slug}`);
  heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => {
    const offset = heading.getBoundingClientRect().top;
    if (window.location.hash === `#${slug}` && (offset < -32 || offset > window.innerHeight * 0.35)) {
      heading.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, 900);
}

function initializeTableOfContents(): void {
  observer?.disconnect();
  observer = undefined;

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'));
  if (links.length === 0) return;

  links.forEach((link) => {
    if (link.dataset.tocBound === 'true') return;
    link.dataset.tocBound = 'true';
    link.addEventListener('click', (event) => {
      const slug = link.dataset.tocLink;
      if (!slug) return;
      event.preventDefault();
      setCurrent(slug);
      void scrollToHeading(slug);
    });
  });

  const linksBySlug = new Map(links.map((link) => [link.dataset.tocLink, link]));
  const headings = Array.from(linksBySlug.keys())
    .map((slug) => (slug ? document.getElementById(slug) : null))
    .filter((heading): heading is HTMLElement => heading !== null);
  if (headings.length === 0) return;

  const setCurrent = (slug: string) => {
    links.forEach((link) => {
      if (link.dataset.tocLink === slug) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  setCurrent(headings[0].id);
  observer = new IntersectionObserver(
    () => {
      const threshold = window.innerHeight * 0.2;
      const current = headings
        .map((heading) => ({ heading, top: heading.getBoundingClientRect().top }))
        .filter(({ top }) => top <= threshold)
        .at(-1);
      if (current) setCurrent(current.heading.id);
    },
    { rootMargin: '-15% 0px -70% 0px' }
  );
  headings.forEach((heading) => observer?.observe(heading));
}

initializeTableOfContents();
document.addEventListener('astro:page-load', initializeTableOfContents);
document.addEventListener('hatrix:protected-content-ready', initializeTableOfContents);
