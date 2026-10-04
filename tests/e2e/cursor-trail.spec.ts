import { expect, test, type Page } from '@playwright/test';

const LAB_ROUTE = '/lab/';
const NON_LAB_ROUTES = ['/', '/blog/', '/projects/'];

const alphaPixels = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d');
  if (!context) return -1;
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 0) count += 1;
  }
  return count;
};

async function trailGeometry(page: Page) {
  const horizontal = await page.locator('[data-content-boundary]').boundingBox();
  const main = page.locator('main');
  await main.scrollIntoViewIfNeeded();
  const vertical = await main.boundingBox();
  const viewport = page.viewportSize();
  if (!horizontal || !vertical || !viewport) throw new Error('Missing cursor trail geometry');

  const visibleTop = Math.max(0, vertical.y);
  const visibleBottom = Math.min(viewport.height, vertical.y + vertical.height);
  if (visibleBottom <= visibleTop) throw new Error('Cursor trail region is outside the viewport');

  return {
    contentX: horizontal.x + horizontal.width / 2,
    gutterX: Math.max(8, horizontal.x - 24),
    y: (visibleTop + visibleBottom) / 2
  };
}

async function waitForAnimationFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

test('non-lab pages do not mount the cursor trail', async ({ page }) => {
  for (const route of NON_LAB_ROUTES) {
    await page.goto(route);
    await expect(page.locator('[data-cursor-trail]')).toHaveCount(0);
  }
});

test('the lab mounts a fixed non-interactive viewport layer', async ({ page }) => {
  await page.goto(LAB_ROUTE);
  const canvas = page.locator('[data-cursor-trail]');

  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  expect(await canvas.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      position: style.position,
      pointerEvents: style.pointerEvents,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight
    };
  })).toEqual({
    position: 'fixed',
    pointerEvents: 'none',
    left: 0,
    top: 0,
    width: 1440,
    height: 900,
    viewportWidth: 1440,
    viewportHeight: 900
  });
});

test('the cursor trail uses a high-DPR backing store', async ({ browser }) => {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1440, height: 900 }
  });
  try {
    const page = await context.newPage();
    await page.goto(LAB_ROUTE);
    const canvas = page.locator('[data-cursor-trail]');

    expect(await canvas.evaluate((element) => {
      const canvasElement = element as HTMLCanvasElement;
      const rect = canvasElement.getBoundingClientRect();
      return {
        cssWidth: rect.width,
        cssHeight: rect.height,
        width: canvasElement.width,
        height: canvasElement.height
      };
    })).toEqual({ cssWidth: 1440, cssHeight: 900, width: 2880, height: 1800 });
  } finally {
    await context.close();
  }
});

test('movement across the lab viewport draws until the pointer leaves the page', async ({ page }) => {
  await page.goto(LAB_ROUTE);
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await trailGeometry(page);

  await page.mouse.move(geometry.contentX, 12);
  await page.mouse.move(geometry.contentX + 36, 36);
  await expect.poll(() => canvas.evaluate(alphaPixels)).toBeGreaterThan(0);

  await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    target.getContext('2d')?.clearRect(0, 0, target.width, target.height);
  });
  await page.mouse.move(geometry.contentX, geometry.y - 40);
  await page.mouse.move(geometry.contentX, geometry.y + 40);
  await expect.poll(() => canvas.evaluate(alphaPixels)).toBeGreaterThan(0);

  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerleave')));
  await expect(canvas).toHaveAttribute('data-cursor-trail-state', /fading|idle/);
});

test('reduced motion prevents the trail from drawing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(LAB_ROUTE);
  const canvas = page.locator('[data-cursor-trail]');
  const geometry = await trailGeometry(page);

  await page.mouse.move(geometry.gutterX, geometry.y - 40);
  await page.mouse.move(geometry.gutterX, geometry.y + 40);
  await waitForAnimationFrames(page);
  expect(await canvas.evaluate(alphaPixels)).toBe(0);
});

test('a non-fine pointer prevents the trail from drawing', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1440, height: 900 }
  });
  try {
    const page = await context.newPage();
    await page.goto(LAB_ROUTE);
    expect(await page.evaluate(() => (
      matchMedia('(hover: hover) and (pointer: fine)').matches
    ))).toBe(false);

    const canvas = page.locator('[data-cursor-trail]');
    const geometry = await trailGeometry(page);
    await page.mouse.move(geometry.gutterX, geometry.y - 40);
    await page.mouse.move(geometry.gutterX, geometry.y + 40);
    await waitForAnimationFrames(page);
    expect(await canvas.evaluate(alphaPixels)).toBe(0);
  } finally {
    await context.close();
  }
});

test('client navigation mounts and unmounts the lab-only trail', async ({ page }) => {
  await page.goto(LAB_ROUTE);
  await expect(page.locator('[data-cursor-trail]')).toHaveCount(1);

  await Promise.all([
    page.waitForURL((url) => url.pathname === '/'),
    page.getByRole('link', { name: '返回主页' }).click()
  ]);
  await expect(page.locator('[data-cursor-trail]')).toHaveCount(0);

  await Promise.all([
    page.waitForURL((url) => url.pathname === LAB_ROUTE),
    page.getByRole('link', { name: '实验场', exact: true }).click()
  ]);
  await expect(page.locator('[data-cursor-trail]')).toHaveCount(1);
});
