import { expect, test } from '@playwright/test';

const createGate = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

test.describe('hexagon loading overlay', () => {
  test('is hidden after a normal page load and covers the full viewport', async ({ page }) => {
    await page.goto('/projects/');

    const overlay = page.locator('[data-loading-overlay]');
    await expect(overlay).toHaveAttribute('data-loading-state', 'hidden');
    await expect(overlay.locator('[data-loading-status]')).toHaveCount(0);

    const geometry = await overlay.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    });
    expect(geometry).toEqual({
      left: 0,
      top: 0,
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
      viewportWidth: geometry.viewportWidth,
      viewportHeight: geometry.viewportHeight
    });
  });

  test('appears only for a delayed navigation and hides after navigation completes', async ({ page }) => {
    await page.goto('/blog/');
    const gate = createGate();

    await page.route('**/projects/', async (route) => {
      await gate.promise;
      await route.continue();
    });

    await page.locator('a[href="/projects/"]').first().click();
    const overlay = page.locator('[data-loading-overlay]');
    await expect(overlay).toHaveAttribute('data-loading-state', 'loading', { timeout: 1000 });

    gate.release();
    await page.waitForURL('**/projects/');
    await expect(overlay).toHaveAttribute('data-loading-state', 'hidden', { timeout: 2000 });
  });

  test('does not show for a navigation that completes before the delay', async ({ page }) => {
    await page.goto('/blog/');
    const overlay = page.locator('[data-loading-overlay]');

    await page.locator('a[href="/projects/"]').first().click();
    await page.waitForURL('**/projects/');
    await expect(overlay).toHaveAttribute('data-loading-state', 'hidden');
  });

  test('disables continuous animation under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/blog/');
    const gate = createGate();

    await page.route('**/projects/', async (route) => {
      await gate.promise;
      await route.continue();
    });
    await page.locator('a[href="/projects/"]').first().click();

    const overlay = page.locator('[data-loading-overlay]');
    await expect(overlay).toHaveAttribute('data-loading-state', 'loading', { timeout: 1000 });
    const reducedState = await overlay.evaluate((element) => {
      const block = element.querySelector<SVGUseElement>('.loading-overlay__block');
      return {
        strokeOpacity: block ? getComputedStyle(block).strokeOpacity : '',
        hasPulse: Boolean(element.querySelector('.loading-overlay__pulse')),
        hasScanLine: Boolean(element.querySelector('.loading-overlay__line'))
      };
    });
    expect(reducedState).toEqual({ strokeOpacity: '1', hasPulse: false, hasScanLine: false });

    gate.release();
    await page.waitForURL('**/projects/');
    await expect(overlay).toHaveAttribute('data-loading-state', 'hidden', { timeout: 2000 });
  });
});
