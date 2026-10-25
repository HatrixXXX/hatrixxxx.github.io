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
  await page.route('**/sanctuary/', async (route) => {
    navigationRequested();
    await gate;
    await route.continue();
  });

  try {
    await page.locator('.desktop-nav a[href="/sanctuary/"]').click();
    await requested;
    await expect(loader).toBeVisible();
    await expect(loader.locator('.pl-shutter-leaf')).toHaveCount(2);
    await expect(page).toHaveURL('/favorites/');
  } finally {
    releaseNavigation();
  }

  await expect(page).toHaveURL('/sanctuary/');
  await expect(loader).toBeHidden();
});

test('entering favorites shows the reel without requesting the removed model', async ({ page }) => {
  await page.goto('/sanctuary/');
  const loader = page.locator('#page-loader');
  await expect(loader).toBeHidden();
  const modelRequests: string[] = [];
  page.on('request', (request) => { if (request.url().endsWith('.glb')) modelRequests.push(request.url()); });
  await page.locator('.desktop-nav a[href="/favorites/"]').click();
  await expect(page).toHaveURL('/favorites/');
  await expect(page.locator('[data-favorites-selected]')).toHaveText('Human System Optimization');
  await expect(loader).toBeHidden();
  expect(modelRequests).toEqual([]);
});

test('a client navigation closes both shutter leaves before swapping pages, then opens them', async ({ page }, testInfo) => {
  await page.goto('/sanctuary/');
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
    await expect(page).toHaveURL('/sanctuary/');
  } finally {
    releaseNavigation();
  }

  await expect(page).toHaveURL('/blogs/');
  await expect(loader).toBeHidden();
});

test('the shutter visibly pulls apart after the destination becomes ready', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const requestStarted = new Promise<void>((resolve) => { requested = resolve; });
  await page.route('**/blogs/', async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  const loader = page.locator('#page-loader');
  try {
    await page.locator('.desktop-nav a[href="/blogs/"]').click();
    await requestStarted;
    await expect.poll(() => loader.locator('.pl-shutter-leaf--left').evaluate((leaf) =>
      leaf.getBoundingClientRect().left)).toBeGreaterThanOrEqual(-1);
    await page.evaluate(() => {
      const runtime = window as Window & { __shutterRevealPositions?: number[] };
      runtime.__shutterRevealPositions = [];
      const element = document.querySelector('#page-loader')!;
      const sample = () => {
        if (element.classList.contains('pl-done')) {
          const leaf = element.querySelector<HTMLElement>('.pl-shutter-leaf--left');
          if (leaf) runtime.__shutterRevealPositions!.push(leaf.getBoundingClientRect().left);
        }
        if (element.classList.contains('pl-visible')) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  } finally {
    release();
  }
  await expect(page).toHaveURL('/blogs/');
  await expect(loader).toBeHidden();
  const positions = await page.evaluate(() =>
    (window as Window & { __shutterRevealPositions?: number[] }).__shutterRevealPositions ?? []);
  expect(positions.some((left) => left < -40 && left > -page.viewportSize()!.width / 2 + 40)).toBe(true);
});

test('the shutter covers a tall mobile viewport through the menu navigation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sanctuary/');
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
  await page.goto('/sanctuary/');
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

test('hiding during shutter closure settles the leaves before page swap', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const requestStarted = new Promise<void>((resolve) => { requested = resolve; });
  await page.route('**/blogs/', async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  const loader = page.locator('#page-loader');
  try {
    await page.locator('.desktop-nav a[href="/blogs/"]').click();
    await requestStarted;
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => loader.evaluate((element) => {
      const leaves = [...element.querySelectorAll<HTMLElement>('.pl-shutter-leaf')];
      if (leaves.length !== 2) return false;
      const [left, right] = leaves.map((leaf) => leaf.getBoundingClientRect());
      return left.left >= -1 && right.right <= innerWidth + 1;
    })).toBe(true);
  } finally {
    release();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }
  await page.waitForTimeout(750);
  await expect(loader).toBeHidden();
});

test('switching to reduced motion settles an active shutter immediately', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const requestStarted = new Promise<void>((resolve) => { requested = resolve; });
  await page.route('**/blogs/', async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  const loader = page.locator('#page-loader');
  try {
    await page.locator('.desktop-nav a[href="/blogs/"]').click();
    await requestStarted;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const closed = await loader.evaluate((element) => {
      const leaves = [...element.querySelectorAll<HTMLElement>('.pl-shutter-leaf')];
      if (leaves.length !== 2) return false;
      const [left, right] = leaves.map((leaf) => leaf.getBoundingClientRect());
      return left.left >= -1 && right.right <= innerWidth + 1;
    });
    expect(closed).toBe(true);
  } finally {
    release();
  }
  await expect(page).toHaveURL('/blogs/');
  await expect(loader).toBeHidden();
});
