import { expect, test } from '@playwright/test';
import { playlist } from '../../src/data/playlist';

test.use({ timezoneId: 'Asia/Shanghai' });

test('site statistics synchronize the persistent visitor source after client navigation', async ({
  page
}) => {
  const vercountRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('events.vercount.one')) vercountRequests.push(request.url());
  });

  await page.goto('/blogs/');
  await page.locator('[data-visitor-count-source]').evaluate((source) => {
    source.textContent = '1,234';
  });
  await page.locator('[data-post-card][data-active="true"] h2 a').focus();
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname.startsWith('/posts/'));

  const visitors = page.locator('[data-site-footer] [data-visitor-count]');
  await expect(visitors).toHaveText('1,234');
  await page.locator('[data-visitor-count-source]').evaluate((source) => {
    source.textContent = '2,345';
  });
  await expect(visitors).toHaveText('2,345');
  await page.locator('[data-visitor-count-source]').evaluate((source) => {
    source.textContent = 'Loading';
  });
  await expect(visitors).toHaveText('2,345');
  expect(vercountRequests).toEqual([]);
});

test('search loads its index once, limits results and closes with Escape', async ({ page }) => {
  let indexRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/search-index.json') indexRequests += 1;
  });

  await page.goto('/');
  expect(indexRequests).toBe(0);

  await page.keyboard.press('Control+K');
  const searchbox = page.getByRole('searchbox', { name: '搜索全站' });
  await expect(searchbox).toBeFocused();
  await searchbox.fill('FPGA');
  await expect(page.locator('[data-search-result]').first()).toBeVisible();

  await searchbox.fill('a');
  expect(await page.locator('[data-search-result]').count()).toBeLessThanOrEqual(20);
  await page.keyboard.press('Escape');
  await expect(searchbox).toBeHidden();

  await page.getByRole('link', { name: '作品橱窗', exact: true }).click();
  await expect(page).toHaveURL('/creation/');
  await page.keyboard.press('Control+K');
  await expect(page.getByRole('searchbox', { name: '搜索全站' })).toBeFocused();
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
  await page.getByRole('searchbox', { name: '搜索全站' }).fill('FPGA');
  await expect(page.locator('[data-search-result]').first()).toBeVisible();
  expect(attempts).toBe(2);
});

test('search results show a highlighted body excerpt and carry the query to the post', async ({ page }) => {
  await page.route('**/search-index.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'body-search-fixture',
        url: '/posts/body-search-fixture/',
        title: '正文搜索测试',
        locked: false,
        text: '正文搜索测试 矩阵乘法需要分块处理',
        paragraphs: ['第一段没有命中。', '矩阵乘法需要分块处理。']
      }])
    });
  });

  await page.goto('/');
  await page.keyboard.press('Control+K');
  await page.getByRole('searchbox', { name: '搜索全站' }).fill('矩阵');

  const result = page.locator('[data-search-result]').first();
  await expect(result.locator('[data-search-excerpt] mark')).toHaveText('矩阵');
  await expect(result).toHaveAttribute('href', '/posts/body-search-fixture/?q=%E7%9F%A9%E9%98%B5');
});

test('post pages locate and temporarily highlight the searched paragraph', async ({ page }) => {
  await page.goto('/posts/计算机体系结构与 STM32/?q=矩阵');

  const hit = page.locator('.prose [data-search-hit]');
  await expect(hit).toContainText('矩阵存储结构');
  await expect(hit).toHaveCSS('box-shadow', /inset/);
});

test('site stays dark after client navigation', async ({ page }) => {
  await page.goto('/creation/');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  expect(await page.locator('html').getAttribute('data-theme')).toBeNull();

  await page.locator('.desktop-nav a[href="/blogs/"]').click();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
});

test('mobile menu toggles once and closes on Escape and navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/creation/');
  const menuButton = page.getByRole('button', { name: '切换导航栏' });

  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

  await menuButton.click();
  await page
    .locator('[data-mobile-menu]')
    .getByRole('link', { name: '博客文章', exact: true })
    .click();
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

test('PhotoSwipe script is requested only when an article image is activated', async ({ page }) => {
  const lightboxRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.toLowerCase().includes('photoswipe') && url.pathname.endsWith('.js')) {
      lightboxRequests.push(request.url());
    }
  });

  await page.goto('/posts/Infra-线性代数/');
  expect(lightboxRequests).toEqual([]);
  await page.locator('article img').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
  expect(lightboxRequests).not.toEqual([]);
});

