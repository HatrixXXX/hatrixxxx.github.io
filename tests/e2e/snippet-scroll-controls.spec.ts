import { expect, test } from '@playwright/test';

test.use({ channel: process.env.HATRIX_TEST_CHROME === '1' ? 'chrome' : undefined, hasTouch: true });

test('snippet overview controls jump to the bottom and back to the top', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/snippets/');
  await page.locator('[data-unlock-form] input[name="key"]').fill('test-admin');
  await page.locator('[data-unlock-form] button[type="submit"]').click();
  await expect(page.locator('[data-protected-gate]')).toHaveAttribute('data-protected-state', 'ready');

  await page.locator('[data-snippets-timeline]').evaluate((main) => {
    const spacer = document.createElement('div');
    spacer.style.height = '1800px';
    main.append(spacer);
  });

  const top = page.getByRole('button', { name: '回到顶部' });
  const bottom = page.getByRole('button', { name: '去往底部' });
  await expect(top).toBeHidden();
  await expect(bottom).toBeVisible();

  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
  await expect(top).toBeVisible();
  const topBox = await top.boundingBox();
  const bottomBox = await bottom.boundingBox();
  expect(topBox).not.toBeNull();
  expect(bottomBox).not.toBeNull();
  expect(topBox!.y + topBox!.height).toBeLessThan(bottomBox!.y);
  expect(bottomBox!.width).toBe(88);
  expect(bottomBox!.height).toBe(88);
  expect(bottomBox!.x + bottomBox!.width).toBe(1440 - 80);
  expect(bottomBox!.y + bottomBox!.height).toBe(900 - 80);

  await bottom.click();
  await expect.poll(() => page.evaluate(() =>
    Math.round(document.documentElement.scrollHeight - window.innerHeight - window.scrollY)
  )).toBeLessThanOrEqual(2);
  await expect(top).toBeVisible();
  await expect(bottom).toBeHidden();
  const topAtBottomBox = await top.boundingBox();
  expect(topAtBottomBox).not.toBeNull();
  expect(topAtBottomBox!.y).toBeCloseTo(topBox!.y, 0);

  await top.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(top).toBeHidden();
  await expect(bottom).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
  await expect(top).toBeVisible();
  const mobileTopBox = await top.boundingBox();
  const mobileBottomBox = await bottom.boundingBox();
  expect(mobileTopBox).not.toBeNull();
  expect(mobileBottomBox).not.toBeNull();
  expect(mobileTopBox!.y + mobileTopBox!.height).toBeLessThan(mobileBottomBox!.y);
  expect(mobileBottomBox!.x + mobileBottomBox!.width).toBe(390 - 40);
  expect(mobileBottomBox!.y + mobileBottomBox!.height).toBeCloseTo(844 - 40, 0);
  const mobileMotion = await top.evaluate((button) => getComputedStyle(button).transitionProperty);
  expect(mobileMotion).toContain('opacity');
  expect(await top.evaluate((button) => getComputedStyle(button).transitionDuration)).not.toBe('0s');

  await bottom.focus();
  await page.keyboard.press('Enter');
  await expect(bottom).toBeHidden();
  await expect.poll(() => page.locator('[data-back-to-bottom]').evaluate((button) => getComputedStyle(button).opacity)).toBe('0');
  await top.tap();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect.poll(() => page.locator('[data-back-to-top]').evaluate((button) => getComputedStyle(button).opacity)).toBe('0');
});
