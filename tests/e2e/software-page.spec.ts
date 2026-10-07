import { expect, test } from '@playwright/test';
import { SOFTWARE_TOOLS } from '../../src/data/software-tools';

test('toolbox presents nine readable colored cards per row', async ({ page }) => {
  await page.goto('/about/software/');

  const cards = page.locator('[data-tool-module]');
  await expect(page.locator('[data-tool-readout]')).toHaveCount(0);
  await expect(page.locator('.tool-category')).toHaveCount(0);
  await expect(page.locator('[data-tool-grid]')).toHaveCount(1);
  await expect(cards).toHaveCount(SOFTWARE_TOOLS.length);

  const columns = await page.locator('[data-tool-grid]').evaluate((grid) =>
    getComputedStyle(grid).gridTemplateColumns.split(' ').length
  );
  expect(columns).toBe(9);

  const first = cards.first();
  await expect(first.locator('[data-tool-title]')).toHaveText('SolidWorks');
  await expect(first.locator('[data-tool-purpose]')).toHaveText('机械设计');
  await expect(first.locator('[data-tool-kind-badge]')).toHaveText('软件');
  await expect(first.locator('[data-tool-led]')).toHaveCount(2);
  await expect(first.locator('img')).toHaveAttribute('src', '/tool-icons/solidworks.svg');

  const cardBox = await first.boundingBox();
  const iconAreaBox = await first.locator('.tool-module__center').boundingBox();
  const purposeBox = await first.locator('[data-tool-purpose]').boundingBox();
  if (!cardBox || !iconAreaBox || !purposeBox) throw new Error('Missing card geometry');
  expect(cardBox.width).toBeGreaterThan(110);
  expect(purposeBox.y).toBeGreaterThanOrEqual(iconAreaBox.y + iconAreaBox.height - 1);
  expect(purposeBox.y + purposeBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);

  const clippedTitles = await page.locator('[data-tool-title]').evaluateAll((titles) =>
    titles.filter((title) => title.scrollHeight > title.clientHeight + 1).map((title) => title.textContent)
  );
  expect(clippedTitles).toEqual([]);

  const online = page.getByRole('link', { name: /轻松传.*文件传输/ });
  await expect(online.locator('[data-tool-kind-badge]')).toHaveText('在线');
  await expect(online).toHaveAttribute('href', 'https://easychuan.cn/');
  await expect(online).toHaveAttribute('target', '_blank');
  await expect(online).toHaveAttribute('rel', 'noreferrer');

  const firstColor = await first.evaluate((card) => getComputedStyle(card).borderColor);
  const everydayColor = await page.getByRole('link', { name: /PowerToys/ }).evaluate((card) => getComputedStyle(card).borderColor);
  const imageColor = await page.getByRole('link', { name: /Snipaste/ }).evaluate((card) => getComputedStyle(card).borderColor);
  expect(new Set([firstColor, everydayColor, imageColor]).size).toBe(3);

  const brokenIcons = await cards.locator('img').evaluateAll(async (images) => {
    const sources = images.map((image) => (image as HTMLImageElement).src);
    return (await Promise.all(sources.map((src) => new Promise<string | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0 ? null : src);
      image.onerror = () => resolve(src);
      image.src = src;
    })))).filter((src): src is string => src !== null);
  });
  expect(brokenIcons).toEqual([]);
});

test('full descriptions appear above a card on hover and keyboard focus', async ({ page }) => {
  await page.goto('/about/software/');
  await expect(page.locator('#page-loader')).not.toHaveClass(/pl-visible/);

  const solidWorks = page.getByRole('link', { name: /SolidWorks.*三维机械设计/ });
  const tooltip = solidWorks.locator('[data-tool-tooltip]');
  await expect(tooltip).toContainText('用于零件、装配体与工程图的三维机械设计');
  await solidWorks.hover();
  await expect(tooltip).toHaveCSS('opacity', '1');

  const cardBox = await solidWorks.boundingBox();
  const tooltipBox = await tooltip.boundingBox();
  if (!cardBox || !tooltipBox) throw new Error('Missing card or tooltip geometry');
  expect(tooltipBox.y + tooltipBox.height).toBeLessThan(cardBox.y);
  expect(tooltipBox.y).toBeGreaterThanOrEqual(60);
  expect(Math.abs(tooltipBox.x + tooltipBox.width / 2 - cardBox.x - cardBox.width / 2)).toBeLessThan(1);
  await expect(tooltip).toHaveCSS('border-radius', '12px');
  await expect(tooltip).toHaveCSS('background-color', 'rgb(48, 49, 57)');

  const snipaste = page.getByRole('link', { name: /Snipaste.*截图/ });
  await snipaste.focus();
  await expect(snipaste).toBeFocused();
  await expect(snipaste.locator('[data-tool-tooltip]')).toHaveCSS('opacity', '1');
  expect(await snipaste.evaluate((card) => getComputedStyle(card).outlineStyle)).not.toBe('none');
});

test('phone cards retain readable labels and avoid horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await page.goto('/about/software/');

  const columns = await page.locator('[data-tool-grid]').evaluate((grid) =>
    getComputedStyle(grid).gridTemplateColumns.split(' ').length
  );
  expect(columns).toBe(3);
  await expect(page.locator('[data-tool-readout]')).toHaveCount(0);
  await expect(page.locator('[data-tool-module]').first().locator('[data-tool-title]')).toBeVisible();
  await expect(page.locator('[data-tool-module]').first().locator('[data-tool-purpose]')).toBeVisible();

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  await context.close();
});
