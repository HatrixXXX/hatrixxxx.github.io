export function findSearchTarget(
  elements: readonly HTMLElement[],
  query: string
): HTMLElement | undefined {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return undefined;

  return elements.find((element) =>
    (element.textContent ?? '').toLocaleLowerCase().includes(normalizedQuery)
  );
}

function clearSearchHighlight(): void {
  document.querySelectorAll<HTMLElement>('[data-search-hit]').forEach((element) => {
    delete element.dataset.searchHit;
  });
}

function highlightSearchTarget(): void {
  clearSearchHighlight();
  const query = new URLSearchParams(window.location.search).get('q');
  if (!query) return;

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>('.prose :is(p, li, blockquote, h2, h3, h4)')
  );
  const target = findSearchTarget(elements, query);
  if (!target) return;

  target.dataset.searchHit = '';
  target.scrollIntoView({
    block: 'center',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  });
  window.setTimeout(() => delete target.dataset.searchHit, 3_000);
}

if (typeof document !== 'undefined') {
  document.addEventListener('astro:page-load', highlightSearchTarget);
  highlightSearchTarget();
}
