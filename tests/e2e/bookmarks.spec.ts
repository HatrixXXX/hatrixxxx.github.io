import { expect, test } from '@playwright/test';

test('bookmark files respond to pointer, keyboard, and detail actions', async ({ page }) => {
  await page.goto('/favorites/');
  await page.locator('[data-bookmark-console][data-bound]').waitFor();
  const files = page.locator('[data-bookmark-file]');
  await expect(files).toHaveCount(18);
  await expect(files.first()).toHaveAttribute('data-selected', '');

  await files.nth(1).hover();
  await expect(files.nth(1)).toHaveAttribute('data-selected', '');
  await expect(page.locator('[data-bookmark-current]')).toHaveText("X-Jeff's Blog");

  await page.keyboard.press('ArrowRight');
  await expect(files.nth(2)).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: "Siboehm's Blog" })).toBeVisible();
  await expect(dialog.getByRole('link', { name: '访问网站' })).toHaveAttribute('href', 'https://siboehm.com/');

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(files.nth(2)).toBeFocused();
});
