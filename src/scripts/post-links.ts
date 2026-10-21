function openArticleLinksInNewTabs(): void {
  document.querySelectorAll<HTMLAnchorElement>('article[data-post] .prose a[href]').forEach((link) => {
    const href = link.getAttribute('href')?.trim();
    if (!href || href.startsWith('#') || (link.protocol !== 'http:' && link.protocol !== 'https:')) return;
    link.target = '_blank';
    link.relList.add('noopener', 'noreferrer');
  });
}

document.addEventListener('astro:page-load', openArticleLinksInNewTabs);
document.addEventListener('hatrix:protected-content-ready', openArticleLinksInNewTabs);
openArticleLinksInNewTabs();
