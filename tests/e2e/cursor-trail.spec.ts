import { expect, test, type Page } from '@playwright/test';

const alphaPixels = (
  canvas: HTMLCanvasElement,
  range?: { left: number; right: number }
) => {
  const context = canvas.getContext('2d');
  if (!context) return -1;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const left = Math.max(0, Math.floor(((range?.left ?? rect.left) - rect.left) * scaleX));
  const right = Math.min(canvas.width, Math.ceil(((range?.right ?? rect.right) - rect.left) * scaleX));
  const width = Math.max(0, right - left);
  const data = context.getImageData(left, 0, width, canvas.height).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] > 0) count += 1;
  return count;
};

const contentAlphaPixels = (
  canvas: HTMLCanvasElement,
  bounds: { left: number; right: number }
) => {
  const context = canvas.getContext('2d');
  if (!context) return -1;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const left = Math.floor((bounds.left - rect.left) * scaleX);
  const right = Math.ceil((bounds.right - rect.left) * scaleX);
  const data = context.getImageData(left, 0, right - left, canvas.height).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] > 0) count += 1;
  return count;
};

const alphaPixelsInRect = (
  canvas: HTMLCanvasElement,
  area: { left: number; right: number; top: number; bottom: number }
) => {
  const context = canvas.getContext('2d');
  if (!context) return -1;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const left = Math.max(0, Math.floor((area.left - rect.left) * scaleX));
  const right = Math.min(canvas.width, Math.ceil((area.right - rect.left) * scaleX));
  const top = Math.max(0, Math.floor((area.top - rect.top) * scaleY));
  const bottom = Math.min(canvas.height, Math.ceil((area.bottom - rect.top) * scaleY));
  const data = context.getImageData(left, top, right - left, bottom - top).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] > 0) count += 1;
  return count;
};

async function activationGeometry(page: Page) {
  const horizontal = await page.locator('[data-content-boundary]').boundingBox();
  const region = page.locator('main, [data-cursor-trail-region]').first();
  await region.scrollIntoViewIfNeeded();
  const vertical = await region.boundingBox();
  const viewport = page.viewportSize();
  if (!horizontal || !vertical || !viewport) throw new Error('Missing cursor trail geometry');
  const visibleTop = Math.max(0, vertical.y);
  const visibleBottom = Math.min(viewport.height, vertical.y + vertical.height);
  if (visibleBottom <= visibleTop) throw new Error('Cursor trail region is outside the viewport');
  return {
    leftX: Math.max(8, horizontal.x - 24),
    rightX: Math.min(viewport.width - 8, horizontal.x + horizontal.width + 24),
    centerX: horizontal.x + horizontal.width / 2,
    y: (visibleTop + visibleBottom) / 2,
    content: { left: horizontal.x, right: horizontal.x + horizontal.width }
  };
}

async function waitForAnimationFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

test('cursor trail is a non-interactive fixed viewport layer', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  expect(await canvas.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      position: style.position,
      pointerEvents: style.pointerEvents,
      width: style.width,
      height: style.height
    };
  })).toEqual({ position: 'fixed', pointerEvents: 'none', width: '1440px', height: '900px' });
});

test('cursor trail scales its backing store for a high-DPR viewport', async ({ browser }) => {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1440, height: 900 }
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const canvas = page.locator('[data-cursor-trail]');
    expect(await canvas.evaluate((element) => {
      const canvasElement = element as HTMLCanvasElement;
      const style = getComputedStyle(element);
      return {
        cssWidth: style.width,
        cssHeight: style.height,
        width: canvasElement.width,
        height: canvasElement.height
      };
    })).toEqual({ cssWidth: '1440px', cssHeight: '900px', width: 2880, height: 1800 });
  } finally {
    await context.close();
  }
});

test('moving only inside the content band leaves the canvas transparent', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.centerX, geometry.y - 60);
  await page.mouse.move(geometry.centerX, geometry.y + 60);
  await waitForAnimationFrames(page);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);

  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: 0, right: geometry.content.left }))
    .toBeGreaterThan(0);
});

for (const side of ['left', 'right'] as const) {
  test(`${side} gutter creates a visible trail`, async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('[data-cursor-trail]');
    const geometry = await activationGeometry(page);
    const x = side === 'left' ? geometry.leftX : geometry.rightX;
    for (let step = 0; step < 6; step += 1) await page.mouse.move(x, geometry.y - 105 + step * 42);
    await expect.poll(() => canvas.evaluate(alphaPixels)).toBeGreaterThan(0);
  });
}

test('an idle gutter trail fades completely', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  const x = geometry.leftX;
  for (let step = 0; step < 6; step += 1) await page.mouse.move(x, geometry.y - 105 + step * 42);
  await expect.poll(() => canvas.evaluate(alphaPixels)).toBeGreaterThan(0);
  await expect.poll(() => canvas.evaluate(alphaPixels), { timeout: 10_000 }).toBe(0);
});

