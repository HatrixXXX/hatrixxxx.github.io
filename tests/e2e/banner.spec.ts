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
    for (const route of ['/blog/all/', '/posts/本科数学大杂烩/']) {
      await page.goto(route);
      if (route.startsWith('/posts/')) await expect(page.locator('.post-hero')).toHaveCount(0);
      else {
        const hero = page.locator('[data-hero]');
        await expect(hero).toBeVisible();
        expect((await hero.boundingBox())?.height).toBe(viewport.bannerHeight);
        const imageWidth = await hero.evaluate(async (element) => {
          const background = getComputedStyle(element).backgroundImage;
          const image = new Image();
          image.src = background.slice(5, -2);
          await image.decode();
          return image.naturalWidth;
        });
        expect(imageWidth).toBeGreaterThan(0);
      }
      await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
    }
  }
});
