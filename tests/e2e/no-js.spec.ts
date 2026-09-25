import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });

test('articles and ordinary navigation remain usable without JavaScript', async ({ page }) => {
  await page.goto('/');
  const homeLinks = page.locator('[data-home-stage] a');
  const hrefs = await homeLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );
  expect(hrefs.length).toBe(10);
  expect(hrefs.every((href) => href?.startsWith('/') && href !== '#')).toBe(true);
  await page.locator('a[data-home-blog]').click();
  await expect(page).toHaveURL('/blog/');
  const allPosts = page.locator('[data-blog-category-nav]').getByRole('link', { name: '全部文章', exact: true });
  await expect(allPosts).toBeInViewport({ ratio: 1 });
  await expect.poll(() => allPosts.evaluate((link) =>
    link.parentElement!.getAnimations().every((animation) => animation.playState === 'finished')
  )).toBe(true);
  await allPosts.click();
  await page.waitForURL('**/blog/all/');
  await expect(page.locator('[data-blog-total]')).toHaveText('41');
  const rail = page.locator('[data-post-rail]');
  await expect(rail).toBeVisible();
  expect(await rail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect(page.locator('[data-blog-view-toggle]')).toBeHidden();
  await expect(page.locator('[data-blog-card-view]')).toBeVisible();
  await expect(page.locator('[data-blog-archive-view]')).toBeHidden();
  await page.getByRole('link', { name: '本科数学大杂烩', exact: true }).click();
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
