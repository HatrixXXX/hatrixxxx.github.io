import { expect, test } from '@playwright/test';

test('blog index lists every published post in date order', async ({ page, request }) => {
  const legacyResponse = await request.get('/blog/all/', { maxRedirects: 0 });
  expect(legacyResponse.status()).toBe(301);
  expect(legacyResponse.headers().location).toBe('/blog/');

  await page.goto('/blog/all/');
  await expect(page).toHaveURL('/blog/');

  const coverflow = page.locator('[data-post-coverflow]');
  const cards = coverflow.locator('article[data-post-card]');
  await expect(coverflow).toHaveAttribute('tabindex', '0');
  await expect(coverflow).toHaveAccessibleName('文章列表');
  await expect(cards).toHaveCount(16);
  await expect(cards.first().locator('h2')).toHaveText('Infra-微积分');
  await expect(cards.first()).toHaveAttribute('data-active', 'true');
  await expect(coverflow.locator('[data-post-card][data-active="true"]')).toHaveCount(1);

  const dates = await cards.locator('time').evaluateAll((times) =>
    times.map((time) => Date.parse(time.getAttribute('datetime') ?? ''))
  );
  expect(dates).toHaveLength(16);
  expect(dates.every((date, index) => index === 0 || dates[index - 1] >= date)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth)
  );
});

test('coverflow presents one active card and folded neighbouring cards', async ({ page }) => {
  await page.goto('/blog/');
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
  expect(layout[0].transform).toMatch(/rotateY\(0(?:\.0+)?deg\)/);
  expect(layout[1]).toMatchObject({ active: 'false', position: 'absolute' });
  expect(layout[1].transform).toMatch(/rotateY\(48(?:\.0+)?deg\)/);
  await expect(coverflow.locator('.coverflow-scene')).toHaveCSS('overflow', 'hidden');
});

test('coverflow cards nearly fill the viewport below the fixed navigation', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/blog/');

    const header = page.locator('[data-site-header]');
    const activeCard = page.locator('[data-post-card][data-active="true"]');
    await expect(activeCard).toBeVisible();
    const [headerBox, cardBox] = await Promise.all([header.boundingBox(), activeCard.boundingBox()]);
    if (!headerBox || !cardBox) throw new Error('Missing navigation or active card bounds');

    const gapBelowHeader = cardBox.y - (headerBox.y + headerBox.height);
    const gapAboveViewportBottom = viewport.height - (cardBox.y + cardBox.height);
    expect(gapBelowHeader).toBeGreaterThanOrEqual(0);
    expect(gapBelowHeader).toBeLessThanOrEqual(20);
    expect(gapAboveViewportBottom).toBeGreaterThanOrEqual(0);
    expect(gapAboveViewportBottom).toBeLessThanOrEqual(20);
  }
});

test('focused coverflow supports arrow-key navigation', async ({ page }) => {
  await page.goto('/blog/');
  const coverflow = page.locator('[data-post-coverflow]');
  await coverflow.focus();
  await expect(coverflow).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(coverflow.locator('[data-post-card][data-active="true"] h2')).toHaveText(
    'Infra-概率论'
  );
  await page.keyboard.press('ArrowLeft');
  await expect(coverflow.locator('[data-post-card][data-active="true"] h2')).toHaveText(
    'Infra-微积分'
  );
});

test('mouse wheel advances the coverflow without scrolling the page', async ({ page }) => {
  await page.goto('/blog/');
  const coverflow = page.locator('[data-post-coverflow]');
  const box = await coverflow.boundingBox();
  if (!box) throw new Error('Missing post coverflow bounds');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const pageStart = await page.evaluate(() => window.scrollY);
  await coverflow.dispatchEvent('wheel', { deltaY: 60, deltaMode: 0 });
  await expect(coverflow.locator('[data-post-card][data-active="true"] h2')).toHaveText(
    'Infra-概率论'
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(pageStart);
});

test('clicking a side card selects it without opening the article', async ({ page }) => {
  await page.goto('/blog/');
  const card = page.locator('[data-post-card]').nth(1);
  await card.dispatchEvent('click');

  await expect(card).toHaveAttribute('data-active', 'true');
  await expect(page).toHaveURL('/blog/');
});

test('reduced motion switches coverflow cards without a lingering animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blog/');
  const coverflow = page.locator('[data-post-coverflow]');
  await coverflow.focus();
  await page.keyboard.press('ArrowRight');

  const activeCard = coverflow.locator('[data-post-card][data-active="true"]');
  await expect(activeCard.locator('h2')).toHaveText('Infra-概率论');
  await page.waitForTimeout(100);
  await expect(activeCard.locator('h2')).toHaveText('Infra-概率论');
});

test('post headings remain readable in the light theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.goto('/blog/');

  await expect(page.locator('article[data-post-card] h2').first()).toHaveCSS(
    'color',
    'rgb(50, 45, 56)'
  );
});

test('home blog entry goes directly to the blog index', async ({ page }) => {
  await page.goto('/');
  const blogNavigation = page.locator('[data-home-blog]');
  await expect(blogNavigation).toHaveAttribute('href', '/blog/');
  await blogNavigation.click();
  await expect(page).toHaveURL('/blog/');
  await expect(page.locator('[data-page-subtitle]')).toHaveCount(0);
  await expect(page.locator('[data-post-coverflow]')).toBeVisible();
});
