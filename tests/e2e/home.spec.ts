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

  await page.goto('/page/3/');
  await expect(
    page.locator('a[href="/posts/FPGA开发(1)Vivado+Vitis 使用/"]').first()
  ).toBeVisible();
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
