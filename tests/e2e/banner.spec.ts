import { expect, test } from '@playwright/test';

test('home stage fills the viewport without a wave divider', async ({ page }) => {
  await page.goto('/');

  const homeStage = page.locator('[data-home-stage]');
  await expect(homeStage).toBeVisible();
  const stage = await homeStage.boundingBox();
  expect(stage?.height).toBe(await page.evaluate(() => document.documentElement.clientHeight));
  await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
});

test('non-home pages use the blog category header and omit article cover banners without a wave divider', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900, bannerHeight: 240 },
    { width: 390, height: 844, bannerHeight: 200 }
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ['/blog/', '/blog/all/', '/posts/本科数学大杂烩/']) {
      await page.goto(route);
      if (route === '/blog/') await expect(page.locator('[data-blog-category-nav]')).toBeVisible();
      else if (route.startsWith('/posts/')) await expect(page.locator('.post-hero')).toHaveCount(0);
      else await expect(page.locator('[data-hero]')).toBeVisible();
      await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
    }
  }
});
