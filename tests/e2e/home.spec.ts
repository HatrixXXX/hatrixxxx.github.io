import { expect, test } from '@playwright/test';

test('home renders only the fullscreen cover experience', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-stage]')).toBeVisible();
  await expect(page.locator('[data-home-title]')).toHaveText('Hatrixの窝');
  await expect(page.locator('.home-subtitle')).toHaveAttribute(
    'aria-label',
    '轻松即单纯，速成即精准'
  );
  await expect(page.locator('[data-home-typing]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[data-home-typing-cursor]')).toHaveText('|');
  await expect(page.locator('header[data-site-header] [data-home-blog-link]')).toHaveCount(2);
  const blogArrow = page.locator(
    '[data-home-stage] [data-home-blog-arrow][data-home-blog-link]'
  );
  await expect(blogArrow).toHaveCount(1);
  await expect(blogArrow).toHaveAttribute('href', '/blog/');
  await expect(page.locator('.brand, .home-blog-entry, footer[data-site-footer]')).toHaveCount(0);
  await expect(page.locator('[data-sakana-layer], [data-cursor-trail]')).toHaveCount(0);
  await expect(page.locator('article[data-post-card], .pagination')).toHaveCount(0);
  await expect(page.locator('a[href^="/categories/"], a[href^="/tags/"]')).toHaveCount(0);
  const background = await page.locator('[data-home-stage]').evaluate(
    (node) => getComputedStyle(node).backgroundImage
  );
  expect(background).toContain('/images/cover.png');
  const fontFamily = await page.locator('[data-home-stage]').evaluate(
    (node) => getComputedStyle(node).fontFamily
  );
  expect(fontFamily).toMatch(/^['"]?IBM Plex Mono['"]?/);
  expect((await page.request.get('/images/cover.png')).status()).toBe(200);
});

test('home types the tagline with a bar cursor', async ({ page }) => {
  await page.goto('/');
  const typing = page.locator('[data-home-typing]');
  await expect(typing).toHaveAttribute('data-home-typing-state', 'typing');
  await expect.poll(() => typing.textContent()).toContain('轻');
  await expect(typing).toHaveAttribute('data-home-typing-state', 'complete');
});

test('home arrow prefetches and reveals the blog', async ({ page }) => {
  const blogRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/blog/') blogRequests.push(request.url());
  });
  await page.goto('/');
  await expect.poll(() => blogRequests.length).toBeGreaterThan(0);
  await page.locator('[data-home-blog-arrow]').click({ noWaitAfter: true });
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .some(
            (animation) =>
              animation instanceof CSSAnimation && animation.animationName === 'home-uncover-left'
          )
      )
    )
    .toBe(true);
  await page.waitForURL('**/blog/');
});

test('home drag snaps back below threshold and navigates above it', async ({ page }) => {
  await page.goto('/');
  const stage = page.locator('[data-home-stage]');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Missing home stage bounds');
  await page.mouse.move(box.width * 0.75, box.height * 0.55);
  await page.mouse.down();
  for (let step = 1; step <= 4; step += 1) {
    const progress = step / 4;
    await page.mouse.move(box.width * (0.75 - 0.07 * progress), box.height * 0.55);
    await page.waitForTimeout(45);
  }
  await page.mouse.up();
  await expect(stage).toHaveAttribute('data-home-drag-state', 'idle');
  await expect(page).toHaveURL('/');
  await page.mouse.move(box.width * 0.75, box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.width * 0.5, box.height * 0.55, { steps: 8 });
  await page.mouse.up();
  await page.waitForURL('**/blog/');
});

test('home controls do not start the drag gesture', async ({ page }) => {
  await page.goto('/');
  const theme = page.locator('[data-theme-toggle]');
  const box = await theme.boundingBox();
  if (!box) throw new Error('Missing theme control bounds');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 180, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-home-stage]')).toHaveAttribute('data-home-drag-state', 'idle');
});

test('home respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('[data-home-typing]')).toHaveText('轻松即单纯，速成即精准');
  const animations = await page.locator('[data-home-blog-arrow]').evaluate((node) => ({
    arrow: getComputedStyle(node.querySelector('svg')!).animationName,
    cursor: getComputedStyle(document.querySelector('[data-home-typing-cursor]')!).animationName
  }));
  expect(animations).toEqual({ arrow: 'none', cursor: 'none' });
});

test('pagination and legacy post paths stay available', async ({ page }) => {
  const missingFirstPage = await page.request.get('/page/1/');
  expect(missingFirstPage.status()).toBe(404);
  expect((await page.request.get('/page/2/')).status()).toBe(200);

  await page.goto('/page/7/');
  await expect(page.locator('article[data-post-card]')).toHaveCount(4);

  await page.goto('/page/3/');
  const spacedSlugLink = page.locator('a[href="/posts/FPGA开发(1)Vivado+Vitis 使用/"]').first();
  await expect(spacedSlugLink).toBeVisible();
  const resolvedPath = await spacedSlugLink.evaluate(
    (link) => new URL((link as HTMLAnchorElement).href).pathname
  );
  expect(resolvedPath).toBe(encodeURI('/posts/FPGA开发(1)Vivado+Vitis 使用/'));
});

test('site footer stays compact on paginated pages', async ({ page }) => {
  await page.goto('/page/2/');
  const footer = page.locator('footer[data-site-footer]');
  await expect(footer).toBeVisible();
  await expect(footer.locator('section, img, li')).toHaveCount(0);
  const bounds = await footer.boundingBox();
  expect(bounds?.height).toBeLessThan(64);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1152, height: 720 },
  { width: 960, height: 600 },
  { width: 720, height: 450 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 640 }
]) {
  test(`home cannot scroll at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight
    }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
    await page.evaluate(() => window.scrollTo(0, 9999));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}

test('home and paginated routes omit contextual sidebar cards', async ({ page }) => {
  for (const path of ['/', '/page/2/']) {
    await page.goto(path);
    await expect(page.locator('[data-sidebar-stack], [data-music-player]')).toHaveCount(0);
  }
});
