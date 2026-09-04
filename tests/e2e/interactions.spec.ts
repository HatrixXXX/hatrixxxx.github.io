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

  await page.getByRole('link', { name: '博客文章', exact: true }).click();
  await expect(page.locator('[data-blog-total]')).toHaveText('40');
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

  await page.getByRole('link', { name: '博客文章', exact: true }).click();
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
  const cat = overlay.locator('.theme-transition__cat');
  await expect(overlay).toBeHidden();
  await expect(cat.locator('.theme-transition__ear')).toHaveCount(0);
  await expect(cat.locator('.theme-transition__whiskers')).toHaveCount(0);

  const dayCat = await cat.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      width: style.width,
      background: style.backgroundColor,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      clipPath: style.clipPath
    };
  });
  expect(dayCat).toMatchObject({
    width: '108px',
    background: 'rgb(119, 119, 119)',
    borderRadius: '0px',
    boxShadow: 'none'
  });
  expect(dayCat.clipPath).toContain('polygon');

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await cat.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.width, height: style.height };
    })
  ).toEqual({ width: '92px', height: '118px' });

  await page.setViewportSize({ width: 3840, height: 1907 });
  expect(parseFloat(await cat.evaluate((element) => getComputedStyle(element).width))).toBeCloseTo(
    204,
    0
  );
  await page.setViewportSize({ width: 1440, height: 900 });

  const dayEye = await cat.locator('.theme-transition__eye').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.width, background: style.backgroundColor };
  });
  const dayPupil = await cat.locator('.theme-transition__pupil').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.width, height: style.height, background: style.backgroundColor };
  });
  expect(dayEye).toEqual({ width: '32px', background: 'rgb(255, 238, 148)' });
  expect(dayPupil).toEqual({
    width: '4px',
    height: '30px',
    background: 'rgb(255, 179, 153)'
  });

  await toggle.click();
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('data-from-theme', 'light');
  await expect(overlay).toHaveAttribute('data-to-theme', 'dark');
  await expect(toggle).toBeDisabled();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const celestial = await overlay.locator('.theme-transition__orbit').evaluate((element) => {
    const animation = element.getAnimations()[0];
    const effect = animation?.effect;
    if (!(effect instanceof KeyframeEffect)) return null;
    animation.pause();
    animation.currentTime = 2_000;
    const activeBody = element.querySelector<HTMLElement>(
      element.closest('[data-to-theme="dark"]')
        ? '.theme-transition__moon'
        : '.theme-transition__sun'
    );
    if (!activeBody) return null;
    const finalPosition = activeBody.getBoundingClientRect();
    animation.currentTime = 2_900;
    const holdPosition = activeBody.getBoundingClientRect();
    return {
      duration: Number(effect.getTiming().duration),
      easing: getComputedStyle(element).animationTimingFunction,
      frames: effect.getKeyframes().map((frame) => ({
        offset: frame.offset,
        transform: String(frame.transform)
      })),
      finalPosition: { left: finalPosition.left, top: finalPosition.top },
      holdPosition: { left: holdPosition.left, top: holdPosition.top }
    };
  });
  expect(celestial).not.toBeNull();
  if (!celestial) throw new Error('celestial animation is missing');
  expect(celestial.duration).toBe(2_000);
  expect(celestial.easing).toBe('cubic-bezier(0.7, 0, 0, 1)');
  expect(celestial.frames.map(({ transform }) => transform)).toEqual(['rotate(0deg)', 'rotate(360deg)']);
  expect(celestial.finalPosition.left).toBeCloseTo(0.6 * 1_440);
  expect(celestial.finalPosition.top).toBeCloseTo(0.14 * 900);
  expect(celestial.holdPosition).toEqual(celestial.finalPosition);

  const nightPupilFrames = await cat.locator('.theme-transition__pupil').first().evaluate((element) => {
    const effect = element.getAnimations()[0]?.effect;
    if (!(effect instanceof KeyframeEffect)) return [];
    return effect.getKeyframes().map((frame) => ({
      width: String(frame.width),
      height: String(frame.height)
    }));
  });
  expect(nightPupilFrames.at(-1)).toEqual({ width: '27px', height: '27px' });
  await expect.poll(() => cat.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(68, 68, 68)'
  );

  await toggle.dispatchEvent('click');
  await expect(overlay).toHaveAttribute('data-to-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await expect(overlay).toBeHidden({ timeout: 4_000 });
  await expect(toggle).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('hatrix-theme'))).toBe('dark');
});

