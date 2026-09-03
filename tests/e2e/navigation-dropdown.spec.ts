import { expect, test } from '@playwright/test';

test('desktop navigation reveals only the active Blog or About submenu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const blogItem = page.locator('[data-nav-item="博客文章"]');
  const aboutItem = page.locator('[data-nav-item="关于我"]');
  const blogSubmenu = blogItem.locator(':scope > .submenu');
  const aboutSubmenu = aboutItem.locator(':scope > .submenu');

  await expect(blogSubmenu).toBeHidden();
  await expect(aboutSubmenu).toBeHidden();

  await blogItem.hover();
  await expect(blogSubmenu).toBeVisible();
  await expect(aboutSubmenu).toBeHidden();

  await blogItem.locator(':scope > a').focus();
  await aboutItem.hover();
  await expect(blogSubmenu).toBeHidden();
  await expect(aboutSubmenu).toBeVisible();

  await aboutItem.locator(':scope > a').focus();
  await expect(aboutSubmenu).toBeVisible();
  await expect(blogSubmenu).toBeHidden();
});

test('mobile navigation renders primary and nested links in the open menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '切换导航栏' }).click();

  const mobileMenu = page.locator('[data-mobile-menu]');
  await expect(mobileMenu.locator(':scope > ul > li > a')).toHaveCount(5);
  await expect(mobileMenu.getByRole('link', { name: '技术笔记', exact: true })).toBeVisible();
  await expect(mobileMenu.getByRole('link', { name: '我的友链', exact: true })).toBeVisible();
});
