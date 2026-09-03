let observer: IntersectionObserver | undefined;

function initializeTableOfContents(): void {
  observer?.disconnect();
  observer = undefined;

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'));
  if (links.length === 0) return;

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