test('theme transition matches the reference lifecycle timing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.clock.install();
  await page.goto('/');
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);

  const overlay = page.locator('[data-theme-transition]');
  const toggle = page.getByRole('button', { name: '切换主题' });
  const sun = overlay.locator('.theme-transition__sun');
  const moon = overlay.locator('.theme-transition__moon');
  const celestialOpacity = async () => ({
    sun: await sun.evaluate((element) => getComputedStyle(element).opacity),
    moon: await moon.evaluate((element) => getComputedStyle(element).opacity)
  });
  expect({
    sun: await sun.evaluate((element) => getComputedStyle(element).width),
    moon: await moon.evaluate((element) => getComputedStyle(element).width)
  }).toEqual({ sun: '40px', moon: '24px' });
  await toggle.click();

  await page.clock.fastForward(409);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await celestialOpacity()).toEqual({ sun: '1', moon: '0' });
  await page.clock.fastForward(1);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await celestialOpacity()).toEqual({ sun: '0', moon: '1' });
  await page.clock.fastForward(2_499);
  await expect(overlay).not.toHaveClass(/is-leaving/);
  await page.clock.fastForward(1);
  await expect(overlay).toHaveClass(/is-leaving/);
  await page.clock.fastForward(199);
  await expect(overlay).toBeVisible();
  await page.clock.fastForward(1);
  await expect(overlay).toBeHidden();
  await expect(toggle).toBeEnabled();

  await toggle.click();
  await page.clock.fastForward(409);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await celestialOpacity()).toEqual({ sun: '0', moon: '1' });
  await page.clock.fastForward(1);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await celestialOpacity()).toEqual({ sun: '1', moon: '0' });
  await page.clock.fastForward(2_499);
  await expect(overlay).not.toHaveClass(/is-leaving/);
  await page.clock.fastForward(1);
  await expect(overlay).toHaveClass(/is-leaving/);
  await page.clock.fastForward(199);
  await expect(overlay).toBeVisible();
  await page.clock.fastForward(1);
  await expect(overlay).toBeHidden();
  await expect(toggle).toBeEnabled();
});

test('pending destination survives immediate client navigation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hatrix-theme', 'light'));
  await page.goto('/');

  await page.getByRole('button', { name: '切换主题' }).click();
  expect(await page.evaluate(() => localStorage.getItem('hatrix-theme'))).toBe('dark');

  await page.getByRole('link', { name: '博客文章', exact: true }).dispatchEvent('click');
  await expect(page).toHaveURL(/\/blog\/$/);
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

test('empty music player persists without constructing track audio or requesting media', async ({ page }) => {
  const mediaRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'media') mediaRequests.push(request.url());
  });
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

  await page.goto('/posts/本科数学大杂烩/');
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

  await player.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));
  await page.locator('[data-adjacent-posts] a').first().click();
  await expect(page.locator('article[data-post]')).toBeVisible();
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-persist-probe', 'same-node');
  const audioSources = await page.evaluate(
    () => (window as Window & { __audioSources?: string[] }).__audioSources ?? []
  );
  expect(audioSources).toHaveLength(2);
  expect(audioSources.every((source) => source.startsWith('data:audio/x-m4a;base64,'))).toBe(true);
  expect(mediaRequests).toEqual([]);
});
