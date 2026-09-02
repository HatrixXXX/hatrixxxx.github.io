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
  await expect(page.locator('[data-archive-total]')).toHaveText('40');
  await page.keyboard.press('Control+K');
  await expect(page.getByRole('searchbox', { name: '搜索文章' })).toBeFocused();
  expect(indexRequests).toBe(1);
});

test('search retries after the first index request fails', async ({ page }) => {
  let attempts = 0;
  await page.route('**/search-index.json', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '[]' });
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await page.keyboard.press('Control+K');
  await expect(page.locator('[data-search-status]')).toHaveText('搜索索引暂时无法载入');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+K');
  await page.getByRole('searchbox', { name: '搜索文章' }).fill('FPGA');
  await expect(page.locator('[data-search-result]').first()).toBeVisible();
  expect(attempts).toBe(2);
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

test('theme transition runs once and persists the destination theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.goto('/');

  const overlay = page.locator('[data-theme-transition]');
  const toggle = page.getByRole('button', { name: '切换主题' });
  await expect(overlay).toBeHidden();

  await toggle.click();
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('data-from-theme', 'light');
  await expect(overlay).toHaveAttribute('data-to-theme', 'dark');
  await expect(toggle).toBeDisabled();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await toggle.dispatchEvent('click');
  await expect(overlay).toHaveAttribute('data-to-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await expect(overlay).toBeHidden({ timeout: 4_000 });
  await expect(toggle).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('hatrix-theme'))).toBe('dark');
});

test('pending destination survives immediate client navigation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.goto('/');

  await page.getByRole('button', { name: '切换主题' }).click();
  expect(await page.evaluate(() => localStorage.getItem('hatrix-theme'))).toBe('dark');

  await page.getByRole('link', { name: '归档', exact: true }).dispatchEvent('click');
  await expect(page).toHaveURL(/\/archives\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-theme-transition]')).toBeHidden();
  await expect(page.getByRole('button', { name: '切换主题' })).toBeEnabled();
});

test('reduced motion switches theme without showing the transition overlay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.goto('/');

  const overlay = page.locator('[data-theme-transition]');
  await expect(overlay).toHaveCount(1);
  await page.getByRole('button', { name: '切换主题' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(overlay).toBeHidden();
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

test('article images open PhotoSwipe from the keyboard', async ({ page }) => {
  await page.goto('/posts/本科数学大杂烩/');
  const image = page.locator('article img').first();
  await image.focus();
  await expect(image).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pswp')).toBeVisible();
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
  await expect(player.getByRole('progressbar', { name: '播放进度' })).toHaveAttribute(
    'aria-valuenow',
    '0'
  );
  await expect(player.getByText('0:00 / 0:00')).toBeVisible();

  const firstCard = page.locator('article[data-post-card]').first();
  await firstCard.evaluate((element) => element.scrollIntoView({ block: 'end' }));
  await expect(firstCard).toBeInViewport();
  expect(await player.evaluate((element) => {
    const primary = document.querySelector('article[data-post-card]');
    if (!primary) throw new Error('Missing primary content probe');
    const playerRect = element.getBoundingClientRect();
    const primaryRect = primary.getBoundingClientRect();
    return playerRect.left < primaryRect.right && playerRect.right > primaryRect.left
      && playerRect.top < primaryRect.bottom && playerRect.bottom > primaryRect.top;
  })).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const sidebar = page.locator('.profile-sidebar');
  await sidebar.evaluate((element) => element.scrollIntoView({ block: 'end' }));
  await expect(sidebar).toBeInViewport();
  expect(await page.locator('[data-music-player]').evaluate((element) => {
    const visibleSidebar = document.querySelector('.profile-sidebar');
    if (!visibleSidebar) throw new Error('Missing sidebar probe');
    const playerRect = element.getBoundingClientRect();
    const sidebarRect = visibleSidebar.getBoundingClientRect();
    return playerRect.left < sidebarRect.right && playerRect.right > sidebarRect.left
      && playerRect.top < sidebarRect.bottom && playerRect.bottom > sidebarRect.top;
  })).toBe(false);

  await page.setViewportSize({ width: 1440, height: 900 });
  const persistedPlayer = page.locator('[data-music-player]');
  await persistedPlayer.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));

  await page.getByRole('link', { name: '归档', exact: true }).click();
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-persist-probe', 'same-node');
  expect(await page.evaluate(() => (window as Window & { __audioConstructed?: number }).__audioConstructed)).toBe(0);
  expect(mediaRequests).toEqual([]);
});
