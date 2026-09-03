import { expect, test } from '@playwright/test';

const alphaPixels = (canvas: HTMLCanvasElement, left = 0, right = canvas.width) => {
  const context = canvas.getContext('2d');
  if (!context) return -1;
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

test('the canvas persists once across client navigation', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('[data-cursor-trail]');
  await canvas.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));
  await page.getByRole('link', { name: '博客文章', exact: true }).click();
  await expect(page.locator('[data-cursor-trail]')).toHaveCount(1);
  await expect(page.locator('[data-cursor-trail]')).toHaveAttribute('data-persist-probe', 'same-node');
});
