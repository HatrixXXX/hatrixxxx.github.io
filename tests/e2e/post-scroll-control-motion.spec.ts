import { expect, test } from '@playwright/test';

test.use({ channel: process.env.HATRIX_TEST_CHROME === '1' ? 'chrome' : undefined });

test('post scroll control fades between scroll states without trapping focus', async ({ page }) => {
  await page.goto('/posts/Infra-概率论/');
  const top = page.getByRole('button', { name: '回到顶部', includeHidden: true });

  await expect(top).toBeHidden();
  await expect(top).toHaveAttribute('aria-hidden', 'true');
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
  await expect(top).toBeVisible();
  await expect(top).toHaveAttribute('aria-hidden', 'false');
  expect(await top.evaluate((button) => getComputedStyle(button).transitionProperty)).toContain('opacity');
  expect(await top.evaluate((button) => getComputedStyle(button).transitionDuration)).not.toBe('0s');

  await top.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(top).toBeHidden();
  await expect(top).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => top.evaluate((button) => getComputedStyle(button).opacity)).toBe('0');
  expect(await top.evaluate((button) => getComputedStyle(button).visibility)).toBe('hidden');
  expect(await top.evaluate((button) => getComputedStyle(button).pointerEvents)).toBe('none');
  expect(await top.evaluate((button) => document.activeElement === button)).toBe(false);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
  await expect(top).toBeVisible();
  expect(await top.evaluate((button) => getComputedStyle(button).transitionDuration)).toBe('0s');
});
