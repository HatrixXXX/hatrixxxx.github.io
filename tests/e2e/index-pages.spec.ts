import { expect, test } from '@playwright/test';

test('content index pages reflect migrated data', async ({ page, request }) => {
  await page.goto('/archives/');
  await expect(page.locator('[data-archive-total]')).toHaveText('40');

  await page.goto('/categories/');
  for (const name of [
    'FPGA 与数字系统',
    '嵌入式与硬件',
    'AI 与图形计算',
    '软件工程与工具',
    '数学与基础',
    '随笔与资源'
  ]) {
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }

  await page.goto('/tags/');
  await expect(page.locator('[data-tag-link]').first()).toBeVisible();

  await page.goto('/projects/');
  await expect(page.getByText('作品内容还没添加')).toBeVisible();

  await page.goto('/about/');
  await expect(page.locator('main').getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /HatrixXXX/);

  const rss = await (await request.get('/rss.xml')).text();
  expect((rss.match(/<item>/g) ?? []).length).toBe(40);

  const search = await (await request.get('/search-index.json')).json();
  expect(search).toHaveLength(40);
  expect(search[0].text).not.toContain('<article');
});

test('404 retains site navigation', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.locator('header[data-site-header]')).toBeVisible();
});
