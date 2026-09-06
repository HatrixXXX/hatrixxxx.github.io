let observer: IntersectionObserver | undefined;

function waitForImages(): Promise<void> {
  const pending = Array.from(document.images).filter((image) => !image.complete);
  if (pending.length === 0) return Promise.resolve();

  return Promise.all(
    pending.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
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
    (entries) => {
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (current?.target.id) setCurrent(current.target.id);
    },
    { rootMargin: '-15% 0px -70% 0px' }
  );
  headings.forEach((heading) => observer?.observe(heading));
}

initializeTableOfContents();
document.addEventListener('astro:page-load', initializeTableOfContents);
document.addEventListener('hatrix:protected-content-ready', initializeTableOfContents);
