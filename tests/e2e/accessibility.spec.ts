import { expect, test } from '@playwright/test';

test('header keyboard navigation exposes a visible focus outline', async ({ page }) => {
  await page.goto('/blog/all/');
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

test('home keyboard navigation reaches the spatial controls at every viewport', async ({ page }) => {
  await page.goto('/');
  const search = page.locator('[data-open-search]');
  await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  const outline = await search.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toBeFocused();

  const blog = page.locator('a[data-home-blog]');
  await blog.focus();
  await expect(blog).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/blog/');
});

test('about decorations remain inert when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-sakana-layer]')).toHaveCount(0);
  await page.goto('/about/');
  const sakanaLayer = page.locator('[data-sakana-layer]');
  await expect(sakanaLayer).toHaveAttribute('aria-hidden', 'true');
  await expect(sakanaLayer.locator('a, button, input, [tabindex]')).toHaveCount(0);

  const decorations = sakanaLayer.locator('[data-sakana-anchor]');
  await expect(decorations).toHaveCount(2);
  const before = await decorations.evaluateAll((elements) =>
    elements.map((element) => ({
      pointerEvents: getComputedStyle(element).pointerEvents,
      transform: getComputedStyle(element).transform
    }))
  );
  await page.waitForTimeout(250);
  const after = await decorations.evaluateAll((elements) =>
    elements.map((element) => ({
      pointerEvents: getComputedStyle(element).pointerEvents,
      transform: getComputedStyle(element).transform
    }))
  );
  expect(before.every(({ pointerEvents }) => pointerEvents === 'none')).toBe(true);
  expect(after).toEqual(before);
});

test('desktop and mobile navigation and table of contents match their viewport', async ({
  page
}, testInfo) => {
  await page.goto('/posts/Infra-线性代数/');
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
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-mobile-menu]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const mobileToc = page.locator('details[data-toc-mobile]');
    const tocSummary = mobileToc.locator('summary');
    await tocSummary.focus();
    await expect(tocSummary).toBeFocused();
    await page.keyboard.press('Space');
    await expect(mobileToc).not.toHaveAttribute('open', '');
    await page.keyboard.press('Space');
    await expect(mobileToc).toHaveAttribute('open', '');

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
