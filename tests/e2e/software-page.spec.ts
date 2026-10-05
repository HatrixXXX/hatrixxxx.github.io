import { expect, test } from '@playwright/test';
import { SOFTWARE_TOOLS } from '../../src/data/software-tools';

test('toolbox renders categorized six-column modules with names and safe external links', async ({ page }) => {
  await page.goto('/about/software/');

  await expect(page.locator('[data-hero]')).toHaveCount(0);
  await expect(page.locator('[data-page-subtitle]')).toHaveCount(0);
  await expect(page.locator('[data-tool-category]')).toHaveCount(4);
  await expect(page.locator('[data-tool-category] h2')).toHaveText([
    '日常效率', '图片处理', '开发与图表', '阅读与研究'
  ]);
  await expect(page.locator('[data-tool-grid]')).toHaveCount(4);
  await expect(page.locator('[data-tool-module]')).toHaveCount(SOFTWARE_TOOLS.length);

  const gridColumns = await page.locator('[data-tool-grid]').first().evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length
  );
  expect(gridColumns).toBe(6);

  const firstFace = page.locator('[data-tool-face]').first();
  const faceBox = await firstFace.boundingBox();
  if (!faceBox) throw new Error('Missing tool module face geometry');
  expect(faceBox.width / faceBox.height).toBeCloseTo(1, 1);
  expect(faceBox.width).toBeGreaterThanOrEqual(88);
  expect(faceBox.width).toBeLessThan(130);
  await expect(page.locator('[data-tool-module]').first().locator('[data-tool-label]')).toHaveText('PowerToys');
  await expect(page.locator('[data-tool-category="image"] [data-tool-label]')).toHaveText([
    'Snipaste', 'remove.bg', 'Adobe Color'
  ]);

  const readoutBox = await page.locator('[data-tool-readout]').boundingBox();
  if (!readoutBox) throw new Error('Missing tool readout geometry');
  expect(readoutBox.y + readoutBox.height).toBeGreaterThanOrEqual(860);

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

test('desktop readout stays at the same viewport position when scrolling to the page bottom', async ({ page }) => {
  await page.goto('/about/software/');

  const readout = page.locator('[data-tool-readout]');
  const initialTop = await readout.evaluate((element) => element.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const scrolledTop = await readout.evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(scrolledTop - initialTop)).toBeLessThan(1);
});

test('touch layout shows names and categories without horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.goto('/about/software/');

  const powerToys = page.getByRole('link', { name: /PowerToys.*补充窗口管理/ });
  await expect(powerToys.locator('[data-tool-label]')).toHaveText('PowerToys');
  await expect(page.locator('[data-tool-category] h2')).toHaveText([
    '日常效率', '图片处理', '开发与图表', '阅读与研究'
  ]);
  await expect(page.locator('[data-tool-readout]')).toBeVisible();
  await expect(page.locator('[data-tool-readout-name]')).toHaveText('PowerToys');
  await expect(page.locator('[data-tool-readout-description]')).toContainText('补充窗口管理');

  const columns = await page.locator('[data-tool-grid]').first().evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length
  );
  expect(columns).toBe(3);

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  await context.close();
});