test('article images open PhotoSwipe from the keyboard', async ({ page }) => {
  await page.goto('/posts/Infra-线性代数/');
  const image = page.locator('article img').first();
  await image.focus();
  await expect(image).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pswp')).toBeVisible();
});

test('article lightbox stays within 80 percent and closes when its image or backdrop is clicked', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/posts/Infra-线性代数/');
  const image = page.locator('article[data-post] .prose img').first();
  const lightbox = page.locator('.pswp');

  await image.click();
  await expect(lightbox).toBeVisible();
  await page.waitForTimeout(350);
  const enlarged = await lightbox.locator('img.pswp__img:not(.pswp__img--placeholder)').boundingBox();
  if (!enlarged) throw new Error('Missing enlarged image');
  expect(enlarged.width).toBeLessThanOrEqual(1440 * 0.8 + 1);
  expect(enlarged.height).toBeLessThanOrEqual(900 * 0.8 + 1);
  const background = await lightbox.locator('.pswp__bg').evaluate((element) => {
    const style = getComputedStyle(element);
    return { opacity: Number(style.opacity), color: style.backgroundColor };
  });
  expect(background.opacity).toBeGreaterThanOrEqual(0.65);
  expect(background.opacity).toBeLessThan(0.8);
  expect(background.color).not.toBe('rgb(0, 0, 0)');

  await lightbox.locator('img.pswp__img:not(.pswp__img--placeholder)').click();
  await expect(lightbox).toBeHidden();
  await image.click();
  await expect(lightbox).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(lightbox).toBeHidden();
});

test('article body web links open a new tab while the article stays open', async ({ page, context }) => {
  await page.goto('/posts/Infra-GEMM优化/');
  const link = page.locator('article[data-post] .prose a[href^="https://"]').first();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
  await expect(link).toHaveAttribute('rel', /\bnoreferrer\b/);
  const articleUrl = page.url();
  const [newTab] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await expect(page).toHaveURL(articleUrl);
  await expect.poll(() => newTab.url()).toContain('zhuanlan.zhihu.com');
  await newTab.close();
});

test('article links inserted after protected content loads keep fragment jumps in the current tab', async ({ page }) => {
  await page.goto('/posts/Infra-GEMM优化/');
  await page.locator('article[data-post] .prose').evaluate((prose) => {
    const internal = document.createElement('a');
    internal.href = '/about/';
    internal.dataset.testInternalLink = '';
    const fragment = document.createElement('a');
    fragment.href = '#gemm';
    fragment.dataset.testFragmentLink = '';
    prose.append(internal, fragment);
    document.dispatchEvent(new Event('hatrix:protected-content-ready'));
  });
  await expect(page.locator('[data-test-internal-link]')).toHaveAttribute('target', '_blank');
  await expect(page.locator('[data-test-internal-link]')).toHaveAttribute('rel', /\bnoopener\b/);
  await expect(page.locator('[data-test-fragment-link]')).not.toHaveAttribute('target', '_blank');
});

test('music player persists across about navigation without recreating its audio instance', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const trackedWindow = window as Window & { __audioSources?: string[] };
    Object.defineProperty(trackedWindow, '__audioSources', { value: [] });
    window.Audio = new Proxy(NativeAudio, {
      construct(target, args) {
        trackedWindow.__audioSources?.push(String(args[0] ?? ''));
        return Reflect.construct(target, args);
      }
    });
  });

  await page.goto('/about/');
  const player = page.locator('[data-music-player]');
  await expect(player).toHaveAttribute('data-ui-state', 'collapsed');
  await player.locator('[data-player-toggle]').click();
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
  await expect(player.locator('[data-player-track]')).toHaveText(`${playlist[0].title}-${playlist[0].artist}`);
  await expect(player.locator('[data-player-record]')).toBeEnabled();
  await expect(player).toHaveAttribute('data-playback-state', 'paused');

  await player.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));
  await page.locator('.desktop-nav').getByRole('link', { name: '随笔', exact: true }).click();
  await expect(page).toHaveURL(/\/snippets\/$/);
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-persist-probe', 'same-node');
  const audioSources = await page.evaluate(
    () => (window as Window & { __audioSources?: string[] }).__audioSources ?? []
  );
  expect(audioSources.filter((source) => source === '')).toHaveLength(1);
});
