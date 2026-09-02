import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });

test('articles and ordinary navigation remain usable without JavaScript', async ({ page }) => {
  await page.goto('/');
  const headerLinks = page.locator('.desktop-nav a');
  await expect(headerLinks).toHaveCount(7);
  const hrefs = await headerLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );
  expect(hrefs.every((href) => href?.startsWith('/') && href !== '#')).toBe(true);

  await page.getByRole('link', { name: '归档', exact: true }).click();
  await expect(page.locator('[data-archive-total]')).toHaveText('40');
  await page.locator('main a[href="/posts/本科数学大杂烩/"]').click();
  await expect(page.locator('article[data-post]')).toBeVisible();
  const commentsText = await page.locator('[data-giscus-comments]').evaluate(
    (element) => (element as HTMLElement).innerText
  );
  expect(commentsText).toContain('评论需要 JavaScript');
});

for (const route of ['/archives/', '/categories/', '/tags/', '/projects/']) {
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
