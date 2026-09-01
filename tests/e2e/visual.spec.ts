import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/posts/本科数学大杂烩/',
  '/archives/',
  '/categories/',
  '/tags/',
  '/projects/',
  '/404.html'
];

for (const path of routes) {
  test(`${path} has stable responsive structure`, async ({ page }) => {
    test.setTimeout(path.startsWith('/posts/') ? 360_000 : 60_000);
    await page.route('https://giscus.app/**', (route) => route.abort());
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('img').evaluateAll((images) => {
      for (const image of images) (image as HTMLImageElement).loading = 'eager';
    });
    await page.waitForFunction(() => [...document.images].every((image) => image.complete));

    const metrics = await page.evaluate(() => ({
      bodies: document.querySelectorAll('body').length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      emptyTallBlocks: [...document.querySelectorAll('main *, article[data-post] *')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            !element.textContent?.trim() &&
            !element.matches('img, svg, canvas, video') &&
            !element.querySelector('img, svg, canvas, video') &&
            rect.height > innerHeight
          );
        })
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          height: Math.round(element.getBoundingClientRect().height)
        })),
      postArticles: document.querySelectorAll('article[data-post]').length,
      visiblePostCards: [...document.querySelectorAll('main article[data-post-card]')].filter(
        (element) => (element as HTMLElement).offsetParent !== null
      ).length,
      duplicateVisibleCardLinks: (() => {
        const links = [
          ...document.querySelectorAll<HTMLAnchorElement>('main article[data-post-card] h2 a')
        ]
          .filter((element) => element.offsetParent !== null)
          .map((element) => element.href);
        return links.length - new Set(links).size;
      })()
    }));

    expect(metrics.bodies).toBe(1);
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.emptyTallBlocks).toEqual([]);
    expect(metrics.postArticles).toBe(path.startsWith('/posts/') ? 1 : 0);
    expect(metrics.duplicateVisibleCardLinks).toBe(0);
    if (path === '/') expect(metrics.visiblePostCards).toBe(6);

    const randomFooter = page.locator('[data-footer-random]');
    await expect(randomFooter).toHaveAttribute('data-test-seed', 'playwright-fixed');
    await expect(randomFooter.locator('li')).toHaveCount(10);

    const snapshotName = path === '/' ? 'home.png' : `${path.replaceAll('/', '_')}.png`;
    await expect(page).toHaveScreenshot(snapshotName, {
      fullPage: true,
      animations: 'disabled',
      timeout: path.startsWith('/posts/') ? 300_000 : 20_000,
      maxDiffPixels: path.startsWith('/posts/') ? 2_000 : 0,
      mask: [page.locator('[data-giscus-comments]')],
      maskColor: '#252a33'
    });
  });
}
