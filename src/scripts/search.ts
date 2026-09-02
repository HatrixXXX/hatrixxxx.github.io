import MiniSearch from 'minisearch';
import type { SearchDocument } from '@/lib/search';

const RESULT_LIMIT = 20;
let indexPromise: Promise<MiniSearch<SearchDocument>> | undefined;

function overlay(): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>('[data-search-overlay]');
}

async function searchIndex(): Promise<MiniSearch<SearchDocument>> {
  if (!indexPromise) {
    indexPromise = fetch('/search-index.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
        return response.json() as Promise<SearchDocument[]>;
      })
      .then((documents) => {
        const index = new MiniSearch<SearchDocument>({
          fields: ['title', 'description', 'text'],
          storeFields: ['url', 'title', 'description']
        });
        index.addAll(documents);
        return index;
      });
  }
  const activePromise = indexPromise;
  try {
    return await activePromise;
  } catch (error) {
    if (indexPromise === activePromise) indexPromise = undefined;
    throw error;
  }
}

async function openSearch(): Promise<void> {
  const dialog = overlay();
  const input = dialog?.querySelector<HTMLInputElement>('[data-search-input]');
  if (!dialog || !input) return;
  if (!dialog.open) dialog.showModal();
  input.focus();
  const status = dialog.querySelector<HTMLElement>('[data-search-status]');
  if (status) status.textContent = '正在载入搜索索引…';
  try {
    await searchIndex();
    if (status && input.value.trim() === '') status.textContent = '输入关键词开始搜索';
  } catch {
    if (status) status.textContent = '搜索索引暂时无法载入';
  }
}

function closeSearch(): void {
  const dialog = overlay();
  if (dialog?.open) dialog.close();
}

async function renderResults(input: HTMLInputElement): Promise<void> {
  const dialog = input.closest<HTMLDialogElement>('[data-search-overlay]');
  const results = dialog?.querySelector<HTMLOListElement>('[data-search-results]');
  const status = dialog?.querySelector<HTMLElement>('[data-search-status]');
  if (!results || !status) return;
  results.replaceChildren();
  const query = input.value.trim();
  if (!query) {
    status.textContent = '输入关键词开始搜索';
    return;
  }

  try {
    const matches = (await searchIndex()).search(query, { prefix: true, fuzzy: 0.2 }).slice(0, RESULT_LIMIT);
    status.textContent = matches.length > 0 ? `找到 ${matches.length} 条结果` : '没有找到相关文章';
    for (const match of matches) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      const title = document.createElement('strong');
      const meta = document.createElement('span');
      link.href = String(match.url);
      link.dataset.searchResult = '';
      title.textContent = String(match.title);
      meta.textContent = String(match.description);
      link.append(title, meta);
      item.append(link);
      results.append(item);
    }
  } catch {
    status.textContent = '搜索索引暂时无法载入';
  }
}

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    void openSearch();
  } else if (event.key === 'Escape') {
    closeSearch();
  }
});

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-open-search]')) void openSearch();
  if (event.target.closest('[data-close-search], [data-search-result]')) closeSearch();
});

document.addEventListener('input', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-search-input]')) {
    void renderResults(event.target);
  }
});
