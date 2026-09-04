function mountGiscus(): void {
  document.querySelectorAll<HTMLElement>('[data-giscus-comments]').forEach((section) => {
    const status = section.querySelector<HTMLElement>('[data-giscus-status]');
    if (!status || section.querySelector('script[src="https://giscus.app/client.js"]')) return;

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.dataset.repo = section.dataset.giscusRepo ?? '';
    script.dataset.repoId = section.dataset.giscusRepoId ?? '';
    script.dataset.category = section.dataset.giscusCategory ?? '';
    script.dataset.categoryId = section.dataset.giscusCategoryId ?? '';
    script.dataset.mapping = section.dataset.giscusMapping ?? '';
    script.dataset.strict = '0';
    script.dataset.reactionsEnabled = '1';
    script.dataset.emitMetadata = '0';
    script.dataset.inputPosition = 'top';
    script.dataset.theme = document.documentElement.dataset.theme === 'light'
      ? 'light'
      : section.dataset.giscusDarkTheme;
    script.dataset.lang = 'zh-CN';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.addEventListener('load', () => {
      status.hidden = true;
    });
    script.addEventListener('error', () => {
      status.hidden = false;
      status.textContent = '评论暂时无法加载，正文内容不受影响';
    });
    section.append(script);
  });
}

document.addEventListener('astro:page-load', mountGiscus);
document.addEventListener('hatrix:protected-content-ready', mountGiscus);
mountGiscus();
