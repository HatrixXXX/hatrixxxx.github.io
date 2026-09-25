import { expect, test } from '@playwright/test';

const EXPECTED_PRIMARY_LINKS = ['首页', '博客文章', '作品橱窗', '书签', '软件', '装备', '计划', '实验场', '友链', '留言板'];
const EXPECTED_BLOG_LINKS = ['全部文章', '技术笔记', '踩坑记录', '生活动态', '好物推荐', '随笔杂谈'];
const DESKTOP_WIDTHS = [1200, 1440, 1920, 2560];

const contrastRatio = (foreground: string, background: string) => {
  const luminance = (color: string) => {
    const [red, green, blue] = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const channels = [red, green, blue].map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

test('home keeps its independent About entry without the shared header', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-site-header]')).toHaveCount(0);
  const about = page.locator('[data-home-panel="about"] a');
  await expect(about).toHaveAttribute('href', '/about/');
  await about.click();
  await expect(page).toHaveURL('/about/');
  await expect(page.locator('.desktop-nav > ul > li > a')).toHaveText(EXPECTED_PRIMARY_LINKS);
});

test('desktop navigation stays at the viewport center with and without the admin action', async ({ page }) => {
  for (const width of DESKTOP_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects/');
    await page.evaluate(() => document.fonts.ready);
    const navigation = page.locator('.desktop-nav');
    await expect(navigation).toBeVisible();
    await expect(navigation.locator(':scope > ul > li > a')).toHaveText(EXPECTED_PRIMARY_LINKS);
    await expect(page.locator('[data-menu-toggle]')).toBeHidden();

    for (const adminVisible of [false, true]) {
      await page.locator('[data-admin-logout]').evaluate((element, visible) => {
        (element as HTMLElement).hidden = !visible;
      }, adminVisible);
      const navBox = await navigation.boundingBox();
      const actionsBox = await page.locator('.header-actions').boundingBox();
      if (!navBox || !actionsBox) throw new Error('Missing header bounds');
      expect(Math.abs(navBox.x + navBox.width / 2 - width / 2)).toBeLessThan(1);
      expect(navBox.x).toBeGreaterThanOrEqual(0);
      expect(navBox.x + navBox.width).toBeLessThanOrEqual(actionsBox.x);
      expect(actionsBox.x + actionsBox.width).toBeLessThanOrEqual(width);
      if (adminVisible) {
        const logoutBox = await page.locator('[data-admin-logout]').boundingBox();
        if (!logoutBox) throw new Error('Missing admin action bounds');
        expect(logoutBox.x).toBeGreaterThanOrEqual(0);
        expect(logoutBox.x + logoutBox.width).toBeLessThanOrEqual(navBox.x);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(await page.evaluate(() => document.documentElement.clientWidth));
  }
});

test('desktop Blog submenu stays horizontal and centered in the viewport', async ({ page }) => {
  for (const width of DESKTOP_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects/');
    const blogItem = page.locator('[data-nav-item="博客文章"]');
    const submenu = blogItem.locator(':scope > .submenu');
    await expect(page.locator('.desktop-nav .submenu')).toHaveCount(1);
    await expect(submenu).toBeHidden();
    await blogItem.hover();
    await expect(submenu).toBeVisible();
    await expect(submenu.locator('a')).toHaveText(EXPECTED_BLOG_LINKS);
    const layout = await submenu.evaluate((menu) => {
      const menuBox = menu.getBoundingClientRect();
      const boxes = [...menu.children].map((item) => item.getBoundingClientRect());
      return {
        left: menuBox.left,
        right: menuBox.right,
        center: menuBox.left + menuBox.width / 2,
        itemLefts: boxes.map((box) => box.left),
        itemRights: boxes.map((box) => box.right),
        itemCenters: boxes.map((box) => box.top + box.height / 2)
      };
    });
    expect(Math.abs(layout.center - width / 2)).toBeLessThan(1);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(width);
    expect(Math.min(...layout.itemLefts)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...layout.itemRights)).toBeLessThanOrEqual(width);
    expect(Math.max(...layout.itemCenters) - Math.min(...layout.itemCenters)).toBeLessThan(1);
    expect(layout.itemLefts.every((left, index) => index === 0 || left > layout.itemLefts[index - 1])).toBe(true);
    await submenu.getByRole('link', { name: '技术笔记', exact: true }).hover();
    await expect(submenu).toBeVisible();
    await page.locator('[data-nav-item="作品橱窗"]').hover();
    await expect(submenu).toBeHidden();
  }
});

test('desktop Blog submenu supports keyboard entry and leaves when focus moves away', async ({ page }) => {
  await page.goto('/projects/');
  const blogItem = page.locator('[data-nav-item="博客文章"]');
  const submenu = blogItem.locator(':scope > .submenu');
  await blogItem.locator(':scope > a').focus();
  await expect(submenu).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(submenu.getByRole('link', { name: '全部文章', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(submenu.getByRole('link', { name: '技术笔记', exact: true })).toBeFocused();
  await page.locator('[data-nav-item="作品橱窗"] > a').focus();
  await expect(submenu).toBeHidden();
  await blogItem.locator(':scope > a').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/blog/all/');
});

test('narrow viewports center controls and retain all ten destinations in the mobile menu', async ({ page }) => {
  for (const width of [390, 768, 1024, 1199]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/projects/');
    await expect(page.locator('.desktop-nav')).toBeHidden();
    const toggle = page.locator('[data-menu-toggle]');
    await expect(toggle).toBeVisible();
    const actionsBox = await page.locator('.header-actions').boundingBox();
    if (!actionsBox) throw new Error('Missing mobile header controls');
    expect(Math.abs(actionsBox.x + actionsBox.width / 2 - width / 2)).toBeLessThan(1);
    await toggle.click();
    const mobileMenu = page.locator('[data-mobile-menu]');
    await expect(mobileMenu).toBeVisible();
    await expect(mobileMenu.locator(':scope > ul > li > a')).toHaveText(EXPECTED_PRIMARY_LINKS);
    await expect(mobileMenu.locator('.submenu a')).toHaveText(EXPECTED_BLOG_LINKS);
    await expect(mobileMenu.getByRole('link', { name: '关于我', exact: true })).toHaveCount(0);
    await expect(mobileMenu.getByRole('link', { name: '装备', exact: true })).toHaveAttribute('href', '/about/gear/');
    const homeLink = mobileMenu.getByRole('link', { name: '首页', exact: true });
    expect(await homeLink.evaluate((link) => {
      const box = link.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + 24, box.top + box.height / 2);
      return hit === link || link.contains(hit);
    })).toBe(true);
    const metrics = await mobileMenu.evaluate((menu) => ({
      pageScrollWidth: document.documentElement.scrollWidth,
      pageClientWidth: document.documentElement.clientWidth,
      menuScrollWidth: menu.scrollWidth,
      menuClientWidth: menu.clientWidth
    }));
    expect(metrics.pageScrollWidth).toBe(metrics.pageClientWidth);
    expect(metrics.menuScrollWidth).toBe(metrics.menuClientWidth);
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  }
});

test('open mobile navigation scrolls internally without enlarging the document', async ({ page }) => {
  for (const height of [844, 600]) {
    await page.setViewportSize({ width: 390, height });
    await page.goto('/projects/');
    const beforeHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.getByRole('button', { name: '切换导航栏' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(beforeHeight);
    const mobileMenu = page.locator('[data-mobile-menu]');
    const state = await mobileMenu.evaluate((element) => {
      element.scrollTo(0, element.scrollHeight);
      return {
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
        overflowY: getComputedStyle(element).overflowY
      };
    });
    if (state.scrollHeight > state.clientHeight) expect(state.scrollTop).toBeGreaterThan(0);
    if (height === 600) expect(state.scrollHeight).toBeGreaterThan(state.clientHeight);
    expect(['auto', 'scroll']).toContain(state.overflowY);
    const menuBox = await mobileMenu.boundingBox();
    const lastLinkBox = await mobileMenu.getByRole('link', { name: '留言板', exact: true }).boundingBox();
    if (!menuBox || !lastLinkBox) throw new Error('Missing mobile menu bounds');
    expect(lastLinkBox.y).toBeGreaterThanOrEqual(menuBox.y);
    expect(lastLinkBox.y + lastLinkBox.height).toBeLessThanOrEqual(menuBox.y + menuBox.height + 1);
  }
});

test('light-theme mobile navigation links meet WCAG AA contrast', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.goto('/projects/');
  await page.getByRole('button', { name: '切换导航栏' }).click();
  const mobileMenu = page.locator('[data-mobile-menu]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(mobileMenu).toBeVisible();
  const background = await mobileMenu.evaluate((element) => getComputedStyle(element).backgroundColor);
  const linkColors = await Promise.all([
    mobileMenu.locator(':scope > ul > li > a').evaluateAll((links) =>
      links.map((link) => getComputedStyle(link).color)
    ),
    mobileMenu.locator('.submenu a').evaluateAll((links) =>
      links.map((link) => getComputedStyle(link).color)
    )
  ]);
  expect(linkColors[0]).toHaveLength(10);
  expect(linkColors[1]).toHaveLength(6);
  for (const color of linkColors.flat()) {
    expect.soft(contrastRatio(color, background), `${color} on ${background}`).toBeGreaterThanOrEqual(4.5);
  }
});
