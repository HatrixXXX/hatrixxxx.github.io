import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('a reloaded inner page keeps the splash until its background is ready', async ({ page }) => {
  let requestCount = 0;
  let releaseReload!: () => void;
  let reloadRequested!: () => void;
  const gate = new Promise<void>((resolve) => { releaseReload = resolve; });
  const requested = new Promise<void>((resolve) => { reloadRequested = resolve; });
  await page.route('**/assets/backgrounds/background.png', async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.continue();
      return;
    }
    reloadRequested();
    await gate;
    await route.continue();
  });

  await page.goto('/plans/');
  await expect(page.locator('#page-loader')).toBeHidden();

  const reload = page.reload({ waitUntil: 'domcontentloaded' });
  try {
    await requested;
    const loader = page.locator('#page-loader');
    await expect(loader).toBeVisible();
    await expect(loader.locator('.pl-ring-wrap')).toHaveCount(1);
    await expect(loader).not.toHaveClass(/pl-done/);
  } finally {
    releaseReload();
  }
  await reload;
  await expect(page.locator('#page-loader')).toBeHidden();
});

test('client navigation presents the showcase without loading a box lid', async ({ page }) => {
  const lidRequests: string[] = [];
  page.on('request', (request) => {
    if (/project-(atlas-cover|display-case-lid)/.test(request.url())) lidRequests.push(request.url());
  });
  await page.goto('/plans/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('a[href="/creation/"]').first().click();
  await expect(page).toHaveURL('/creation/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await expect(page.locator('[data-project-badge="0"]')).toBeVisible();
  await expect(page.locator('[data-project-detail="0"]')).toBeVisible();
  expect(lidRequests).toEqual([]);
});

test('client navigation waits for the blog card frame to decode', async ({ page }) => {
  await page.goto('/plans/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.evaluate(() => {
    const nativeDecode = HTMLImageElement.prototype.decode;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    (window as unknown as { releaseFrameDecode: () => void }).releaseFrameDecode = release;
    HTMLImageElement.prototype.decode = async function () {
      if (this.src.includes('/assets/blog-cards/desktop-frame.webp')) {
        await gate;
      }
      return nativeDecode.call(this);
    };
  });

  try {
    await page.locator('a[href="/blogs/"]').first().click();
    await expect(page).toHaveURL('/blogs/');
    await page.waitForTimeout(700);
    await expect(page.locator('#page-loader')).toHaveClass(/pl-visible.*pl-closed/);
    await expect(page.locator('#page-loader')).not.toHaveClass(/pl-done/);
  } finally {
    await page.evaluate(() => (window as unknown as { releaseFrameDecode: () => void }).releaseFrameDecode());
  }

  await expect(page.locator('#page-loader')).toBeHidden();
});

test('client navigation reveals the page when artwork decode never settles', async ({ page }) => {
  await page.goto('/plans/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.evaluate(() => {
    const nativeDecode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      if (this.src.includes('/assets/blog-cards/desktop-frame.webp')) {
        return new Promise<void>(() => {});
      }
      return nativeDecode.call(this);
    };
  });

  await page.locator('a[href="/blogs/"]').first().click();
  await expect(page).toHaveURL('/blogs/');
  await expect(page.locator('[data-post-card]').first()).toBeAttached();
  const loader = page.locator('#page-loader');
  await expect(loader).toHaveClass(/pl-visible.*pl-closed/);
  await page.waitForTimeout(16_000);
  await expect(loader).toBeHidden();
});

test('client navigation holds the guestbook shutter until comments finish mounting', async ({ page }) => {
  await page.goto('/plans/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.evaluate(() => {
    const holder = window as unknown as { twikoo: { init: () => Promise<void> }; releaseComments: () => void };
    holder.twikoo = {
      init: () => new Promise<void>((resolve) => { holder.releaseComments = resolve; })
    };
  });

  try {
    await page.locator('a[href="/guestbook/"]').first().click();
    await expect(page).toHaveURL('/guestbook/');
    await expect(page.locator('[data-twikoo-comments]')).toHaveAttribute('data-twikoo-state', 'loading');
    await page.waitForTimeout(700);
    await expect(page.locator('#page-loader')).toHaveClass(/pl-visible.*pl-closed/);
    await expect(page.locator('#page-loader')).not.toHaveClass(/pl-done/);
  } finally {
    await page.evaluate(() => (window as unknown as { releaseComments: () => void }).releaseComments());
  }

  await expect(page.locator('[data-twikoo-comments]')).toHaveAttribute('data-twikoo-state', 'ready');
  await expect(page.locator('#page-loader')).toBeHidden();
});
