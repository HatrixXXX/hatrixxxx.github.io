import { expect, test } from '@playwright/test';

const firstQuote = '轻松即单纯，速成即精准。';

test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });

test('home shows restored identity, quote, and character without JavaScript', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-title]')).toBeVisible();
  await expect(page.locator('[data-home-panel="identity-name"]')).toBeVisible();
  await expect(page.locator('[data-home-panel="quote"]')).toContainText(firstQuote);
  const fallback = page.locator('[data-character-fallback]');
  await expect(fallback).toBeVisible();
  await expect(page.locator('[data-char-rig]')).toBeHidden();
  expect(await fallback.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  const homeLinks = page.locator('[data-home-stage] a');
  const hrefs = await homeLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );
  expect(hrefs.length).toBe(10);
  expect(hrefs.every((href) => href?.startsWith('/') && href !== '#')).toBe(true);
});

test('articles and ordinary navigation remain usable without JavaScript', async ({ page }) => {
  await page.goto('/');
  const homeLinks = page.locator('[data-home-stage] a');
  const hrefs = await homeLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );
  expect(hrefs.length).toBe(10);
  expect(hrefs.every((href) => href?.startsWith('/') && href !== '#')).toBe(true);
  await page.locator('a[data-home-blog]').click();
  await page.waitForURL('**/blog/');
  await expect(page.locator('[data-post-coverflow]')).toBeVisible();
  await expect(page.locator('[data-post-coverflow] [data-post-card]')).toHaveCount(43);
  await expect(page.locator('[data-blog-view-toggle], [data-blog-archive-view]')).toHaveCount(0);
  await page.getByRole('link', { name: '本科数学大杂烩', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('article[data-post]')).toBeVisible();
  const commentsText = await page.locator('[data-giscus-comments]').evaluate(
    (element) => (element as HTMLElement).innerText
  );
  expect(commentsText).toContain('评论需要 JavaScript');
});

for (const route of ['/archives/', '/projects/']) {
  test(`${route} remains directly readable without JavaScript`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main')).not.toBeEmpty();
  });
}

test('article remains directly readable without JavaScript', async ({ page }) => {
  const response = await page.goto('/posts/本科数学大杂烩/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('article[data-post] h1')).toContainText('本科数学大杂烩');
  await expect(page.locator('article[data-post] .prose')).toBeVisible();
});
