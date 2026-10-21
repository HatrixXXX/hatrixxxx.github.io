import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('random picks from a shuffled link queue while wheel browsing keeps archive order', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/favorites/');
  await expect(page.locator('[data-favorites]')).toHaveAttribute('data-bound', '');

  const reel = page.locator('[data-favorites-reel]');
  const random = page.locator('[data-favorites-random]');
  await random.click();
  await expect(reel.locator('[data-favorites-item][data-index="1"]')).toHaveAttribute('data-selected', 'true');
  await random.click();
  await expect(reel.locator('[data-favorites-item][data-index="2"]')).toHaveAttribute('data-selected', 'true');

  await reel.hover();
  await page.mouse.wheel(0, 110);
  await expect(reel.locator('[data-favorites-item][data-index="3"]')).toHaveAttribute('data-selected', 'true');
});
