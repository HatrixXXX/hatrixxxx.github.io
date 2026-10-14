import { expect, test } from '@playwright/test';

const titles = [
  'FPGA-3DGS渲染',
  'CoNet在线笔记',
  'RoboMaster步兵',
  'DreamChaser战队周边',
  '实验室文化墙'
];

test('atlas starts on its cover and reads one work per turned page', async ({ page }) => {
  await page.goto('/creation/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const book = page.locator('[data-project-book]');
  await expect(book).toBeVisible();
  await expect(book.locator('.book-float')).toHaveCSS('animation-name', 'book-breathe');
  await expect(page.locator('.project-atlas-head, .project-atlas-rail, .project-atlas-grid')).toHaveCount(0);
  await expect(page.locator('[data-music-player]')).toBeVisible();
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-ui-state', 'collapsed');
  await expect(book.getByRole('button', { name: '翻开作品图鉴' })).toBeVisible();
  const coverImage = book.locator('[data-book-cover-image]');
  await expect(coverImage).toHaveAttribute('src', '/assets/projects/project-atlas-cover-v1.webp');
  await expect.poll(() => coverImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(900);
  await expect(page.locator('[data-project-page]')).toHaveCount(5);

  await book.getByRole('button', { name: '翻开作品图鉴' }).focus();
  await page.keyboard.press('Enter');
  await expect(book).toHaveAttribute('data-current-page', '1');
  await expect(book.locator('[data-book-leaf][data-index="0"]')).toHaveAttribute('data-flipped', '');
  const first = book.locator('[data-project-page="1"]');
  await expect(first).toContainText(titles[0]);
  await expect(first).toHaveAttribute('data-scanning', '');
  await expect(first).toHaveAttribute('data-revealed', '');
  await expect(first).toContainText('制作经历');
  await expect(first).toContainText('过程趣事');
  await expect(first).toContainText('照片待补充');

  for (let index = 1; index < titles.length; index += 1) {
    await book.locator(`[data-project-page="${index}"] [data-turn-next]`).click({ force: true });
    await expect(book).toHaveAttribute('data-current-page', String(index + 1));
    await expect(book.locator(`[data-project-page="${index + 1}"]`)).toContainText(titles[index]);
  }
  await expect(book.locator('[data-project-page="5"] [data-turn-next]')).toHaveCount(0);

  await expect(book.locator('[data-project-page="5"]')).toHaveAttribute('data-revealed', '');
  await page.keyboard.press('ArrowLeft');
  await expect(book).toHaveAttribute('data-current-page', '4');
  await expect(book.locator('[data-project-page="4"]')).toHaveAttribute('data-revealed', '');
});

test('book remains legible on mobile and opens pages directly with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/creation/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const book = page.locator('[data-project-book]');
  await expect(book.locator('.book-float')).toHaveCSS('animation-name', 'none');
  await book.getByRole('button', { name: '翻开作品图鉴' }).click({ force: true });
  const first = book.locator('[data-project-page="1"]');
  await expect(first).toHaveAttribute('data-revealed', '');
  await expect(first.getByRole('heading', { name: titles[0] })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await first.getByRole('button', { name: '返回封面' }).click({ force: true });
  await expect(book).toHaveAttribute('data-current-page', '0');
  await expect(book.locator('[data-book-leaf][data-index="0"]')).not.toHaveAttribute('data-flipped');
  await expect(book.getByRole('button', { name: '翻开作品图鉴' })).toBeFocused();
});
