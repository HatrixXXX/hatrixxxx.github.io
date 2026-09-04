import { expect, test } from '@playwright/test';

const EXPECTED_PRIMARY_LINKS = ['首页', '博客文章', '作品橱窗', '关于我', '留言板'];

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

test('desktop navigation reveals only the active Blog or About submenu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const blogItem = page.locator('[data-nav-item="博客文章"]');
  const aboutItem = page.locator('[data-nav-item="关于我"]');
  const blogSubmenu = blogItem.locator(':scope > .submenu');
  const aboutSubmenu = aboutItem.locator(':scope > .submenu');

  await expect(page.locator('.desktop-nav > ul > li > a')).toHaveText(EXPECTED_PRIMARY_LINKS);

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

test('desktop submenus expand horizontally without leaving the viewport', async ({ page }) => {
  for (const path of ['/', '/projects/']) {
    for (const width of [769, 800, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);

      for (const label of ['博客文章', '关于我']) {
        const item = page.locator(`[data-nav-item="${label}"]`);
        const submenu = item.locator(':scope > .submenu');
        await item.hover();
        await expect(submenu).toBeVisible();

        const layout = await submenu.evaluate((menu) => {
          const menuBox = menu.getBoundingClientRect();
          const itemBoxes = [...menu.children].map((item) => item.getBoundingClientRect());
          return {
            menuLeft: menuBox.left,
            menuRight: menuBox.right,
            itemLefts: itemBoxes.map((box) => box.left),
            itemRights: itemBoxes.map((box) => box.right),
            itemCenters: itemBoxes.map((box) => box.top + box.height / 2)
          };
        });

        expect(layout.menuLeft).toBeGreaterThanOrEqual(0);
        expect(layout.menuRight).toBeLessThanOrEqual(width);
        expect(Math.min(...layout.itemLefts)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...layout.itemRights)).toBeLessThanOrEqual(width);
        expect(Math.max(...layout.itemCenters) - Math.min(...layout.itemCenters)).toBeLessThan(1);
        expect(layout.itemLefts.every((left, index) => index === 0 || left > layout.itemLefts[index - 1])).toBe(true);
      }
    }
  }
});

test('home keeps the About submenu inside a 769px desktop viewport', async ({ page }) => {
  const viewportWidth = 769;
  await page.setViewportSize({ width: viewportWidth, height: 900 });
  await page.goto('/');

  const aboutItem = page.locator('[data-nav-item="关于我"]');
  const aboutSubmenu = aboutItem.locator(':scope > .submenu');
  await aboutItem.hover();
  await expect(aboutSubmenu).toBeVisible();

  const layout = await aboutSubmenu.evaluate((menu) => {
    const box = menu.getBoundingClientRect();
    return {
      x: box.x,
      width: box.width,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    };
  });

  expect(layout.x).toBeGreaterThanOrEqual(0);
  expect(layout.x + layout.width).toBeLessThanOrEqual(viewportWidth);
  expect(layout.scrollWidth).toBe(layout.clientWidth);
});

test('mobile navigation renders primary and nested links in the open menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '切换导航栏' }).click();

  const mobileMenu = page.locator('[data-mobile-menu]');
  await expect(mobileMenu.locator(':scope > ul > li > a')).toHaveText(EXPECTED_PRIMARY_LINKS);
  await expect(mobileMenu.getByRole('link', { name: '技术笔记', exact: true })).toBeVisible();
  await expect(mobileMenu.getByRole('link', { name: '我的友链', exact: true })).toBeVisible();
});

test('open mobile navigation does not add document scrolling', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 390, height: 600 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: '切换导航栏' }).click();

    const documentHeight = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight
    }));
    expect(documentHeight.scrollHeight).toBeLessThanOrEqual(documentHeight.clientHeight);

    const mobileMenu = page.locator('[data-mobile-menu]');
    const menuState = await mobileMenu.evaluate((element) => {
      element.scrollTo(0, element.scrollHeight);
      return {
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
        overflowY: getComputedStyle(element).overflowY
      };
    });
    expect(menuState.scrollHeight).toBeGreaterThan(menuState.clientHeight);
    expect(['auto', 'scroll']).toContain(menuState.overflowY);
    expect(menuState.scrollTop).toBeGreaterThan(0);

    const menuBox = await mobileMenu.boundingBox();
    const lastLinkBox = await mobileMenu.getByRole('link', { name: '我的友链', exact: true }).boundingBox();
    if (!menuBox || !lastLinkBox) throw new Error('Missing mobile menu bounds');
    expect(lastLinkBox.y).toBeGreaterThanOrEqual(menuBox.y);
    expect(lastLinkBox.y + lastLinkBox.height).toBeLessThanOrEqual(menuBox.y + menuBox.height);

    await page.evaluate(() => window.scrollTo(0, 9_999));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});

test('light-theme mobile navigation links meet WCAG AA contrast', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.goto('/');
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

  expect(linkColors[0].length).toBeGreaterThan(0);
  expect(linkColors[1].length).toBeGreaterThan(0);
  for (const color of linkColors.flat()) {
    expect.soft(contrastRatio(color, background), `${color} on ${background}`).toBeGreaterThanOrEqual(4.5);
  }
});
