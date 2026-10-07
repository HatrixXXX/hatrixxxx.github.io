let observer: IntersectionObserver | undefined;
let sidebarPositionFrame: number | undefined;
let tocScrollFrame: number | undefined;
let refreshCurrentHeading: (() => void) | undefined;

function initializePostSidebar(): void {
  const sidebar = document.querySelector<HTMLElement>('.post-sidebar');
  if (!sidebar) return;

  sidebar.style.removeProperty('--post-sidebar-top');
  if (!window.matchMedia('(min-width: 1280px)').matches) return;

  const documentTop = sidebar.getBoundingClientRect().top + window.scrollY;
  sidebar.style.setProperty('--post-sidebar-top', `${documentTop}px`);
}

function schedulePostSidebarPosition(): void {
  if (sidebarPositionFrame !== undefined) cancelAnimationFrame(sidebarPositionFrame);
  sidebarPositionFrame = requestAnimationFrame(() => {
    sidebarPositionFrame = undefined;
    initializePostSidebar();
  });
}

function scheduleTableOfContentsUpdate(): void {
  if (!refreshCurrentHeading || tocScrollFrame !== undefined) return;
  tocScrollFrame = requestAnimationFrame(() => {
    tocScrollFrame = undefined;
    refreshCurrentHeading?.();
  });
}

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
  initializePostSidebar();
  observer?.disconnect();
  observer = undefined;
  refreshCurrentHeading = undefined;

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'));
  if (links.length === 0) return;

  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-toc-item]'));

  const setExpandedSection = (sectionSlug?: string) => {
    items.forEach((item) => {
      const depth = Number(item.dataset.depth);
      item.hidden = depth > 2 && item.dataset.tocSection !== sectionSlug;
    });
    links.forEach((link) => {
      if (link.dataset.tocExpandable !== 'true') return;
      link.setAttribute('aria-expanded', String(link.dataset.tocSection === sectionSlug));
    });
  };

  links.forEach((link) => {
    if (link.dataset.tocBound === 'true') return;
    link.dataset.tocBound = 'true';
    link.addEventListener('click', (event) => {
      const slug = link.dataset.tocLink;
      if (!slug) return;
      event.preventDefault();
      setCurrent(slug, true);
      void scrollToHeading(slug);
    });
  });

  const linksBySlug = new Map(links.map((link) => [link.dataset.tocLink, link]));
  const headings = Array.from(linksBySlug.keys())
    .map((slug) => (slug ? document.getElementById(slug) : null))
    .filter((heading): heading is HTMLElement => heading !== null);
  if (headings.length === 0) return;

  const setCurrent = (slug: string, expandSection: boolean) => {
    links.forEach((link) => {
      if (link.dataset.tocLink === slug) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (expandSection) {
      const sectionSlug = links.find((link) => link.dataset.tocLink === slug)?.dataset.tocSection;
      setExpandedSection(sectionSlug);
    }
  };

  setExpandedSection();
  setCurrent(headings[0].id, false);
  refreshCurrentHeading = () => {
    const threshold = window.innerHeight * 0.2;
    const current = headings
      .map((heading) => ({ heading, top: heading.getBoundingClientRect().top }))
      .filter(({ top }) => top <= threshold)
      .at(-1);
    if (current) setCurrent(current.heading.id, true);
    else {
      setExpandedSection();
      setCurrent(headings[0].id, false);
    }
  };
  observer = new IntersectionObserver(() => refreshCurrentHeading?.(), {
    rootMargin: '-15% 0px -70% 0px'
  });
  headings.forEach((heading) => observer?.observe(heading));
  refreshCurrentHeading();
}

initializeTableOfContents();
document.addEventListener('astro:page-load', initializeTableOfContents);
document.addEventListener('hatrix:protected-content-ready', initializeTableOfContents);
window.addEventListener('resize', schedulePostSidebarPosition);
window.addEventListener('scroll', scheduleTableOfContentsUpdate, { passive: true });
