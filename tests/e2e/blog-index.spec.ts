import { expect, test } from '@playwright/test';

test('blog index lists every published post in date order', async ({ page }) => {
  await page.goto('/blogs/');

  const coverflow = page.locator('[data-post-coverflow]');
  const cards = coverflow.locator('article[data-post-card]');
  await expect(coverflow).toHaveAttribute('tabindex', '0');
  await expect(coverflow).toHaveAccessibleName('文章列表');
  await expect(cards).toHaveCount(15);
  await expect(cards.first().locator('h2')).not.toBeEmpty();
  await expect(cards.first()).toHaveAttribute('data-active', 'true');
  await expect(coverflow.locator('[data-post-card][data-active="true"]')).toHaveCount(1);

  const dates = await cards.locator('time').evaluateAll((times) =>
    times.map((time) => Date.parse(time.getAttribute('datetime') ?? ''))
  );
  expect(dates).toHaveLength(15);
  expect(dates.every((date, index) => index === 0 || dates[index - 1] >= date)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth)
  );
});

test('coverflow presents horizontal cards on a vertical track with alternating covers', async ({ page }) => {
  await page.goto('/blogs/');
  const coverflow = page.locator('[data-post-coverflow]');
  const cards = coverflow.locator('[data-post-card]');

  const layout = await cards.evaluateAll((elements) =>
    elements.slice(0, 2).map((element) => ({
      active: element.getAttribute('data-active'),
      position: getComputedStyle(element).position,
      transform: (element as HTMLElement).style.transform
    }))
  );
  expect(layout[0]).toMatchObject({ active: 'true', position: 'absolute' });
  expect(layout[0].transform).toMatch(/rotateX\(0(?:\.0+)?deg\)/);
  expect(layout[1]).toMatchObject({ active: 'false', position: 'absolute' });
  expect(layout[1].transform).toMatch(/rotateX\(-?22(?:\.0+)?deg\)/);
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  if (!first || !second) throw new Error('Missing blog card bounds');
  expect(first.width).toBeGreaterThan(first.height * 3.5);
  expect(second.y).toBeGreaterThan(first.y);
  const media = await cards.nth(0).locator('.post-card-media').boundingBox();
  if (!media) throw new Error('Missing cover frame bounds');
  expect(media.width / media.height).toBeGreaterThan(1.8);
  expect(media.width / media.height).toBeLessThan(2.05);
  await expect(cards.nth(0).locator('.post-card-media')).toHaveCSS('order', '0');
  await expect(cards.nth(1).locator('.post-card-media')).toHaveCSS('order', '2');
  await expect(cards.nth(0).locator('img')).toHaveCSS('object-fit', 'cover');
  await expect(cards.nth(0).locator('img')).not.toHaveAttribute('role', 'button');
  expect(await cards.nth(0).locator('img').getAttribute('srcset')).toContain('1280w');
  await expect(coverflow.locator('.coverflow-scene')).toHaveCSS('overflow', 'hidden');
});

test('distant cards gain tilt and opacity by depth', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blogs/');
  const rail = page.locator('[data-post-coverflow]');
  await rail.focus();
  for (let index = 0; index < 3; index++) await page.keyboard.press('ArrowDown');
  await expect(rail.locator('[data-post-card]').nth(3)).toHaveAttribute('data-active', 'true');

  const layers = await rail.locator('[data-post-card]').evaluateAll((cards) =>
    [4, 5, 6].map((index) => {
      const card = cards[index] as HTMLElement;
      return {
        angle: Math.abs(Number(card.style.transform.match(/rotateX\((-?[\d.]+)deg\)/)?.[1] ?? 0)),
        opacity: Number(card.style.opacity)
      };
    })
  );
  expect(layers[0].angle).toBeLessThan(layers[1].angle);
  expect(layers[1].angle).toBeLessThan(layers[2].angle);
  expect(layers[0].opacity).toBeLessThan(layers[1].opacity);
  expect(layers[1].opacity).toBeLessThan(layers[2].opacity);
});

test('active card fits below navigation on desktop and phone', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/blogs/');

    const header = page.locator('[data-site-header]');
    const activeCard = page.locator('[data-post-card][data-active="true"]');
    await expect(activeCard).toBeVisible();
    const [headerBox, cardBox] = await Promise.all([header.boundingBox(), activeCard.boundingBox()]);
    if (!headerBox || !cardBox) throw new Error('Missing navigation or active card bounds');

    const gapBelowHeader = cardBox.y - (headerBox.y + headerBox.height);
    const gapAboveViewportBottom = viewport.height - (cardBox.y + cardBox.height);
    expect(gapBelowHeader).toBeGreaterThanOrEqual(0);
    expect(gapBelowHeader).toBeLessThanOrEqual(viewport.height / 2);
    expect(gapAboveViewportBottom).toBeGreaterThanOrEqual(0);
    expect(gapAboveViewportBottom).toBeLessThanOrEqual(viewport.height / 2);
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width);
  }
});