test('a slowly moving gutter trail remains visible', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  const x = geometry.leftX;
  for (let step = 0; step < 6; step += 1) {
    await page.mouse.move(x, geometry.y - 30 + step * 12);
    await page.waitForTimeout(125);
    if (step > 0) expect(await canvas.evaluate(alphaPixels)).toBeGreaterThan(0);
  }
});

test('hero gutters do not create trails', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const horizontal = await page.locator('[data-content-boundary]').boundingBox();
  const hero = await page.locator('[data-hero]').boundingBox();
  if (!horizontal || !hero) throw new Error('Missing page regions');
  const x = Math.max(8, horizontal.x - 24);
  const y = hero.y + hero.height / 2;
  await page.mouse.move(x, y - 40);
  await page.mouse.move(x, y + 40);
  await waitForAnimationFrames(page);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);

  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: 0, right: geometry.content.left }))
    .toBeGreaterThan(0);
});

test('the visible area below a short main does not create trails', async ({ page }) => {
  await page.goto('/projects/');
  const canvas = page.locator('[data-cursor-trail]');
  const horizontal = await page.locator('[data-content-boundary]').boundingBox();
  const main = await page.locator('main').boundingBox();
  const viewport = page.viewportSize();
  if (!horizontal || !main || !viewport) throw new Error('Missing projects page geometry');
  const y = main.y + main.height + 24;
  expect(y).toBeLessThan(viewport.height);
  const x = Math.max(8, horizontal.x - 24);
  await page.mouse.move(x, y - 32);
  await page.mouse.move(x, y + 32);
  await waitForAnimationFrames(page);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);

  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: 0, right: geometry.content.left }))
    .toBeGreaterThan(0);
});

test('switching gutters starts a new trail without a content bridge', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  const oldArea = {
    left: geometry.leftX - 12,
    right: geometry.leftX + 12,
    top: geometry.y - 85,
    bottom: geometry.y - 35
  };
  await page.mouse.move(geometry.leftX, geometry.y - 80);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: 0, right: geometry.content.left }))
    .toBeGreaterThan(0);
  await expect.poll(() => canvas.evaluate(alphaPixelsInRect, oldArea)).toBeGreaterThan(0);

  await page.mouse.move(geometry.rightX, geometry.y + 40);
  await page.mouse.move(geometry.rightX, geometry.y + 80);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: geometry.content.right, right: 1440 }))
    .toBeGreaterThan(0);
  expect(await canvas.evaluate(alphaPixelsInRect, oldArea)).toBeGreaterThan(0);
  expect(await canvas.evaluate(contentAlphaPixels, geometry.content)).toBe(0);
  await expect.poll(() => canvas.evaluate(alphaPixelsInRect, oldArea)).toBe(0);
});

test('leaving and re-entering one gutter starts a disconnected trail', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  const oldArea = {
    left: geometry.leftX - 12,
    right: geometry.leftX + 12,
    top: geometry.y - 85,
    bottom: geometry.y - 35
  };
  await page.mouse.move(geometry.leftX, geometry.y - 80);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: 0, right: geometry.content.left }))
    .toBeGreaterThan(0);
  await expect.poll(() => canvas.evaluate(alphaPixelsInRect, oldArea)).toBeGreaterThan(0);

  await page.mouse.move(geometry.centerX, geometry.y);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await page.mouse.move(geometry.leftX, geometry.y + 80);
  await expect.poll(() => canvas.evaluate(alphaPixelsInRect, {
    left: geometry.leftX - 12,
    right: geometry.leftX + 12,
    top: geometry.y + 35,
    bottom: geometry.y + 85
  })).toBeGreaterThan(0);
  expect(await canvas.evaluate(alphaPixelsInRect, oldArea)).toBeGreaterThan(0);
  expect(await canvas.evaluate(alphaPixelsInRect, {
    left: geometry.leftX - 12,
    right: geometry.leftX + 12,
    top: geometry.y - 10,
    bottom: geometry.y + 30
  })).toBe(0);
  await expect.poll(() => canvas.evaluate(alphaPixelsInRect, oldArea)).toBe(0);
});

test('a top-level pointer exit starts a disconnected gutter session on re-entry', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 180);
  await page.mouse.move(geometry.leftX, geometry.y - 140);
  await expect.poll(() => canvas.evaluate(alphaPixelsInRect, {
    left: geometry.leftX - 12,
    right: geometry.leftX + 12,
    top: geometry.y - 185,
    bottom: geometry.y - 135
  })).toBeGreaterThan(0);

  expect(await page.evaluate(() => {
    const event = new PointerEvent('pointerout', { relatedTarget: null });
    window.dispatchEvent(event);
    return event.relatedTarget === null;
  })).toBe(true);
  await page.mouse.move(geometry.leftX, geometry.y + 140);
  await page.mouse.move(geometry.leftX, geometry.y + 180);
  await expect.poll(() => canvas.evaluate(alphaPixelsInRect, {
    left: geometry.leftX - 12,
    right: geometry.leftX + 12,
    top: geometry.y + 135,
    bottom: geometry.y + 185
  })).toBeGreaterThan(0);
  expect(await canvas.evaluate(alphaPixelsInRect, {
    left: geometry.leftX - 12,
    right: geometry.leftX + 12,
    top: geometry.y - 20,
    bottom: geometry.y + 100
  })).toBe(0);
});

