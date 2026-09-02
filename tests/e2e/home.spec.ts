import { expect, test } from '@playwright/test';

test('home renders six alternating post cards and live author counts', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('article[data-post-card]');
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(0)).toHaveAttribute('data-side', 'left');
  await expect(cards.nth(1)).toHaveAttribute('data-side', 'right');
  await expect(page.locator('[data-post-count]')).toHaveText('40');
  await expect(page.locator('[data-category-count]')).not.toHaveText('0');
  await expect(page.locator('[data-tag-count]')).not.toHaveText('0');
  await page.goto('/page/2/');
  await expect(page.locator('article[data-post-card]').first()).toBeVisible();

  const missingFirstPage = await page.request.get('/page/1/');
  expect(missingFirstPage.status()).toBe(404);

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

test('footer exposes stable random and newest article lists', async ({ page }) => {
  const randomLinks = 'section[aria-labelledby="footer-random-heading"] li a';
  const newestLinks = 'section[aria-labelledby="footer-newest-heading"] li a';

  await page.goto('/');
  await expect(page.locator(randomLinks)).toHaveCount(10);
  await expect(page.locator(newestLinks)).toHaveCount(10);
  const firstPageRandomHrefs = await page.locator(randomLinks).evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );

  await page.goto('/page/2/');
  await expect(page.locator(randomLinks)).toHaveCount(10);
  await expect(page.locator(newestLinks)).toHaveCount(10);
  const secondPageRandomHrefs = await page.locator(randomLinks).evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );

  expect(secondPageRandomHrefs).toEqual(firstPageRandomHrefs);
});

test('profile sidebar switches from desktop sticky column to mobile flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const desktopPosition = await page.locator('.profile-sidebar').evaluate(
    (sidebar) => getComputedStyle(sidebar).position
  );
  const desktopSidebar = await page.locator('.profile-sidebar').boundingBox();
  const desktopCard = await page.locator('article[data-post-card]').first().boundingBox();
  expect(desktopPosition).toBe('sticky');
  expect(desktopSidebar?.x).toBeGreaterThan((desktopCard?.x ?? 0) + (desktopCard?.width ?? 0));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const mobilePosition = await page.locator('.profile-sidebar').evaluate(
    (sidebar) => getComputedStyle(sidebar).position
  );
  const mobileSidebar = await page.locator('.profile-sidebar').boundingBox();
  const mobileCard = await page.locator('article[data-post-card]').first().boundingBox();
  expect(mobilePosition).toBe('static');
  expect(mobileSidebar?.y).toBeLessThan(mobileCard?.y ?? 0);
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
  const firstCard = await page.locator('article[data-post-card]').first().boundingBox();
  expect(sidebar?.width).toBeGreaterThan(340);
  expect(firstCard?.width).toBeGreaterThan(340);
});
