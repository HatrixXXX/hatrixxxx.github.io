import { expect, test } from '@playwright/test';

test('blank blog space keeps the site cursor', async ({ page }) => {
  await page.goto('/blogs/');
  await expect(page.locator('#page-loader')).toBeHidden();

  const cursor = await page.evaluate(() => {
    const target = document.elementFromPoint(80, 450);
    if (!target?.classList.contains('coverflow-scene')) throw new Error('Expected blank blog space');
    return getComputedStyle(target).cursor;
  });
  expect(cursor).toContain('/assets/cursors/pointer.cur');
});

test('top header controls use the normal-sized diagonal link crosshair across their full hit areas', async ({ page }) => {
  await page.goto('/blogs/');
  await expect(page.locator('#page-loader')).toBeHidden();

  const cursors = await page.evaluate(() => [
    ...document.querySelectorAll<HTMLElement>('.desktop-nav > ul > li, .header-actions button')
  ].flatMap((item) => {
    const rect = item.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    const x = rect.left + rect.width / 2;
    return [rect.top + 2, rect.top + rect.height / 2, rect.bottom - 2].map((y) => {
      const target = document.elementFromPoint(x, y);
      return { label: item.textContent?.trim() || item.getAttribute('aria-label'), cursor: target ? getComputedStyle(target).cursor : '' };
    });
  }));
  expect(cursors).not.toHaveLength(0);
  const normalPointer = await page.evaluate(() => getComputedStyle(document.body).cursor.split(', auto')[0]);
  for (const { label, cursor } of cursors) {
    expect(cursor, label ?? undefined).toContain('/assets/cursors/link-nav.png');
    expect(cursor, label ?? undefined).toContain('2dppx) 24 24');
    expect(cursor, label ?? undefined).toContain(normalPointer);
  }
  const size = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/assets/cursors/link-nav.png';
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(size).toEqual({ width: 96, height: 96 });
});

test('magnetic frame stays on navigation, search, and back controls', async ({ page }) => {
  await page.goto('/blogs/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const frame = page.locator('[data-magnetic-frame]');
  await expect(frame).toHaveAttribute('data-magnetic-ready', '');

  for (const target of [
    page.locator('.desktop-nav > ul > li > a').first(),
    page.locator('.header-actions [data-open-search]'),
    page.locator('[data-back-button]')
  ]) {
    await target.hover();
    await expect(frame).toHaveAttribute('data-active', '');
    await expect.poll(async () => {
      const targetBox = await target.boundingBox();
      const frameBox = await frame.boundingBox();
      if (!targetBox || !frameBox) return false;
      return Math.abs(frameBox.x + frameBox.width / 2 - targetBox.x - targetBox.width / 2) < 8
        && Math.abs(frameBox.y + frameBox.height / 2 - targetBox.y - targetBox.height / 2) < 8;
    }).toBe(true);
  }

  await page.mouse.move(80, 450);
  await expect(frame).not.toHaveAttribute('data-active', '');

  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('.search-button').hover();
  await expect(page.locator('[data-magnetic-frame]')).toHaveAttribute('data-active', '');
});

test('magnetic frame is static with reduced motion and absent on touch', async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blogs/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const link = page.locator('.desktop-nav > ul > li > a').first();
  const frame = page.locator('[data-magnetic-frame]');
  const box = await link.boundingBox();
  if (!box) throw new Error('Missing navigation link bounds');

  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await expect(frame).toHaveAttribute('data-active', '');
  const firstPosition = await frame.evaluate((element) => getComputedStyle(element).transform);
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  const secondPosition = await frame.evaluate((element) => getComputedStyle(element).transform);
  expect(secondPosition).toBe(firstPosition);
  await expect(frame).toHaveCSS('transition-duration', '0s');

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(new URL('/blogs/', page.url()).href);
  await expect(touchPage.locator('#page-loader')).toBeHidden();
  await touchPage.locator('.header-actions [data-open-search]').tap();
  await expect(touchPage.locator('[data-magnetic-frame]')).not.toHaveAttribute('data-active', '');
  await touchContext.close();
});

