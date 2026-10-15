import { expect, test, type Page } from '@playwright/test';

const titles = [
  'FPGA-3DGS渲染',
  'CoNet在线笔记',
  'RoboMaster步兵',
  'DreamChaser战队周边',
  '实验室文化墙'
];

async function injectGalleryFixture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const showcase = document.querySelector<HTMLElement>('[data-project-showcase]')!;
    const media = showcase.querySelector<HTMLElement>('[data-project-detail="0"] [data-carousel]')!;
    const track = media.querySelector<HTMLElement>('[data-carousel-track]')!;
    media.querySelector<HTMLElement>('[data-carousel-viewport]')!.tabIndex = 0;
    const slide = track.querySelector<HTMLElement>('[data-carousel-slide]')!;
    track.append(slide.cloneNode(true), slide.cloneNode(true));
    const controls = document.createElement('div');
    controls.className = 'showcase-carousel-controls';
    controls.innerHTML = '<button type="button" data-carousel-prev aria-label="上一张图片">‹</button><span data-carousel-counter></span><button type="button" data-carousel-next aria-label="下一张图片">›</button>';
    media.append(controls);
    showcase.removeAttribute('data-bound');
    document.dispatchEvent(new Event('astro:page-load'));
  });
}

test('showcase displays equal catalog and detail windows immediately', async ({ page }) => {
  await page.goto('/creation/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const showcase = page.locator('[data-project-showcase]');
  await expect(showcase.locator('[data-showcase-window]')).toBeVisible();
  const windowSize = await showcase.locator('[data-showcase-window]').boundingBox();
  expect(windowSize?.width).toBeGreaterThan(1200);
  expect(windowSize?.width).toBeLessThan(1250);
  expect(windowSize?.height).toBeGreaterThan(800);
  expect(windowSize?.height).toBeLessThan(830);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1440);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900);
  await expect(showcase.locator('[data-catalog-panel]')).not.toContainText('作品展位');
  await expect(showcase.locator('[data-catalog-panel]')).not.toContainText('件作品');
  await expect(showcase.locator('[data-detail-panel]')).not.toContainText('01 / 05');
  await expect(showcase.locator('[data-detail-panel]')).not.toContainText('作品详情');
  await expect(showcase.locator('[data-project-badge]')).toHaveCount(5);
  await expect(showcase.locator('[data-empty-mount]')).toHaveCount(1);
  await expect(showcase.locator('[data-open-showcase], [data-close-showcase], [data-showcase-lid]')).toHaveCount(0);
  await expect(showcase.locator('[data-showcase-crest]')).toBeVisible();
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-ui-state', 'collapsed');
  await expect(showcase.locator('[data-project-badge="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.locator('[data-project-detail="0"]')).toBeVisible();

  await expect.poll(() => showcase.evaluate((element) => {
    const catalog = element.querySelector('[data-catalog-panel]')!.getBoundingClientRect();
    const detail = element.querySelector('[data-detail-panel]')!.getBoundingClientRect();
    return Math.abs(catalog.width - detail.width) + Math.abs(detail.left - catalog.right);
  })).toBeLessThan(2);
  await showcase.locator('[data-project-badge="4"]').click();
  await expect(showcase.locator('[data-project-badge="4"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.locator('[data-project-detail="4"]')).toContainText(titles[4]);
  await expect(showcase.locator('[data-project-detail="0"]')).toBeHidden();
  await expect(showcase.locator('[data-project-detail="4"]')).toContainText('项目介绍待补充。');
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(768);
});

test('showcase selection remains accessible on mobile with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/creation/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const showcase = page.locator('[data-project-showcase]');
  await expect(showcase).toHaveAttribute('data-mobile-view', 'catalog');
  await expect(showcase.locator('[data-project-detail="0"]')).toBeHidden();
  await showcase.locator('[data-project-badge="2"]').click();
  await expect(showcase).toHaveAttribute('data-mobile-view', 'detail');
  await expect(showcase.locator('[data-project-detail="2"]')).toContainText(titles[2]);
  await expect(showcase.locator('[data-project-detail="2"]')).toBeVisible();
  await expect(showcase.locator('[data-catalog-panel]')).toBeHidden();
  const detailScroll = showcase.locator('[data-project-detail="2"] [data-detail-scroll]');
  expect(await detailScroll.evaluate((element) => element.scrollHeight)).toBeGreaterThan(await detailScroll.evaluate((element) => element.clientHeight));
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await showcase.getByRole('button', { name: '返回作品展位' }).click();
  await expect(showcase).toHaveAttribute('data-mobile-view', 'catalog');
  await expect(showcase.locator('[data-catalog-panel]')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 667 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(667);
  await expect(showcase.locator('[data-project-badge="4"]')).toBeVisible();
});

test('local gallery wraps and stays clipped to the detail panel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await injectGalleryFixture(page);

  const media = page.locator('[data-project-detail="0"] [data-carousel]');
  const counter = media.locator('[data-carousel-counter]');
  await expect(counter).toHaveText('01 / 03');
  await media.getByRole('button', { name: '下一张图片' }).click();
  await expect(counter).toHaveText('02 / 03');
  await media.getByRole('button', { name: '下一张图片' }).click();
  await media.getByRole('button', { name: '下一张图片' }).click();
  await expect(counter).toHaveText('01 / 03');
  await media.getByRole('button', { name: '上一张图片' }).click();
  await expect(counter).toHaveText('03 / 03');
  const viewport = media.locator('[data-carousel-viewport]');
  await viewport.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 200 });
  await viewport.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 100 });
  await expect(counter).toHaveText('01 / 03');
  await viewport.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText('03 / 03');
  expect(await media.evaluate((element) => getComputedStyle(element).overflow)).toBe('hidden');
});

test('keyboard focus follows the catalog into the detail panel', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const showcase = page.locator('[data-project-showcase]');
  await showcase.locator('[data-project-badge="4"]').focus();
  await page.keyboard.press('Tab');
  await expect(showcase.locator('[data-project-detail="0"] [data-carousel-viewport]')).toBeFocused();
});

test('carousel remains usable when reduced motion turns on mid-slide', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await injectGalleryFixture(page);
  await page.addStyleTag({ content: '@media (prefers-reduced-motion: no-preference) { .showcase-carousel-track { transition-duration: 5s !important; } }' });
  const media = page.locator('[data-project-detail="0"] [data-carousel]');
  const counter = media.locator('[data-carousel-counter]');
  await media.getByRole('button', { name: '下一张图片' }).click();
  await expect(counter).toHaveText('02 / 03');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await media.getByRole('button', { name: '下一张图片' }).click();
  await expect(counter).toHaveText('03 / 03');
});
