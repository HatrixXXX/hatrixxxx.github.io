import { expect, test } from '@playwright/test';

test('home links to the blog without rendering an article feed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('article[data-post-card]')).toHaveCount(0);
  await expect(page.locator('.pagination')).toHaveCount(0);
  await expect(page.locator('[data-post-count]')).toHaveText('40');
  await expect(page.getByRole('link', { name: '浏览全部博客文章' })).toHaveAttribute(
    'href',
    '/blog/'
  );
  await expect(page.locator('a[href^="/categories/"], a[href^="/tags/"]')).toHaveCount(0);

  const missingFirstPage = await page.request.get('/page/1/');
  expect(missingFirstPage.status()).toBe(404);
  expect((await page.request.get('/page/2/')).status()).toBe(200);

  await page.goto('/page/7/');
  await expect(page.locator('article[data-post-card]')).toHaveCount(4);

  await page.goto('/page/3/');
  const spacedSlugLink = page.locator('a[href="/posts/FPGA开发(1)Vivado+Vitis 使用/"]').first();
  await expect(spacedSlugLink).toBeVisible();
  const resolvedPath = await spacedSlugLink.evaluate(
    (link) => new URL((link as HTMLAnchorElement).href).pathname
  );
  expect(resolvedPath).toBe(encodeURI('/posts/FPGA开发(1)Vivado+Vitis 使用/'));
});

test('site footer is absent from home and paginated pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer[data-site-footer]')).toHaveCount(0);

  await page.goto('/page/2/');
  await expect(page.locator('footer[data-site-footer]')).toHaveCount(0);
});

test('profile sidebar switches from desktop sticky column to mobile flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const desktopPosition = await page.locator('.profile-sidebar').evaluate(
    (sidebar) => getComputedStyle(sidebar).position
  );
  const desktopSidebar = await page.locator('.profile-sidebar').boundingBox();
  const desktopEntry = await page.locator('.home-blog-entry').boundingBox();
  expect(desktopPosition).toBe('sticky');
  expect(desktopSidebar?.x).toBeGreaterThan((desktopEntry?.x ?? 0) + (desktopEntry?.width ?? 0));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const mobilePosition = await page.locator('.profile-sidebar').evaluate(
    (sidebar) => getComputedStyle(sidebar).position
  );
  const mobileSidebar = await page.locator('.profile-sidebar').boundingBox();
  const mobileEntry = await page.locator('.home-blog-entry').boundingBox();
  expect(mobilePosition).toBe('static');
  expect(mobileSidebar?.y).toBeLessThan(mobileEntry?.y ?? 0);
});

test('home has no mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(sizes.scroll).toBe(sizes.client);

  const sidebar = await page.locator('.profile-sidebar').boundingBox();
  const entry = await page.locator('.home-blog-entry').boundingBox();
  expect(sidebar?.width).toBeGreaterThan(340);
  expect(entry?.width).toBeGreaterThan(340);
});
