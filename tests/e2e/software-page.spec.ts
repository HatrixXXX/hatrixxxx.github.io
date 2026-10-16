import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('toolbox shows the three-dimensional sample without flat tool cards', async ({ page }) => {
  await page.goto('/toolbox/');

  await expect(page.locator('[data-tool-cube]')).toBeVisible();
  await expect(page.getByRole('button', { name: '放大查看 VS Code 方块' })).toBeEnabled();
  await expect(page.locator('[data-cube-trigger]')).toHaveCount(40);
  await expect(page.locator('[data-tool-cube]')).toHaveAttribute('data-cube-count', '40');
  await expect(page.locator('[data-foam-trigger]')).toHaveCount(0);
  await expect(page.locator('[data-tool-module], .tool-socket')).toHaveCount(0);
});

test('each tool cube opens its matching inspection view and attracts the magnetic cursor', async ({ page }) => {
  await page.goto('/toolbox/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const cube = page.getByRole('button', { name: '放大查看 ContextMenuManager 方块' });
  await expect(cube).toBeEnabled();
  const box = await cube.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.locator('body > [data-magnetic-frame]')).toHaveAttribute('data-active', '');
  await cube.click({ force: true });
  await expect(page.getByRole('dialog', { name: 'ContextMenuManager 方块预览' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cube).toBeFocused();
});

test('phone toolbox keeps the cube within the viewport', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 }
  });
  try {
    const page = await context.newPage();
    await page.goto('/toolbox/');
    await expect(page.locator('[data-tool-cube]')).toBeVisible();
    await expect(page.locator('[data-tool-module], .tool-socket')).toHaveCount(0);
    const viewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  } finally {
    await context.close();
  }
});