test('magnetic frame covers links, cards, and other site controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('[data-home-blog]').hover();
  await expect(page.locator('[data-home-panel="blog"] > [data-home-tile-frame]')).toHaveAttribute('data-active', '');

  await page.goto('/toolbox/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('[data-tool-module]').first().hover();
  await expect(page.locator('[data-magnetic-frame]')).toHaveAttribute('data-active', '');
  await page.goto('/blogs/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const sideCard = page.locator('[data-post-card][data-active="false"]').first();
  await sideCard.hover();
  await expect(page.locator('[data-magnetic-frame]')).toHaveAttribute('data-active', '');

  await page.goto('/posts/Infra-线性代数/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('article img').first().hover();
  await expect(page.locator('[data-magnetic-frame]')).toHaveAttribute('data-active', '');
});

test('home card magnetic frames inherit their perspective planes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();

  for (const name of ['blog', 'friends']) {
    const tile = page.locator(`[data-home-panel="${name}"] .tile`);
    await tile.hover();
    const frame = page.locator(`[data-home-panel="${name}"] > [data-magnetic-frame][data-home-tile-frame]`);
    await expect(frame).toHaveAttribute('data-active', '');
    await expect(page.locator('body > [data-magnetic-frame]')).not.toHaveAttribute('data-active', '');
    const geometry = await frame.evaluate((element) => ({
      parentIsPanel: element.parentElement?.hasAttribute('data-home-panel'),
      position: getComputedStyle(element).position,
      perspectivePlane: (element.closest('[data-home-plane]') ?? element.closest('[data-home-panel]'))?.getAttribute('style') ?? ''
    }));
    expect(geometry.parentIsPanel).toBe(true);
    expect(geometry.position).toBe('absolute');
    expect(geometry.perspectivePlane).toContain('matrix3d(');
  }

  const bookmark = page.locator('[data-home-panel="recommendations"] .tile--bookmark');
  await bookmark.hover();
  const frame = page.locator('[data-home-panel="recommendations"] > [data-home-tile-frame]');
  await expect(frame).toHaveAttribute('data-active', '');
  await expect.poll(async () => {
    const tileBox = await bookmark.boundingBox();
    const frameBox = await frame.boundingBox();
    if (!tileBox || !frameBox) return false;
    return Math.abs(frameBox.x + frameBox.width / 2 - tileBox.x - tileBox.width / 2) < 10
      && Math.abs(frameBox.y + frameBox.height / 2 - tileBox.y - tileBox.height / 2) < 10;
  }).toBe(true);
});

test('home level, name, and quote attract their own panel frames', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  for (const [panel, selector] of [
    ['identity', '.level-badge'],
    ['identity-name', '.identity-name'],
    ['quote', '[data-home-quote]'],
  ]) {
    await page.locator(`[data-home-panel="${panel}"] ${selector}`).hover();
    await expect(page.locator(`[data-home-panel="${panel}"] > [data-home-tile-frame]`)).toHaveAttribute('data-active', '');
    await expect(page.locator('body > [data-magnetic-frame]')).not.toHaveAttribute('data-active', '');
  }
});

test('home card frame is attracted before the pointer enters the card', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const tile = page.locator('[data-home-blog]');
  const box = await tile.boundingBox();
  if (!box) throw new Error('Missing home blog card bounds');

  const nearX = box.x - 24;
  const middleY = box.y + box.height / 2;
  await page.evaluate(() => {
    document.addEventListener('transitionrun', (event) => {
      if (event.propertyName === 'width' && event.target instanceof HTMLElement && event.target.hasAttribute('data-home-tile-frame')) {
        document.documentElement.dataset.homeMorphWidth = 'yes';
      }
    }, true);
  });
  await page.mouse.move(nearX, middleY);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.tile') !== null, [nearX, middleY])).toBe(false);
  const frame = page.locator('[data-home-panel="blog"] > [data-home-tile-frame]');
  await expect(frame).toHaveAttribute('data-active', '');
  await expect(page.locator('html')).toHaveAttribute('data-home-morph-width', 'yes');
  await expect(page.locator('body > [data-magnetic-frame]')).not.toHaveAttribute('data-active', '');
  await page.waitForTimeout(230);
  const frameWidth = await frame.evaluate((element) => element.getBoundingClientRect().width);
  const tileWidth = await tile.evaluate((element) => element.getBoundingClientRect().width);
  expect(Math.abs(frameWidth - tileWidth)).toBeLessThan(30);

  await tile.hover();
  await expect(frame).toHaveCSS('opacity', '1');
  await page.mouse.move(box.x - 150, middleY);
  await expect(frame).not.toHaveAttribute('data-active', '');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedBox = await tile.boundingBox();
  if (!reducedBox) throw new Error('Missing reduced-motion card bounds');
  await page.mouse.move(reducedBox.x - 24, reducedBox.y + reducedBox.height / 2);
  await expect(frame).toHaveAttribute('data-active', '');
  await expect(frame).toHaveCSS('opacity', '1');
  await expect(frame).toHaveCSS('transition-duration', '0s');
  const reducedFrameWidth = await frame.evaluate((element) => element.getBoundingClientRect().width);
  const reducedTileWidth = await tile.evaluate((element) => element.getBoundingClientRect().width);
  expect(Math.abs(reducedFrameWidth - reducedTileWidth)).toBeLessThan(30);
});

