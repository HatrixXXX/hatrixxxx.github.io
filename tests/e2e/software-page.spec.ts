import { expect, test } from '@playwright/test';
import { SOFTWARE_TOOLS } from '../../src/data/software-tools';

test('toolbox renders one text-free square module grid with safe external links', async ({ page }) => {
  await page.goto('/about/software/');

  await expect(page.locator('[data-hero]')).toHaveCount(0);
  await expect(page.locator('[data-page-subtitle]')).toHaveCount(0);
  await expect(page.locator('[data-tool-grid]')).toHaveCount(1);
  await expect(page.locator('[data-tool-module]')).toHaveCount(SOFTWARE_TOOLS.length);

  const gridColumns = await page.locator('[data-tool-grid]').evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length
  );
  expect(gridColumns).toBe(4);

  const firstFace = page.locator('[data-tool-face]').first();
  const faceBox = await firstFace.boundingBox();
  if (!faceBox) throw new Error('Missing tool module face geometry');
  expect(faceBox.width / faceBox.height).toBeCloseTo(1, 1);
  expect(faceBox.width).toBeGreaterThanOrEqual(88);
  await expect(page.locator('[data-tool-module]').first()).toHaveText('');

  const transfer = page.getByRole('link', { name: /轻松传.*在不同设备间临时传输文件/ });
  await expect(transfer).toHaveAttribute('href', 'https://easychuan.cn/');
  await expect(transfer).toHaveAttribute('target', '_blank');
  await expect(transfer).toHaveAttribute('rel', 'noreferrer');

  const links = page.locator('[data-tool-module]');
  for (let index = 0; index < await links.count(); index += 1) {
    await expect(links.nth(index)).toHaveAttribute('href', /^https:\/\//);
    await expect(links.nth(index)).toHaveAttribute('data-tool-description', /\S/);
  }
});

test('the fluorescent readout starts with real content and follows hover and keyboard focus', async ({ page }) => {
  await page.goto('/about/software/');

  const readout = page.locator('[data-tool-readout]');
  await expect(readout.locator('[data-tool-readout-name]')).toHaveText('PowerToys');
  await expect(readout.locator('[data-tool-readout-description]')).toContainText('补充窗口管理');

  const powerToys = page.getByRole('link', { name: /PowerToys.*补充窗口管理/ });
  await powerToys.hover();
  await expect(readout.locator('[data-tool-readout-name]')).toHaveText('PowerToys');
  await expect(readout.locator('[data-tool-readout-description]')).toContainText('补充窗口管理');

  const snipaste = page.getByRole('link', { name: /Snipaste.*截图/ });
  await snipaste.focus();
  await expect(snipaste).toBeFocused();
  await expect(readout.locator('[data-tool-readout-name]')).toHaveText('Snipaste');
  await expect(readout.locator('[data-tool-readout-description]')).toContainText('截图');
  expect(await snipaste.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');

});

test('touch layout keeps all copy inside the readout and the document within the viewport', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.goto('/about/software/');

  const powerToys = page.getByRole('link', { name: /PowerToys.*补充窗口管理/ });
  await expect(powerToys).toHaveText('');
  await expect(page.locator('[data-tool-readout]')).toBeVisible();
  await expect(page.locator('[data-tool-readout-name]')).toHaveText('PowerToys');
  await expect(page.locator('[data-tool-readout-description]')).toContainText('补充窗口管理');

  const columns = await page.locator('[data-tool-grid]').evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length
  );
  expect(columns).toBe(4);

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  await context.close();
});
