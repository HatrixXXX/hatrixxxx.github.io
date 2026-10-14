import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('leaving favorites closes the shutter before the next page swaps in', async ({ page }) => {
  await page.goto('/favorites/');
  await expect(page.locator('[data-favorites-reel]')).toBeVisible();
  const loader = page.locator('#page-loader');

  let releaseNavigation!: () => void;
  let navigationRequested!: () => void;
  const gate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
  const requested = new Promise<void>((resolve) => { navigationRequested = resolve; });
  await page.route('**/plans/', async (route) => {
    navigationRequested();
    await gate;
    await route.continue();
  });

  try {
    await page.locator('.desktop-nav a[href="/plans/"]').click();
    await requested;
    await expect(loader).toBeVisible();
    await expect(loader.locator('.pl-shutter-leaf')).toHaveCount(2);
    await expect(page).toHaveURL('/favorites/');
  } finally {
    releaseNavigation();
  }

  await expect(page).toHaveURL('/plans/');
  await expect(loader).toBeHidden();
});

test('entering favorites shows the reel without requesting the removed model', async ({ page }) => {
  await page.goto('/plans/');
  const loader = page.locator('#page-loader');
  await expect(loader).toBeHidden();
  const modelRequests: string[] = [];
  page.on('request', (request) => { if (request.url().endsWith('.glb')) modelRequests.push(request.url()); });
  await page.locator('.desktop-nav a[href="/favorites/"]').click();
  await expect(page).toHaveURL('/favorites/');
  await expect(page.locator('[data-favorites-selected]')).toHaveText('扬神的博客');
  await expect(loader).toBeHidden();
  expect(modelRequests).toEqual([]);
});

test('a client navigation closes both shutter leaves before swapping pages, then opens them', async ({ page }, testInfo) => {
  await page.goto('/plans/');
  const loader = page.locator('#page-loader');
  await expect(loader).toBeHidden();

  let releaseNavigation!: () => void;
  let navigationRequested!: () => void;
  const gate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
  const requested = new Promise<void>((resolve) => { navigationRequested = resolve; });
  await page.route('**/blogs/', async (route) => {
    navigationRequested();
    await gate;
    await route.continue();
  });

  try {
    await page.locator('a[href="/blogs/"]').first().click();
    await requested;
    await expect(loader).toBeVisible();
    await expect(loader.locator('.pl-shutter-leaf')).toHaveCount(2);
    await expect(loader.locator('.pl-ring-wrap')).toHaveCount(0);
    await expect.poll(async () => loader.evaluate((element) => {
      const leaves = Array.from(element.querySelectorAll<HTMLElement>('.pl-shutter-leaf'));
      if (leaves.length !== 2) return false;
      const [left, right] = leaves.map((leaf) => leaf.getBoundingClientRect());
      return left.left >= -1 && right.right <= innerWidth + 1;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('desktop-closed.png') });
    await expect(page).toHaveURL('/plans/');
  } finally {
    releaseNavigation();
  }

  await expect(page).toHaveURL('/blogs/');
  await expect(loader).toBeHidden();
});

test('the shutter covers a tall mobile viewport through the menu navigation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/plans/');
  const loader = page.locator('#page-loader');
  await expect(loader).toBeHidden();

  let releaseNavigation!: () => void;
  const gate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
  await page.route('**/blogs/', async (route) => {
    await gate;
    await route.continue();
  });

  try {
    await page.getByRole('button', { name: '切换导航栏' }).click();
    await page.locator('#mobile-menu a[href="/blogs/"]').click();
    await expect(loader.locator('.pl-shutter-leaf')).toHaveCount(2);
    await expect.poll(async () => loader.evaluate((element) => {
      const leaves = Array.from(element.querySelectorAll<HTMLElement>('.pl-shutter-leaf'));
      if (leaves.length !== 2) return false;
      const [left, right] = leaves.map((leaf) => leaf.getBoundingClientRect());
      return left.left >= -1 && right.right <= innerWidth + 1;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('mobile-closed.png') });
  } finally {
    releaseNavigation();
  }

  await expect(page).toHaveURL('/blogs/');
  await expect(loader).toBeHidden();
});

test('reduced motion still covers navigation without a sliding animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/plans/');
  const loader = page.locator('#page-loader');
  await expect(loader).toBeHidden();

  let releaseNavigation!: () => void;
  const gate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
  await page.route('**/blogs/', async (route) => {
    await gate;
    await route.continue();
  });

  try {
    await page.locator('a[href="/blogs/"]').first().click();
    await expect(loader.locator('.pl-shutter-leaf')).toHaveCount(2);
    expect(await loader.locator('.pl-shutter-leaf').first().evaluate((leaf) =>
      getComputedStyle(leaf).transitionDuration)).toBe('0s');
  } finally {
    releaseNavigation();
  }

  await expect(page).toHaveURL('/blogs/');
  await expect(loader).toBeHidden();
});
