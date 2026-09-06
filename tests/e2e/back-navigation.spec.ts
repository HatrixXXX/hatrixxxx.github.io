import { expect, test } from '@playwright/test';

for (const { route, href, label } of [
  { route: '/blog/', href: '/', label: '返回主页' },
  { route: '/blog/all/', href: '/blog/', label: '返回博客文章分类' },
  { route: '/blog/tech-notes/', href: '/blog/', label: '返回博客文章分类' },
  { route: '/about/', href: '/', label: '返回主页' },
  { route: '/about/hobbies/', href: '/about/', label: '返回关于我' },
  { route: '/projects/', href: '/', label: '返回主页' },
  { route: '/guestbook/', href: '/', label: '返回主页' },
  { route: '/posts/本科数学大杂烩/', href: '/blog/tech-notes/', label: '返回技术笔记' }
]) {
  test(`${route} exposes a consistent back destination`, async ({ page }) => {
    await page.goto(route);
    const backButton = page.locator('[data-back-button]');
    await expect(backButton).toHaveAttribute('href', href);
    await expect(backButton).toHaveAttribute('aria-label', label);
    await expect(backButton).toBeVisible();
  });
}

test('back button stays at the same top-left position on desktop and mobile', async ({ page }) => {
  const positions: Array<{ x: number; y: number }> = [];
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/blog/');
    const box = await page.locator('[data-back-button]').boundingBox();
    if (!box) throw new Error('Missing back button bounds');
    positions.push({ x: Math.round(box.x), y: Math.round(box.y) });
  }

  expect(positions).toEqual([
    { x: 40, y: 64 },
    { x: 20, y: 53 }
  ]);
});
