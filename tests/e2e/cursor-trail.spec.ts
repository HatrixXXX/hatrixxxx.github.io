import { expect, test } from '@playwright/test';

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
  const bounds = await page.locator('[data-content-boundary]').boundingBox();
  if (!bounds) throw new Error('Missing content boundary');
  await page.mouse.move(bounds.x + bounds.width / 2, 320);
  await page.waitForTimeout(150);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);
});

for (const side of ['left', 'right'] as const) {
  test(`${side} gutter creates a visible trail`, async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('[data-cursor-trail]');
    const bounds = await page.locator('[data-content-boundary]').boundingBox();
    if (!bounds) throw new Error('Missing content boundary');
    const x = side === 'left' ? Math.max(8, bounds.x - 24) : Math.min(1432, bounds.x + bounds.width + 24);
    for (let step = 0; step < 6; step += 1) await page.mouse.move(x, 180 + step * 42);
    await expect.poll(() => canvas.evaluate(alphaPixels)).toBeGreaterThan(0);
  });
}

test('an idle gutter trail fades completely', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const bounds = await page.locator('[data-content-boundary]').boundingBox();
  if (!bounds) throw new Error('Missing content boundary');
  const x = Math.max(8, bounds.x - 24);
  for (let step = 0; step < 6; step += 1) await page.mouse.move(x, 180 + step * 42);
  await expect.poll(() => canvas.evaluate(alphaPixels)).toBeGreaterThan(0);
  await expect.poll(() => canvas.evaluate(alphaPixels), { timeout: 10_000 }).toBe(0);
});

test('a slowly moving gutter trail remains visible', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const bounds = await page.locator('[data-content-boundary]').boundingBox();
  if (!bounds) throw new Error('Missing content boundary');
  const x = Math.max(8, bounds.x - 24);
  for (let step = 0; step < 6; step += 1) {
    await page.mouse.move(x, 180 + step * 12);
    await page.waitForTimeout(125);
    if (step > 0) expect(await canvas.evaluate(alphaPixels)).toBeGreaterThan(0);
  }
});

test('a gutter trail can cross the protected content band', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const box = await page.locator('[data-content-boundary]').boundingBox();
  if (!box) throw new Error('Missing content boundary');
  await page.mouse.move(Math.max(8, box.x - 24), 260);
  await page.mouse.move(Math.min(1432, box.x + box.width + 24), 620);
  const bounds = { left: box.x, right: box.x + box.width };
  await expect.poll(() => canvas.evaluate(contentAlphaPixels, bounds)).toBeGreaterThan(0);
});

test('reduced motion disables drawing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const bounds = await page.locator('[data-content-boundary]').boundingBox();
  if (!bounds) throw new Error('Missing content boundary');
  await page.mouse.move(Math.max(8, bounds.x - 24), 260);
  await page.waitForTimeout(150);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);
});

test('changing reduced motion clears and gates the trail until the next gutter input', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  const bounds = await page.locator('[data-content-boundary]').boundingBox();
  if (!bounds) throw new Error('Missing content boundary');
  const range = { left: 0, right: bounds.x };
  const x = Math.max(8, bounds.x - 24);

  for (let step = 0; step < 6; step += 1) await page.mouse.move(x, 180 + step * 42);
  await expect.poll(() => canvas.evaluate(alphaPixels, range)).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => canvas.evaluate(alphaPixels, range)).toBe(0);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expect(await canvas.evaluate(alphaPixels, range)).toBe(0);

  for (let step = 0; step < 6; step += 1) await page.mouse.move(x, 460 + step * 28);
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
  const bounds = await page.locator('[data-content-boundary]').boundingBox();
  if (!bounds) throw new Error('Missing content boundary');
  await page.mouse.move(Math.max(8, bounds.x - 24), 260);
  await page.waitForTimeout(150);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);
  await context.close();
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
  const bounds = await page.locator('[data-content-boundary]').boundingBox();
  if (!bounds) throw new Error('Missing content boundary');
  const range = { left: 0, right: bounds.x };
  const x = Math.max(8, bounds.x - 24);
  for (let step = 0; step < 6; step += 1) await page.mouse.move(x, 180 + step * 42);
  await expect.poll(() => canvas.evaluate(alphaPixels, range)).toBeGreaterThan(0);
});
