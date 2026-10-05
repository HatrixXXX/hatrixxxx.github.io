import { expect, test } from '@playwright/test';

test('home stage fills the viewport without a wave divider', async ({ page }) => {
  await page.goto('/');

  const homeStage = page.locator('[data-home-stage]');
  await expect(homeStage).toBeVisible();
  const stage = await homeStage.boundingBox();
  expect(stage?.height).toBe(await page.evaluate(() => document.documentElement.clientHeight));
  await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
});

test('primary navigation pages omit title and subtitle banners while article pages keep their own intro', async ({ page }) => {
  const routes = [
    '/blog/',
    '/projects/',
    '/about/',
    '/about/bookmarks/',
    '/about/software/',
    '/about/gear/',
    '/plans/',
    '/lab/',
    '/about/friends/',
    '/guestbook/'
  ] as const;

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('[data-hero]')).toHaveCount(0);
      await expect(page.locator('[data-page-subtitle]')).toHaveCount(0);
      const main = page.locator('main');
      await expect(main).toBeVisible();
      await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
    }

    await page.goto('/posts/Infra-线性代数/');
    await expect(page.locator('[data-hero], .post-hero')).toHaveCount(0);
    await expect(page.locator('.post-intro h1')).toHaveText('Infra-线性代数');
    await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
  }
});