test('blog magnetic frame covers the selected card and visible edge cards', async ({ page }) => {
  await page.goto('/blogs/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());
  const rail = page.locator('[data-post-coverflow]');
  await rail.focus();
  for (let index = 0; index < 6; index++) await page.keyboard.press('ArrowDown');
  await expect(rail.locator('[data-post-card]').nth(6)).toHaveAttribute('data-active', 'true');
  await page.waitForTimeout(600);

  const activeCard = rail.locator('[data-post-card]').nth(6);
  await activeCard.locator('h2 a').hover();
  const activeBox = await activeCard.boundingBox();
  const frame = page.locator('body > [data-magnetic-frame]');
  await expect(frame).toHaveAttribute('data-active', '');
  const activeFrameBox = await frame.boundingBox();
  if (!activeBox || !activeFrameBox) throw new Error('Missing active card or frame bounds');
  expect(activeFrameBox.width).toBeGreaterThan(activeBox.width - 20);
  expect(activeFrameBox.height).toBeGreaterThan(activeBox.height - 20);
  await expect(activeCard.locator('h2 a')).toHaveAttribute('tabindex', '0');

  const sceneBox = await rail.locator('.coverflow-scene').boundingBox();
  if (!sceneBox) throw new Error('Missing coverflow scene bounds');
  let bottomHit: { x: number; y: number } | undefined;
  for (const index of [4, 8]) {
    const card = rail.locator('[data-post-card]').nth(index);
    const box = await card.boundingBox();
    if (!box) throw new Error(`Missing edge card ${index} bounds`);
    const visibleTop = Math.max(box.y, sceneBox.y + 2);
    const visibleBottom = Math.min(box.y + box.height, sceneBox.y + sceneBox.height - 2);
    expect(visibleBottom - visibleTop).toBeGreaterThan(2);
    const hit = { x: box.x + box.width / 2, y: (visibleTop + visibleBottom) / 2 };
    await page.mouse.move(hit.x, hit.y);
    await expect(frame).toHaveAttribute('data-active', '');
    await expect(card).not.toHaveAttribute('inert', '');
    await expect(card.locator('h2 a')).toHaveAttribute('tabindex', '-1');
    if (index === 8) bottomHit = hit;
  }
  const bottomCard = rail.locator('[data-post-card]').nth(8);
  if (!bottomHit) throw new Error('Missing bottom card hit point');
  await page.mouse.click(bottomHit.x, bottomHit.y);
  await expect(bottomCard).toHaveAttribute('data-active', 'true');
});

test('search dialog controls keep their frame above the dialog', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('.header-actions [data-open-search]').click();
  const dialog = page.locator('[data-search-overlay][open]');
  await expect(dialog).toBeVisible();

  for (const target of [dialog.locator('[data-close-search]'), dialog.locator('[data-search-input]')]) {
    const targetBox = await target.boundingBox();
    if (!targetBox) throw new Error('Missing search control bounds');
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    const frame = dialog.locator('[data-magnetic-frame]');
    await expect(frame).toHaveAttribute('data-active', '');
    await expect.poll(async () => {
      const targetBox = await target.boundingBox();
      const frameBox = await frame.boundingBox();
      if (!targetBox || !frameBox) return false;
      return Math.abs(frameBox.x + frameBox.width / 2 - targetBox.x - targetBox.width / 2) < 8
        && Math.abs(frameBox.y + frameBox.height / 2 - targetBox.y - targetBox.height / 2) < 8;
    }).toBe(true);
  }
});

test('disabled controls do not attract the magnetic frame', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const search = page.locator('.header-actions [data-open-search]');
  await search.evaluate((button: HTMLButtonElement) => { button.disabled = true; });
  await expect(search).toBeDisabled();
  const box = await search.boundingBox();
  if (!box) throw new Error('Missing search control bounds');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('body > [data-magnetic-frame]')).not.toHaveAttribute('data-active', '');
});
