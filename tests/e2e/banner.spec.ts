import { expect, test } from '@playwright/test';

test('home stage fills the viewport without a wave divider', async ({ page }) => {
  await page.goto('/');

  const homeStage = page.locator('[data-home-stage]');
  await expect(homeStage).toBeVisible();
  const stage = await homeStage.boundingBox();
  expect(stage?.height).toBe(await page.evaluate(() => document.documentElement.clientHeight));
  await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
});

test('non-home banners share the compact height without a wave divider', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900, bannerHeight: 240 },
    { width: 390, height: 844, bannerHeight: 200 }
  ]) {
    await page.setViewportSize(viewport);
    const heights: number[] = [];

    for (const route of ['/blog/', '/posts/本科数学大杂烩/']) {
      await page.goto(route);
      const banner = page.locator('[data-hero], .post-hero').first();
      heights.push((await banner.boundingBox())?.height ?? 0);
      await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
    }

    expect(heights).toEqual([viewport.bannerHeight, viewport.bannerHeight]);
  }
});
