import { expect, test } from '@playwright/test';
import { SOFTWARE_TOOLS } from '../../src/data/software-tools';

const SHELF_SIZE = 8;

test('toolbox renders dense shelves with safe external links', async ({ page }) => {
  await page.goto('/about/software/');

  await expect(page.locator('[data-hero]')).toHaveCount(0);
  await expect(page.locator('[data-page-subtitle]')).toHaveText('收录常用软件、在线工具和工作中会反复打开的站点。');
  await expect(page.locator('[data-tool-group], .cabinet-note')).toHaveCount(0);
  await expect(page.locator('[data-tool-shelf]')).toHaveCount(3);
  await expect(page.locator('[data-tool-specimen]')).toHaveCount(SOFTWARE_TOOLS.length);
  await expect(page.getByText('内容还在整理')).toHaveCount(0);

  const softwareShelf = page.locator('[data-tool-shelf][data-shelf-kind="software"]');
  const linkShelves = page.locator('[data-tool-shelf][data-shelf-kind="link"]');
  await expect(softwareShelf).toHaveCount(1);
  await expect(linkShelves).toHaveCount(2);
  await expect(softwareShelf.locator('[data-tool-slot]')).toHaveCount(6);
  await expect(softwareShelf.locator('[data-tool-specimen]')).toHaveCount(6);
  await expect(softwareShelf.locator('[data-tool-kind="link"]')).toHaveCount(0);
  await expect(linkShelves.nth(0).locator('[data-tool-slot]')).toHaveCount(SHELF_SIZE);
  await expect(linkShelves.nth(0).locator('[data-tool-specimen]')).toHaveCount(SHELF_SIZE);
  await expect(linkShelves.nth(1).locator('[data-tool-slot]')).toHaveCount(SHELF_SIZE);
  await expect(linkShelves.nth(1).locator('[data-tool-specimen]')).toHaveCount(2);
  await expect(linkShelves.nth(1).locator('[data-tool-slot][data-empty]')).toHaveCount(6);
  await expect(linkShelves.locator('[data-tool-kind="software"]')).toHaveCount(0);
  await expect(softwareShelf.locator('.tool-grid')).toHaveCSS('column-gap', '10px');
  await expect(linkShelves.nth(0).locator('.tool-grid')).toHaveCSS('column-gap', '10px');
  expect((await softwareShelf.locator('[data-tool-specimen]').first().boundingBox())?.height)
    .toBeLessThan(180);

  const software = page.locator('[data-tool-kind="software"]').first();
  const webLink = page.locator('[data-tool-kind="link"]').first();
  const [softwareVessel, linkVessel] = await Promise.all([
    software.locator('.tool-vessel').boundingBox(),
    webLink.locator('.tool-vessel').boundingBox()
  ]);
  if (!softwareVessel || !linkVessel) throw new Error('Missing tool vessel geometry');
  expect(softwareVessel.width / linkVessel.width).toBeCloseTo(1.5, 1);
  expect(softwareVessel.height / linkVessel.height).toBeCloseTo(1.5, 1);
  expect(softwareVessel.width).toBeLessThan(118);
  expect(softwareVessel.height).toBeLessThan(148);

  const transfer = page.getByRole('link', { name: /轻松传.*在不同设备间临时传输文件/ });
  await expect(transfer).toHaveAttribute('href', 'https://easychuan.cn/');
  await expect(transfer).toHaveAttribute('target', '_blank');
  await expect(transfer).toHaveAttribute('rel', 'noreferrer');

  const links = page.locator('[data-tool-specimen]');
  for (let index = 0; index < await links.count(); index += 1) {
    await expect(links.nth(index)).toHaveAttribute('href', /^https:\/\//);
    await expect(links.nth(index).locator('[data-tool-purpose]')).not.toHaveText('');
  }
});

test('tool purpose responds to hover and remains readable on a narrow screen', async ({ page }) => {
  await page.goto('/about/software/');

  const powerToys = page.getByRole('link', { name: /PowerToys.*补充窗口管理/ });
  const purpose = powerToys.locator('[data-tool-purpose]');
  await powerToys.hover();
  await expect(purpose).toHaveCSS('opacity', '1');

  await page.mouse.move(0, 0);
  await page.getByRole('link', { name: '返回主页' }).focus();
  await page.keyboard.press('Tab');
  await expect(powerToys).toBeFocused();
  await expect(purpose).toHaveCSS('opacity', '1');
  expect(await powerToys.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const reducedPowerToys = page.getByRole('link', { name: /PowerToys.*补充窗口管理/ });
  await reducedPowerToys.hover();
  await expect(reducedPowerToys.locator('[data-tool-purpose]')).toHaveCSS('transform', 'none');
  await expect(reducedPowerToys.locator('.tool-vessel')).toHaveCSS('transform', 'none');
});

test('tool purpose is readable before interaction on a touch screen', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.goto('/about/software/');

  const transfer = page.getByRole('link', { name: /轻松传.*在不同设备间临时传输文件/ });
  await expect(transfer.locator('[data-tool-purpose]')).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  const firstShelf = page.locator('[data-tool-shelf]').first();
  expect(await firstShelf.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  await context.close();
});
