import { expect, test } from '@playwright/test';

test.use({ channel: process.env.HATRIX_TEST_CHROME === '1' ? 'chrome' : undefined });

test('sanctuary cards initialize on direct load, refresh, and return from blogs', async ({ page }) => {
  await page.goto('/sanctuary/');
  await page.locator('[data-unlock-form] input[name="key"]').fill(process.env.HATRIX_TEST_KEY ?? 'test-admin');
  await page.locator('[data-unlock-form] button[type="submit"]').click();
  await expect(page.locator('[data-protected-gate]')).toHaveAttribute('data-protected-state', 'ready');

  const cards = page.locator('[data-post-card]');
  const count = await cards.count();
  test.skip(count < 2, 'Coverflow needs at least two private sanctuary articles');

  await expect(cards.first()).toHaveAttribute('data-active', 'true');
  await expect.poll(() => cards.first().evaluate((card) => card.style.transform)).toContain('translateY');
  expect(await cards.nth(1).evaluate((card) => card.style.transform))
    .not.toBe(await cards.first().evaluate((card) => card.style.transform));
  await expect(cards.locator('h2 svg')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('[data-protected-gate]')).toHaveAttribute('data-protected-state', 'ready');
  await expect(cards).toHaveCount(count);
  await expect(cards.first()).toHaveAttribute('data-active', 'true');
  await cards.first().locator('h2 a').focus();
  for (let index = 1; index < count; index++) {
    await page.keyboard.press('ArrowDown');
    await expect(cards.nth(index)).toHaveAttribute('data-active', 'true');
  }

  await page.locator('.desktop-nav a[href="/blogs/"]').click();
  await expect(page).toHaveURL('/blogs/');
  await expect(page.locator('[data-post-card][data-active="true"]')).toHaveCount(1);
  await page.locator('.desktop-nav a[href="/sanctuary/"]').click();
  await expect(page).toHaveURL('/sanctuary/');
  await expect(page.locator('[data-protected-gate]')).toHaveAttribute('data-protected-state', 'ready');
  await expect(cards).toHaveCount(count);
  await expect(cards.first()).toHaveAttribute('data-active', 'true');
});
