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

test('/creation/ keeps its return action in the header', async ({ page }) => {
  await page.goto('/creation/');
  await expect(page.locator('[data-back-button]')).toHaveAttribute('href', '/');
  await expect(page.locator('header[data-site-header] .desktop-nav a[href="/"]')).toBeVisible();
});

test('back button mirrors the search control at both edges of the header', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/blogs/');
    const back = await page.locator('[data-back-button]').boundingBox();
    const search = await page.locator('[data-open-search]').boundingBox();
    const header = await page.locator('[data-site-header]').boundingBox();
    if (!back || !search || !header) throw new Error('Missing header control bounds');
    expect(Math.round(back.x)).toBe(Math.round(viewport.width - search.x - search.width));
    expect(Math.round(back.y)).toBe(Math.round(search.y));
    expect(Math.round(back.width)).toBe(Math.round(search.width));
    expect(back.y + back.height).toBeLessThanOrEqual(header.y + header.height);
  }
});
