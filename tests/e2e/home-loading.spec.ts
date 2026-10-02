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

for (const outcome of ['ready', 'deadline'] as const) {
  test(`a superseded home ${outcome} cannot dismiss the next navigation loader`, async ({ page }) => {
    let releaseCharacter!: () => void;
    let releaseNavigation!: () => void;
    let navigationRequested!: () => void;
    const characterGate = new Promise<void>((resolve) => { releaseCharacter = resolve; });
    const navigationGate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
    const requested = new Promise<void>((resolve) => { navigationRequested = resolve; });
    await page.clock.install();
    await page.route('**/character-parts/foot_L.webp', async (route) => {
      await characterGate;
      await route.continue();
    });
    await page.route('**/blog/', async (route) => {
      navigationRequested();
      await navigationGate;
      await route.continue();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loader = page.locator('#page-loader');
    try {
      await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'loading');
      await expect(loader).toHaveClass(/pl-visible/);
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
      await page.locator('[data-home-blog]').dispatchEvent('click');
      await requested;
      if (outcome === 'ready') {
        releaseCharacter();
        await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'ready');
        await page.clock.runFor(2_500);
      } else {
        await page.clock.runFor(9_000);
      }
      await expect(loader).toHaveClass(/pl-visible/);
      await expect(loader).not.toHaveClass(/pl-done/);
      await expect(loader.locator('.pl-pct-num')).toHaveText('80%');
    } finally {
      releaseCharacter();
      releaseNavigation();
      await page.clock.resume();
    }
    await expect(page).toHaveURL(/\/blog\/$/);
    await expect(loader).not.toHaveClass(/pl-visible/);
  });
}
