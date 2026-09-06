import { searchTerms } from '../lib/search';

export function findSearchTarget(
  elements: readonly HTMLElement[],
  query: string
): HTMLElement | undefined {
  const terms = searchTerms(query);
  if (terms.length === 0) return undefined;

  return elements.find((element) => {
    const text = (element.textContent ?? '').toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  }) ?? elements.find((element) => {
    const text = (element.textContent ?? '').toLocaleLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

let highlightTimer: number | undefined;

function clearSearchHighlight(): void {
  document.querySelectorAll<HTMLElement>('[data-search-hit]').forEach((element) => {
    delete element.dataset.searchHit;
  });
  if (highlightTimer !== undefined) {
    window.clearTimeout(highlightTimer);
    highlightTimer = undefined;
  }
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
  highlightTimer = window.setTimeout(() => {
    delete target.dataset.searchHit;
    highlightTimer = undefined;
  }, 3_000);
}

if (typeof document !== 'undefined') {
  document.addEventListener('astro:page-load', highlightSearchTarget);
  highlightSearchTarget();
}