test('reduced motion disables drawing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await waitForAnimationFrames(page);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);
});

test('changing reduced motion clears and gates the trail until the next gutter input', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  const range = { left: 0, right: geometry.content.left };
  const x = geometry.leftX;

  for (let step = 0; step < 6; step += 1) await page.mouse.move(x, geometry.y - 105 + step * 42);
  await expect.poll(() => canvas.evaluate(alphaPixels, range)).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => canvas.evaluate(alphaPixels, range)).toBe(0);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expect(await canvas.evaluate(alphaPixels, range)).toBe(0);

  for (let step = 0; step < 6; step += 1) await page.mouse.move(x, geometry.y - 70 + step * 28);
  await expect.poll(() => canvas.evaluate(alphaPixels, range)).toBeGreaterThan(0);
});

test('a non-fine pointer disables drawing', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  await page.goto('/');
  expect(await page.evaluate(() => (
    matchMedia('(hover: hover) and (pointer: fine)').matches
  ))).toBe(false);
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await waitForAnimationFrames(page);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);
  await context.close();
});

test('an unmasked left-gutter curve may enter the content band', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await activationGeometry(page);
  await page.mouse.move(8, geometry.y);
  await page.mouse.move(geometry.content.left - 2, geometry.y);
  await expect.poll(() => canvas.evaluate(contentAlphaPixels, geometry.content)).toBeGreaterThan(0);
});

test('the canvas persists once across client navigation', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  await canvas.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));
  await Promise.all([
    page.waitForURL(/\/blog\/$/),
    page.getByRole('link', { name: '博客文章', exact: true }).click()
  ]);
  await expect(page.locator('[data-blog-total]')).toHaveText('40');
  await expect(page.locator('[data-cursor-trail]')).toHaveCount(1);
  await expect(page.locator('[data-cursor-trail]')).toHaveAttribute('data-persist-probe', 'same-node');
  const geometry = await activationGeometry(page);
  const range = { left: 0, right: geometry.content.left };
  const x = geometry.leftX;
  for (let step = 0; step < 6; step += 1) await page.mouse.move(x, geometry.y - 105 + step * 42);
  await expect.poll(() => canvas.evaluate(alphaPixels, range)).toBeGreaterThan(0);
});

test('post cover gutters stay inactive before the article region activates', async ({ page }) => {
  await page.goto('/posts/本科数学大杂烩/');
  const canvas = page.locator('[data-cursor-trail]');
  const horizontal = await page.locator('[data-content-boundary]').boundingBox();
  const hero = await page.locator('.post-hero').boundingBox();
  const viewport = page.viewportSize();
  if (!horizontal || !hero || !viewport) throw new Error('Missing post cover geometry');
  const visibleTop = Math.max(8, hero.y);
  const visibleBottom = Math.min(viewport.height - 8, hero.y + hero.height);
  if (visibleBottom - visibleTop < 80) throw new Error('Post cover is outside the viewport');
  const y = (visibleTop + visibleBottom) / 2;
  for (const x of [Math.max(8, horizontal.x - 24), Math.min(viewport.width - 8, horizontal.x + horizontal.width + 24)]) {
    await page.mouse.move(x, y - 40);
    await page.mouse.move(x, y + 40);
  }
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expect(await canvas.evaluate(alphaPixels)).toBe(0);

  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: 0, right: geometry.content.left }))
    .toBeGreaterThan(0);
});

test('an open image lightbox blocks the trail', async ({ page }) => {
  await page.goto('/posts/本科数学大杂烩/');
  const canvas = page.locator('[data-cursor-trail]');
  await page.locator('article img').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
  const horizontal = await page.locator('[data-content-boundary]').boundingBox();
  const viewport = page.viewportSize();
  if (!horizontal || !viewport) throw new Error('Missing lightbox geometry');
  const x = Math.max(8, horizontal.x - 24);
  await page.mouse.move(x, viewport.height / 2 - 40);
  await page.mouse.move(x, viewport.height / 2 + 40);
  await page.waitForTimeout(150);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('.pswp')).toBeHidden();
  const geometry = await activationGeometry(page);
  await page.mouse.move(geometry.leftX, geometry.y - 40);
  await page.mouse.move(geometry.leftX, geometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels, { left: 0, right: geometry.content.left }))
    .toBeGreaterThan(0);
});
