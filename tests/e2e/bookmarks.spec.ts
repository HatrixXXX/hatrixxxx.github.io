import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('the favorites reel selects a real link by wheel, drag, and keyboard', async ({ page }) => {
  await page.goto('/favorites/');
  const reel = page.locator('[data-favorites-reel]');
  const selected = page.locator('[data-favorites-selected]');
  const visit = page.locator('[data-favorites-visit]');

  await expect(selected).toHaveText('扬神的博客');
  await reel.hover();
  await page.mouse.wheel(0, 110);
  await expect(selected).toHaveText("X-Jeff's Blog");
  await expect(visit).toHaveAttribute('href', 'https://shichaoxin.com/');

  const bounds = await reel.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2 - 90, { steps: 5 });
  await page.mouse.up();
  await expect(selected).toHaveText("Siboehm's Blog");

  await reel.focus();
  await page.keyboard.press('ArrowDown');
  await expect(selected).toHaveText('Git Game');
  await expect(visit).toHaveAttribute('target', '_blank');
});

test('random spin lands on another saved link and reduced motion resolves immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/favorites/');
  const selected = page.locator('[data-favorites-selected]');
  await page.getByRole('button', { name: '随机转一个链接' }).click();
  await expect(selected).not.toHaveText('扬神的博客');
  await expect(page.locator('[data-favorites-status]')).toContainText('已选中');
  await expect(page.locator('[data-favorites-visit]')).toHaveAttribute('href', /^https:\/\//);
});

test('random spin visibly turns and then settles on a different link', async ({ page }) => {
  await page.goto('/favorites/');
  const selected = page.locator('[data-favorites-selected]');
  await page.getByRole('button', { name: '随机转一个链接' }).click();
  await expect(page.locator('[data-favorites-status]')).toHaveText('正在随机转动…');
  await expect(page.locator('[data-favorites-status]')).toContainText('已选中', { timeout: 10000 });
  await expect(selected).not.toHaveText('扬神的博客');
});

test('random spin cancels when the page becomes hidden', async ({ page }) => {
  await page.goto('/favorites/');
  await page.getByRole('button', { name: '随机转一个链接' }).click();
  await expect(page.locator('[data-favorites-reel]')).toHaveAttribute('aria-busy', 'true');
  const stillBusy = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    return document.querySelector('[data-favorites-reel]')?.getAttribute('aria-busy');
  });
  expect(stillBusy).toBeNull();
  const selected = await page.locator('[data-favorites-selected]').textContent();
  await page.waitForTimeout(1200);
  await expect(page.locator('[data-favorites-selected]')).toHaveText(selected ?? '');
});
