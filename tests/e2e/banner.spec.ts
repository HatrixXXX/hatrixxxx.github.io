import { expect, test } from '@playwright/test';

test('home stage fills the viewport without a wave divider', async ({ page }) => {
  await page.goto('/');

  const homeStage = page.locator('[data-home-stage]');
  await expect(homeStage).toBeVisible();
  const stage = await homeStage.boundingBox();
  expect(stage?.height).toBe(await page.evaluate(() => document.documentElement.clientHeight));
  await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
});

test('the blog index uses a compact hero while article pages omit cover banners and wave dividers', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900, bannerHeight: 240 },
    { width: 390, height: 844, bannerHeight: 200 }
  ]) {
    await page.setViewportSize(viewport);

    await page.goto('/blog/');
    const hero = page.locator('[data-hero]');
    await expect(hero).toBeVisible();
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText('博客文章');
    const heroBox = await hero.boundingBox();
    expect(heroBox).not.toBeNull();
    expect(Math.round(heroBox!.y + heroBox!.height)).toBe(viewport.bannerHeight);
    await expect(page.locator('body')).not.toHaveCSS('background-image', 'none');
    await expect(page.locator('[data-wave-divider]')).toHaveCount(0);

    await page.goto('/posts/Infra-线性代数/');
    await expect(page.locator('[data-hero], .post-hero')).toHaveCount(0);
    await expect(page.locator('.post-intro h1')).toHaveText('Infra-线性代数');
    await expect(page.locator('[data-wave-divider]')).toHaveCount(0);
  }
});