test('coverflow caps card dimensions on 2K and 4K displays', async ({ page }) => {
  let referenceSize: { width: number; height: number } | undefined;

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/blogs/');

    const activeCard = page.locator('[data-post-card][data-active="true"]');
    const cardBox = await activeCard.boundingBox();
    if (!cardBox) throw new Error(`Missing active card bounds at ${viewport.width}x${viewport.height}`);

    if (!referenceSize) {
      referenceSize = { width: cardBox.width, height: cardBox.height };
      expect(cardBox.width).toBeCloseTo(1120, 0);
      expect(cardBox.height).toBeCloseTo(270, 0);
    } else {
      expect(cardBox.width).toBeCloseTo(referenceSize.width, 1);
      expect(cardBox.height).toBeCloseTo(referenceSize.height, 1);
    }
  }
});

test('focused coverflow supports arrow-key navigation', async ({ page }) => {
  await page.goto('/blogs/');
  const coverflow = page.locator('[data-post-coverflow]');
  const firstTitle = await coverflow.locator('[data-post-card]').nth(0).locator('h2').textContent();
  const secondTitle = await coverflow.locator('[data-post-card]').nth(1).locator('h2').textContent();
  await coverflow.focus();
  await expect(coverflow).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(coverflow.locator('[data-post-card][data-active="true"] h2')).toHaveText(
    secondTitle ?? ''
  );
  await page.keyboard.press('ArrowUp');
  await expect(coverflow.locator('[data-post-card][data-active="true"] h2')).toHaveText(
    firstTitle ?? ''
  );
});

test('mouse wheel advances the coverflow without scrolling the page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blogs/');
  const coverflow = page.locator('[data-post-coverflow]');
  const box = await coverflow.boundingBox();
  if (!box) throw new Error('Missing post coverflow bounds');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const pageStart = await page.evaluate(() => window.scrollY);
  await coverflow.dispatchEvent('wheel', { deltaY: 120, deltaMode: 0 });
  await expect(coverflow.locator('[data-post-card]').nth(1)).toHaveAttribute('data-active', 'true');
  await coverflow.dispatchEvent('wheel', { deltaY: 40, deltaMode: 0 });
  await expect(coverflow.locator('[data-post-card]').nth(1)).toHaveAttribute('data-active', 'true');
  await coverflow.dispatchEvent('wheel', { deltaY: -60, deltaMode: 0 });
  await expect(coverflow.locator('[data-post-card]').nth(0)).toHaveAttribute('data-active', 'true');
  expect(await page.evaluate(() => window.scrollY)).toBe(pageStart);
});

test('a vertical phone swipe advances one card', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/blogs/');
    await expect(page.locator('[data-post-card]').first()).toHaveAttribute('data-active', 'true');
    await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('[data-post-coverflow]');
      if (!rail) throw new Error('Missing post coverflow');
      const touch = (y: number) => new Touch({ identifier: 1, target: rail, clientX: 200, clientY: y });
      rail.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(500)] }));
      rail.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [touch(350)] }));
      rail.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [] }));
    });
    await expect(page.locator('[data-post-card]').nth(1)).toHaveAttribute('data-active', 'true');
  } finally {
    await context.close();
  }
});

test('clicking a side card selects it without opening the article', async ({ page }) => {
  await page.goto('/blogs/');
  const card = page.locator('[data-post-card]').nth(1);
  await card.dispatchEvent('click');

  await expect(card).toHaveAttribute('data-active', 'true');
  await expect(page).toHaveURL('/blogs/');
});

test('clicking the empty area of the active card opens its article', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/blogs/');
    await expect(page.locator('#page-loader')).not.toHaveClass(/pl-visible/);
    const card = page.locator('[data-post-card][data-active="true"]');
    const href = await card.locator('h2 a').getAttribute('href');
    const box = await card.boundingBox();
    if (!href || !box) throw new Error('Missing active post card link or bounds');

    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 12);

    await expect(page).toHaveURL(href);
  }
});

test('reduced motion switches coverflow cards without a lingering animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blogs/');
  const coverflow = page.locator('[data-post-coverflow]');
  const secondTitle = await coverflow.locator('[data-post-card]').nth(1).locator('h2').textContent();
  await coverflow.focus();
  await page.keyboard.press('ArrowDown');

  const activeCard = coverflow.locator('[data-post-card][data-active="true"]');
  await expect(activeCard.locator('h2')).toHaveText(secondTitle ?? '');
  await page.waitForTimeout(100);
  await expect(activeCard.locator('h2')).toHaveText(secondTitle ?? '');
});

test('post headings remain readable in the dark theme', async ({ page }) => {
  await page.goto('/blogs/');

  await expect(page.locator('article[data-post-card] h2').first()).toHaveCSS(
    'color',
    'rgb(245, 240, 232)'
  );
});

test('home blog entry goes directly to the blog index', async ({ page }) => {
  await page.goto('/');
  const blogNavigation = page.locator('[data-home-blog]');
  await expect(blogNavigation).toHaveAttribute('href', '/blogs/');
  await blogNavigation.click();
  await expect(page).toHaveURL('/blogs/');
  await expect(page.locator('[data-page-subtitle]')).toHaveCount(0);
  await expect(page.locator('[data-post-coverflow]')).toBeVisible();
});
