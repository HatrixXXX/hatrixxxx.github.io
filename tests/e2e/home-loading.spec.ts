import { expect, test } from '@playwright/test';

test('holds the loader and character until every layer is decoded', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/character-parts/foot_L.webp', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const rig = page.locator('[data-char-rig]');
  const loader = page.locator('#page-loader');
  try {
    await expect(rig).toHaveAttribute('data-character-state', 'loading');
    await expect(rig).toBeHidden();
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(loader.locator('.pl-pct-num')).toHaveText('85%');
    await expect(loader).not.toHaveClass(/pl-done/);
  } finally {
    release();
  }
  await expect(rig).toHaveAttribute('data-character-state', 'ready');
  await expect(rig).toBeVisible();
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-layout-state', 'ready');
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('dismisses the loader but keeps a failed character hidden', async ({ page }) => {
  await page.route('**/character-parts/foot_L.webp', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'error');
  await expect(page.locator('[data-char-rig]')).toBeHidden();
  await expect(page.locator('#page-loader')).not.toHaveClass(/pl-visible/);
});

test('dismisses after the deadline and never reveals a late character', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/character-parts/foot_L.webp', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const rig = page.locator('[data-char-rig]');
  const loader = page.locator('#page-loader');
  try {
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(rig).toHaveAttribute('data-character-state', 'error', { timeout: 10_000 });
    await expect(loader).not.toHaveClass(/pl-visible/);
  } finally {
    release();
  }
  await expect.poll(() => rig.locator('[data-part="foot_L"]').evaluate((element: HTMLImageElement) =>
    element.complete && element.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(rig).toHaveAttribute('data-character-state', 'error');
  await expect(rig).toBeHidden();
});
