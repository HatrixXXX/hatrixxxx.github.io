import { expect, test } from '@playwright/test';

test('content index pages reflect migrated data', async ({ page, request }) => {
  await page.goto('/archives/');
  await expect(page.locator('[data-archive-total]')).toHaveText('40');

  await page.goto('/categories/');
  const categoryNames = [
    'FPGA 与数字系统',
    '嵌入式与硬件',
    'AI 与图形计算',
    '软件工程与工具',
    '数学与基础',
    '随笔与资源'
  ];
  for (const name of categoryNames) {
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.locator('.taxonomy-card h2')).toHaveText(categoryNames);

  await page.goto('/tags/');
  await expect(page.locator('[data-tag-link]').first()).toBeVisible();
  const tagSizes = await page.locator('[data-tag-link]').evaluateAll((links) =>
    links.map((link) => ({
      count: Number(link.getAttribute('data-tag-count')),
      fontSize: Number.parseFloat(getComputedStyle(link).fontSize)
    }))
  );
  const largestCount = Math.max(...tagSizes.map((tag) => tag.count));
  const mostUsed = tagSizes.find((tag) => tag.count === largestCount);
  const usedOnce = tagSizes.find((tag) => tag.count === 1);
  expect(mostUsed?.fontSize).toBeGreaterThanOrEqual(usedOnce?.fontSize ?? 0);

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
    expect(document.text).not.toMatch(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*?)?\s*\/?>|<!--[\s\S]*?-->|```|!\[|\]\([^)]*\)/);
  }
});

test('404 retains site navigation', async ({ page }) => {
  const response = await page.goto('/missing-index-page-task-8/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('header[data-site-header]')).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/404\.html$/);
});
