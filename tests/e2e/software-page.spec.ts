import { expect, test } from '@playwright/test';
import { SOFTWARE_TOOLS } from '../../src/data/software-tools';

test('toolbox renders square module arrays with safe external links', async ({ page }) => {
  await page.goto('/about/software/');

  await expect(page.locator('[data-hero]')).toHaveCount(0);
  await expect(page.locator('[data-page-subtitle]')).toHaveCount(0);
  await expect(page.locator('[data-tool-deck]')).toHaveCount(1);
  await expect(page.locator('[data-tool-group]')).toHaveCount(2);
  await expect(page.locator('[data-tool-group="software"] [data-tool-module]')).toHaveCount(6);
  await expect(page.locator('[data-tool-group="link"] [data-tool-module]')).toHaveCount(10);
  await expect(page.locator('[data-tool-module]')).toHaveCount(SOFTWARE_TOOLS.length);

  const softwareColumns = await page.locator('[data-tool-group="software"] [data-tool-grid]').evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length
  );
  expect(softwareColumns).toBe(6);

  const firstFace = page.locator('[data-tool-face]').first();
  const faceBox = await firstFace.boundingBox();
  if (!faceBox) throw new Error('Missing tool module face geometry');
  expect(faceBox.width / faceBox.height).toBeCloseTo(1, 1);
  expect(faceBox.width).toBeGreaterThanOrEqual(88);

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

test('hover and keyboard focus inspect a module without obscuring its link', async ({ page }) => {
  await page.goto('/about/software/');

  const readout = page.locator('[data-tool-readout]');
  const powerToys = page.getByRole('link', { name: /PowerToys.*补充窗口管理/ });
  await powerToys.hover();
  await expect(readout.locator('[data-tool-readout-name]')).toHaveText('PowerToys');
  await expect(readout.locator('[data-tool-readout-description]')).toContainText('补充窗口管理');
  expect(await powerToys.locator('[data-tool-face]').evaluate((element) =>
    getComputedStyle(element).transform
  )).not.toBe('none');

  const snipaste = page.getByRole('link', { name: /Snipaste.*截图/ });
  await snipaste.focus();
  await expect(snipaste).toBeFocused();
  await expect(readout.locator('[data-tool-readout-name]')).toHaveText('Snipaste');
  await expect(readout.locator('[data-tool-readout-description]')).toContainText('截图');
  expect(await snipaste.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const reducedPowerToys = page.getByRole('link', { name: /PowerToys.*补充窗口管理/ });
  await reducedPowerToys.hover();
  await expect(reducedPowerToys.locator('[data-tool-face]')).toHaveCSS('transform', 'none');
});

test('touch layout exposes descriptions and keeps the document within the viewport', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.goto('/about/software/');

  const powerToys = page.getByRole('link', { name: /PowerToys.*补充窗口管理/ });
  await expect(powerToys.locator('[data-tool-mobile-description]')).toBeVisible();
  await expect(powerToys.locator('[data-tool-mobile-description]')).toContainText('补充窗口管理');
  await expect(page.locator('[data-tool-readout]')).toBeHidden();

  const columns = await page.locator('[data-tool-group="software"] [data-tool-grid]').evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length
  );
  expect(columns).toBe(2);

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  await context.close();
});
