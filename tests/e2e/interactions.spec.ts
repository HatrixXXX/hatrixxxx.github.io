import { expect, test } from '@playwright/test';

test('search loads its index once, limits results and closes with Escape', async ({ page }) => {
  let indexRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/search-index.json') indexRequests += 1;
  });

  await page.goto('/');
  expect(indexRequests).toBe(0);

  await page.keyboard.press('Control+K');
  const searchbox = page.getByRole('searchbox', { name: '搜索文章' });
  await expect(searchbox).toBeFocused();
  await searchbox.fill('FPGA');
  await expect(page.locator('[data-search-result]').first()).toBeVisible();

  await searchbox.fill('a');
  expect(await page.locator('[data-search-result]').count()).toBeLessThanOrEqual(20);
  await page.keyboard.press('Escape');
  await expect(searchbox).toBeHidden();

  await page.getByRole('link', { name: '归档', exact: true }).click();
  await page.keyboard.press('Control+K');
  await expect(page.getByRole('searchbox', { name: '搜索文章' })).toBeFocused();
  expect(indexRequests).toBe(1);
});

test('stored theme is applied and one click toggles it after client navigation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('link', { name: '归档', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '切换主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('hatrix-theme'))).toBe('dark');
});

test('mobile menu toggles once and closes on Escape and navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: '切换导航栏' });

  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

  await menuButton.click();
  await page.locator('[data-mobile-menu]').getByRole('link', { name: '归档' }).click();
  await expect(page.getByRole('button', { name: '切换导航栏' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );

  await page.getByRole('button', { name: '切换导航栏' }).click();
  await expect(page.getByRole('button', { name: '切换导航栏' })).toHaveAttribute(
    'aria-expanded',
    'true'
  );
});

test('PhotoSwipe is requested only when an article image is activated', async ({ page }) => {
  const lightboxRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().toLowerCase().includes('photoswipe')) {
      lightboxRequests.push(request.url());
    }
  });

  await page.goto('/posts/本科数学大杂烩/');
  expect(lightboxRequests).toEqual([]);
  await page.locator('article img').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
  expect(lightboxRequests).not.toEqual([]);
});

test('empty music player persists without constructing Audio or requesting media', async ({ page }) => {
  const mediaRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'media') mediaRequests.push(request.url());
  });
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    Object.defineProperty(window, '__audioConstructed', { value: 0, writable: true });
    window.Audio = new Proxy(NativeAudio, {
      construct(target, args) {
        Object.defineProperty(window, '__audioConstructed', {
          value: Number((window as Window & { __audioConstructed?: number }).__audioConstructed) + 1,
          writable: true
        });
        return Reflect.construct(target, args);
      }
    });
  });

  await page.goto('/');
  const player = page.locator('[data-music-player]');
  await expect(player.getByText('歌单待添加')).toBeVisible();
  await expect(player.getByRole('button', { name: '上一首' })).toBeDisabled();
  await expect(player.getByRole('button', { name: '播放' })).toBeDisabled();
  await expect(player.getByRole('button', { name: '下一首' })).toBeDisabled();
  await player.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));

  await page.getByRole('link', { name: '归档', exact: true }).click();
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-persist-probe', 'same-node');
  expect(await page.evaluate(() => (window as Window & { __audioConstructed?: number }).__audioConstructed)).toBe(0);
  expect(mediaRequests).toEqual([]);
});
