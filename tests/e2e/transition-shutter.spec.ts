import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('a client navigation closes both shutter leaves before swapping pages, then opens them', async ({ page }, testInfo) => {
  await page.goto('/plans/');
  const loader = page.locator('#page-loader');
  await expect(loader).toBeHidden();

  let releaseNavigation!: () => void;
  let navigationRequested!: () => void;
  const gate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
  const requested = new Promise<void>((resolve) => { navigationRequested = resolve; });
  await page.route('**/blog/', async (route) => {
    navigationRequested();
    await gate;
    await route.continue();
  });

  try {
    await page.locator('a[href="/blog/"]').first().click();
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

  await expect(page).toHaveURL('/blog/');
  await expect(loader).toBeHidden();
});

test('the shutter covers a tall mobile viewport through the menu navigation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/plans/');
  const loader = page.locator('#page-loader');
  await expect(loader).toBeHidden();

  let releaseNavigation!: () => void;
  const gate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
  await page.route('**/blog/', async (route) => {
    await gate;
    await route.continue();
  });

  try {
    await page.getByRole('button', { name: '切换导航栏' }).click();
    await page.locator('#mobile-menu a[href="/blog/"]').click();
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

  await expect(page).toHaveURL('/blog/');
  await expect(loader).toBeHidden();
});

test('reduced motion still covers navigation without a sliding animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/plans/');
  const loader = page.locator('#page-loader');
  await expect(loader).toBeHidden();

  let releaseNavigation!: () => void;
  const gate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
  await page.route('**/blog/', async (route) => {
    await gate;
    await route.continue();
  });

  try {
    await page.locator('a[href="/blog/"]').first().click();
    await expect(loader.locator('.pl-shutter-leaf')).toHaveCount(2);
    expect(await loader.locator('.pl-shutter-leaf').first().evaluate((leaf) =>
      getComputedStyle(leaf).transitionDuration)).toBe('0s');
  } finally {
    releaseNavigation();
  }

  await expect(page).toHaveURL('/blog/');
  await expect(loader).toBeHidden();
});
