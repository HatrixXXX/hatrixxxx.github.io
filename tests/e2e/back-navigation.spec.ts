import { expect, test } from '@playwright/test';
import { ABOUT_SECTION_LINKS } from '../../src/config/navigation';

for (const { route, href, label } of [
  ...[
    '/about/', '/guestbook/', '/plans/', '/digest/', '/playground/', '/archives/', '/404.html',
    ...ABOUT_SECTION_LINKS.map(({ href }) => href),
    ...Array.from({ length: 6 }, (_, index) => `/page/${index + 2}/`)
  ].map((route) => ({ route, href: '/', label: '返回主页' })),
  { route: '/blogs/', href: '/', label: '返回主页' },
  { route: '/posts/Infra-线性代数/', href: '/blogs/', label: '返回博客文章' }
]) {
  test(`${route} exposes a consistent back destination`, async ({ page }) => {
    await page.goto(route);
    const backButton = page.locator('[data-back-button]');
    await expect(backButton).toHaveAttribute('href', href);
    await expect(backButton).toHaveAttribute('aria-label', label);
    await expect(backButton).toBeVisible();
    await backButton.click();
    await expect(page).toHaveURL(href);
  });
}

test('/creation/ keeps the book as its only local control surface', async ({ page }) => {
  await page.goto('/creation/');
  await expect(page.locator('[data-back-button]')).toHaveCount(0);
  await expect(page.locator('header[data-site-header] .desktop-nav a[href="/"]')).toBeVisible();
});

test('back button stays at the same top-left position on desktop and mobile', async ({ page }) => {
  const positions: Array<{ x: number; y: number }> = [];
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/blogs/');
    const box = await page.locator('[data-back-button]').boundingBox();
    if (!box) throw new Error('Missing back button bounds');
    positions.push({ x: Math.round(box.x), y: Math.round(box.y) });
  }

  expect(positions).toEqual([
    { x: 40, y: 64 },
    { x: 20, y: 53 }
  ]);
});
