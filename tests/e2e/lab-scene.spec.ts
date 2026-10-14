import { expect, test, type Page } from '@playwright/test';

async function recordLabSplash(page: Page): Promise<void> {
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (location.pathname === '/playground/' && document.documentElement?.dataset.initialPageLoader === 'visible') {
        sessionStorage.setItem('lab-splash-seen', 'true');
      }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-initial-page-loader'] });
  });
}

test('the lab keeps the site navigation around its inline WebGL scene', async ({ page }) => {
  await recordLabSplash(page);
  await page.goto('/playground/');
  await expect(page).toHaveURL('/playground/');
  await expect(page).toHaveTitle(/^实验场 \|/);
  await expect(page.locator('header[data-site-header]')).toBeVisible();
  await expect(page.locator('[data-back-button]')).toHaveAttribute('href', '/');
  await expect(page.locator('[data-search-overlay]')).toHaveCount(1);
  await expect(page.locator('main #lab-scene canvas#scene')).toBeVisible();
  await expect(page.locator('canvas#scene')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-hero], iframe, main h1, main button')).toHaveCount(0);
  await expect(page.locator('[data-music-player]')).toBeVisible();
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-ui-state', 'collapsed');
  await expect(page.locator('#page-loader')).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem('lab-splash-seen'))).toBe('true');
  expect(await page.locator('body').evaluate((body) => body.style.getPropertyValue('--page-bg-image')))
    .toContain('/assets/backgrounds/background.png');
  await expect(page.locator('html')).not.toHaveAttribute('data-initial-page-loader', 'visible');
  const size = await page.locator('canvas#scene').evaluate((canvas: HTMLCanvasElement) => ({
    width: canvas.width,
    height: canvas.height,
    webgl: Boolean(canvas.getContext('webgl2'))
  }));
  expect(size.width).toBeGreaterThan(100);
  expect(size.height).toBeGreaterThan(100);
  expect(size.webgl).toBe(true);
});

test('entering the lab closes the transition shutter and reveals a ready scene', async ({ page }) => {
  await recordLabSplash(page);
  await page.goto('/blogs/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.evaluate(() => {
    const loader = document.querySelector('#page-loader')!;
    new MutationObserver(() => {
      if (loader.classList.contains('pl-closed') && loader.querySelectorAll('.pl-shutter-leaf').length === 2) {
        sessionStorage.setItem('lab-shutter-seen', 'true');
      }
      if (loader.classList.contains('pl-visible') && loader.querySelector('.pl-ring-wrap')) {
        sessionStorage.setItem('lab-ring-seen', 'true');
      }
    }).observe(loader, { attributes: true, childList: true });
  });

  await page.locator('.desktop-nav a[href="/playground/"]').click();
  await expect(page).toHaveURL('/playground/');
  expect(await page.evaluate(() => sessionStorage.getItem('lab-shutter-seen'))).toBe('true');
  expect(await page.evaluate(() => sessionStorage.getItem('lab-splash-seen'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('lab-ring-seen'))).toBeNull();
  await expect(page.locator('#page-loader')).toBeHidden();
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
});

test('the home lab shortcut also uses the transition shutter', async ({ page }) => {
  await recordLabSplash(page);
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.evaluate(() => {
    const loader = document.querySelector('#page-loader')!;
    new MutationObserver(() => {
      if (loader.classList.contains('pl-closed') && loader.querySelectorAll('.pl-shutter-leaf').length === 2) {
        sessionStorage.setItem('home-lab-shutter-seen', 'true');
      }
    }).observe(loader, { attributes: true, childList: true });
  });

  await page.locator('[data-home-panel="lab-shortcut"] a[href="/playground/"]').click();
  await expect(page).toHaveURL('/playground/');
  expect(await page.evaluate(() => sessionStorage.getItem('home-lab-shutter-seen'))).toBe('true');
  expect(await page.evaluate(() => sessionStorage.getItem('lab-splash-seen'))).toBeNull();
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#page-loader')).toBeHidden();
});

test('browser history restores the lab scene after leaving it', async ({ page }) => {
  await page.goto('/playground/');
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true');
  await page.locator('[data-back-button]').click();
  await expect(page).toHaveURL('/');
  await page.goBack();
  await expect(page).toHaveURL('/playground/');
  await expect(page.locator('#scene')).toHaveAttribute('data-ready', 'true', { timeout: 12_000 });
  await expect(page.locator('#page-loader')).toBeHidden();
});

test('the model stays below the navigation on a phone and accepts orbit input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/playground/');
  const scene = page.locator('canvas#scene');
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute('data-ready', 'true');
  const beforeOrbit = await scene.screenshot();
  await scene.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('+');
  const afterOrbit = await scene.screenshot();
  expect(afterOrbit.equals(beforeOrbit)).toBe(false);
  await expect(scene).toHaveAttribute('tabindex', '0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const canvasBox = await scene.boundingBox();
  const headerBox = await page.locator('header[data-site-header]').boundingBox();
  expect(canvasBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
});
