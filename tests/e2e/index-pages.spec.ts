import { expect, test } from '@playwright/test';

test('content index pages reflect migrated data', async ({ page, request }) => {
  await page.goto('/archives/');
  await expect(page.locator('[data-archive-total]')).toHaveText('40');

  for (const route of ['/categories/', '/tags/']) {
    expect((await request.get(route)).status()).toBe(404);
  }

  await page.goto('/projects/');
  await expect(page.getByText('作品内容还没添加')).toBeVisible();

  await page.goto('/about/');
  await expect(page.locator('main').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /HatrixXXX/);

  const rss = await (await request.get('/rss.xml')).text();
  expect((rss.match(/<item>/g) ?? []).length).toBe(40);

  const searchResponse = await request.get('/search-index.json');
  expect(searchResponse.headers()['content-type']).toMatch(/^application\/json/);
  const search = await searchResponse.json();
  expect(search).toHaveLength(40);
  for (const document of search) {
    expect(document).not.toHaveProperty('category');
    expect(document).not.toHaveProperty('tags');
    expect(document.text).not.toMatch(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*?)?\s*\/?>|<!--[\s\S]*?-->|```|!\[|\]\([^)]*\)/);
  }
});

test('404 retains site navigation', async ({ page }) => {
  const response = await page.goto('/missing-index-page-task-8/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('header[data-site-header]')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/404\.html$/);
});
