import { expect, test } from '@playwright/test';

test.use({ channel: process.env.HATRIX_TEST_CHROME === '1' ? 'chrome' : undefined });

test('scrolling upward inside article comments eases through intermediate positions', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/twikoo@2.0.13/dist/twikoo.min.js', (route) => route.abort());
  await page.goto('/posts/Infra-线性代数/');

  const screen = page.locator('.post-comments-screen');
  await screen.locator('[data-twikoo-root]').evaluate((root) => {
    const content = document.createElement('div');
    content.style.height = '2400px';
    root.append(content);
  });
  await screen.scrollIntoViewIfNeeded();
  await screen.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    (window as typeof window & { commentScrollPositions?: number[] }).commentScrollPositions = [];
    element.addEventListener('scroll', () => {
      (window as typeof window & { commentScrollPositions: number[] }).commentScrollPositions.push(element.scrollTop);
    });
  });

  const before = await screen.evaluate((element) => element.scrollTop);
  const box = await screen.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -420);

  await expect.poll(() => screen.evaluate((element) => element.scrollTop)).toBeLessThan(before);
  await expect.poll(() => page.evaluate(() => {
    const positions = (window as typeof window & { commentScrollPositions: number[] }).commentScrollPositions;
    return new Set(positions.map(Math.round)).size;
  })).toBeGreaterThanOrEqual(3);
});

test('upward wheel over comments at their top continues scrolling the article', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/twikoo@2.0.13/dist/twikoo.min.js', (route) => route.abort());
  await page.goto('/posts/Infra-线性代数/');

  const screen = page.locator('.post-comments-screen');
  await screen.locator('[data-twikoo-root]').evaluate((root) => {
    const content = document.createElement('div');
    content.style.height = '2400px';
    root.append(content);
  });
  await screen.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);
  const box = await screen.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -420);

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(before);
});

test('one upward wheel near the comments top carries remaining motion into the article', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/twikoo@2.0.13/dist/twikoo.min.js', (route) => route.abort());
  await page.goto('/posts/Infra-线性代数/');

  const screen = page.locator('.post-comments-screen');
  await screen.locator('[data-twikoo-root]').evaluate((root) => {
    const content = document.createElement('div');
    content.style.height = '2400px';
    root.append(content);
  });
  await screen.scrollIntoViewIfNeeded();
  await screen.evaluate((element) => { element.scrollTop = 20; });
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);
  await page.evaluate(() => {
    (window as typeof window & { articleScrollPositions?: number[] }).articleScrollPositions = [];
    window.addEventListener('scroll', () => {
      (window as typeof window & { articleScrollPositions: number[] }).articleScrollPositions.push(window.scrollY);
    });
  });
  const box = await screen.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -420);

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(before);
  await expect.poll(() => page.evaluate(() => {
    const positions = (window as typeof window & { articleScrollPositions: number[] }).articleScrollPositions;
    return new Set(positions.map(Math.round)).size;
  })).toBeGreaterThanOrEqual(3);
});

test('comments that do not overflow never trap article scrolling', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/twikoo@2.0.13/dist/twikoo.min.js', (route) => route.abort());
  await page.goto('/posts/Infra-线性代数/');

  const screen = page.locator('.post-comments-screen');
  await screen.scrollIntoViewIfNeeded();
  const dimensions = await screen.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);
  const box = await screen.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -420);

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(before);
});

test.describe('mobile article comments', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('touch, keyboard, and reduced motion keep comments and article reachable', async ({ page }) => {
    await page.route('https://cdn.jsdelivr.net/npm/twikoo@2.0.13/dist/twikoo.min.js', (route) => route.abort());
    await page.goto('/posts/Infra-线性代数/');

    const screen = page.locator('.post-comments-screen');
    await screen.locator('[data-twikoo-root]').evaluate((root) => {
      const content = document.createElement('div');
      content.style.height = '1800px';
      root.append(content);
    });
    await screen.scrollIntoViewIfNeeded();
    const box = await screen.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 5; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - step * 30 }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => screen.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    await screen.focus();
    const beforeKey = await screen.evaluate((element) => element.scrollTop);
    await page.keyboard.press('PageDown');
    await expect.poll(() => screen.evaluate((element) => element.scrollTop)).toBeGreaterThan(beforeKey);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await screen.evaluate((element) => { element.scrollTop = 0; });
    const beforePage = await page.evaluate(() => window.scrollY);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -420);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(beforePage);
  });
});
