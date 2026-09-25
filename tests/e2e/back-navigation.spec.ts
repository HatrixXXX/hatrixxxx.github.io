import { expect, test } from '@playwright/test';
import { ABOUT_SECTION_LINKS, BLOG_SUBNAV_LINKS } from '../../src/config/navigation';

for (const { route, href, label } of [
  ...[
    '/about/', '/projects/', '/guestbook/', '/plans/', '/lab/', '/archives/', '/404.html',
    ...ABOUT_SECTION_LINKS.map(({ href }) => href),
    ...Array.from({ length: 6 }, (_, index) => `/page/${index + 2}/`)
  ].map((route) => ({ route, href: '/', label: '返回主页' })),
  { route: '/blog/all/', href: '/', label: '返回主页' },
  ...BLOG_SUBNAV_LINKS.filter(({ slug }) => slug !== 'all').map(({ href: route }) => ({ route, href: '/blog/all/', label: '返回博客文章' })),
  { route: '/posts/本科数学大杂烩/', href: '/blog/tech-notes/', label: '返回技术笔记' }
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

test('back button stays at the same top-left position on desktop and mobile', async ({ page }) => {
  const positions: Array<{ x: number; y: number }> = [];
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/blog/all/');
    const box = await page.locator('[data-back-button]').boundingBox();
    if (!box) throw new Error('Missing back button bounds');
    positions.push({ x: Math.round(box.x), y: Math.round(box.y) });
  }

  expect(positions).toEqual([
    { x: 40, y: 64 },
    { x: 20, y: 53 }
  ]);
});
