import { expect, test } from '@playwright/test';

test('header keyboard navigation exposes a visible focus outline', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  for (let index = 0; index < 4; index += 1) {
    if (index === 0) await page.locator('body').press('Tab');
    else await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    const focusStyle = await focused.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe('none');
    expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(3);
  }
});

test('decorative motion stops when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const durations = await page.locator('[data-decorative-motion]').evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return { animation: style.animationDuration, transition: style.transitionDuration };
    })
  );
  expect(durations.length).toBeGreaterThan(0);
  expect(durations.every(({ animation }) => animation === '0s')).toBe(true);
  expect(durations.every(({ transition }) => transition === '0s')).toBe(true);
});

test('desktop and mobile navigation and table of contents match their viewport', async ({
  page
}, testInfo) => {
  await page.goto('/posts/本科数学大杂烩/');
  const isMobile = testInfo.project.name === 'mobile-390';
  const hasCollapsedNavigation = testInfo.project.name !== 'desktop-1440';

  await expect(page.locator('.desktop-nav')).toBeVisible({ visible: !hasCollapsedNavigation });
  await expect(page.locator('[data-menu-toggle]')).toBeVisible({ visible: hasCollapsedNavigation });
  await expect(page.locator('[data-toc-desktop]')).toBeVisible({
    visible: testInfo.project.name === 'desktop-1440'
  });
  await expect(page.locator('[data-toc-mobile]')).toBeVisible({
    visible: testInfo.project.name !== 'desktop-1440'
  });

  if (isMobile) {
    const toggle = page.getByRole('button', { name: '切换导航栏' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-mobile-menu]')).toBeVisible();

    const targets = page.locator(
      '[data-site-header] button:visible, [data-mobile-menu] a:visible, [data-toc-mobile] summary:visible'
    );
    const boxes = await targets.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.getAttribute('aria-label') ?? element.textContent?.trim(),
          width: rect.width,
          height: rect.height
        };
      })
    );
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect.soft(box.width, box.label).toBeGreaterThanOrEqual(44);
      expect.soft(box.height, box.label).toBeGreaterThanOrEqual(44);
    }

    const bodyFontSize = await page.locator('body').evaluate((body) =>
      Number.parseFloat(getComputedStyle(body).fontSize)
    );
    expect.soft(bodyFontSize).toBeGreaterThanOrEqual(16);
  }
});
