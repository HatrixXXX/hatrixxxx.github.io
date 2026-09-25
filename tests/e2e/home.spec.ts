import { expect, test } from '@playwright/test';
import { BLOG_SUBNAV_LINKS } from '../../src/config/navigation';

const firstQuote = '轻松即单纯，速成即精准';
const secondQuote = '兽人永不为奴，除非包吃包住';

test('home presents the spatial panels and a permanent music player', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-stage]')).toBeVisible();
  await expect(page.locator('[data-home-title]')).toHaveText('Hatrix');
  await expect(page.locator('[data-open-search]')).toHaveCount(1);
  await expect(page.locator('[data-music-player]')).toBeVisible();
  await expect(page.locator('[data-home-panel="recommendations"]')).toContainText('工具推荐');
  await expect(page.locator('[data-home-panel="recommendations"] a')).toHaveCount(3);
  await expect(page.locator('header[data-site-header], footer[data-site-footer]')).toHaveCount(0);
  await expect(page.locator('[data-sakana-layer], [data-cursor-trail], [data-sidebar-stack]')).toHaveCount(0);
  await expect(page.locator('article[data-post-card], .pagination')).toHaveCount(0);
});

test('right-side cards share one perspective plane with aligned rows', async ({ page }) => {
  await page.goto('/');
  const plane = page.locator('[data-home-plane="right"]');
  await expect(plane).toHaveCount(1);
  const geometry = await plane.evaluate((element) => {
    const panels = [...element.querySelectorAll<HTMLElement>('[data-home-panel]')];
    const box = (name: string) => panels.find((panel) => panel.dataset.homePanel === name)!;
    const projects = box('projects');
    const about = box('about');
    const plans = box('plans');
    const lab = box('lab');
    return {
      projected: getComputedStyle(element).transform.startsWith('matrix3d('),
      flatChildren: panels.every((panel) => getComputedStyle(panel).transform === 'none'),
      names: panels.map((panel) => panel.dataset.homePanel),
      middleAligned: projects.offsetTop === about.offsetTop && projects.offsetHeight === about.offsetHeight,
      bottomAligned: plans.offsetTop === lab.offsetTop && plans.offsetHeight === lab.offsetHeight,
      middleGap: about.offsetLeft - projects.offsetLeft - projects.offsetWidth,
      bottomGap: lab.offsetLeft - plans.offsetLeft - plans.offsetWidth
    };
  });
  expect(geometry.projected).toBe(true);
  expect(geometry.flatChildren).toBe(true);
  expect(geometry.names).toEqual(['clock', 'blog', 'projects', 'about', 'recommendations', 'plans', 'lab']);
  expect(geometry.middleAligned).toBe(true);
  expect(geometry.bottomAligned).toBe(true);
  for (const gap of [geometry.middleGap, geometry.bottomGap]) {
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThanOrEqual(16);
  }
});

test('home recommendations use a full-height bookmark and the bottom row is fully linked', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const group = page.locator('[data-home-panel="recommendations"] section');
  await expect(group).toHaveAccessibleName('工具推荐');
  const arrangement = await group.evaluate((section) => {
    const bookmark = section.querySelector<HTMLAnchorElement>('a[href="/about/bookmarks/"]')!;
    const software = section.querySelector<HTMLAnchorElement>('a[href="/about/tools/"]')!;
    const gear = section.querySelector<HTMLAnchorElement>('a[href="/about/gear/"]')!;
    const heading = section.querySelector<HTMLElement>('h2')!;
    return {
      fullHeight: bookmark.offsetHeight === section.clientHeight,
      headingToRight: heading.offsetLeft > bookmark.offsetLeft + bookmark.offsetWidth,
      softwareUnderHeading: software.offsetTop > heading.offsetTop + heading.offsetHeight,
      pairedBottomRow: software.offsetTop === gear.offsetTop && software.offsetHeight === gear.offsetHeight
    };
  });
  expect(arrangement).toEqual({ fullHeight: true, headingToRight: true, softwareUnderHeading: true, pairedBottomRow: true });
  const auxiliary = page.locator('[data-home-auxiliary-slot]');
  await expect(auxiliary).toHaveCount(0);
  for (const name of ['plans', 'lab']) {
    const link = page.locator(`[data-home-panel="${name}"] > a`);
    await expect(link).toHaveCount(1);
    expect(await link.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const parent = element.parentElement!.getBoundingClientRect();
      return Math.abs(box.width - parent.width) < 1 && Math.abs(box.height - parent.height) < 1;
    })).toBe(true);
  }
});

test('home keeps panel proportions and positions across effective viewport sizes', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const baseline = await page.locator('[data-home-panel]').evaluateAll((panels) =>
    panels.map((panel) => {
      const rect = panel.getBoundingClientRect();
      return { name: panel.getAttribute('data-home-panel'), side: panel.closest('[data-home-side]')?.getAttribute('data-home-side'), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })
  );
  expect(baseline.length).toBeGreaterThanOrEqual(13);

  // Browser zoom changes the effective CSS viewport; these include 125%, 150% and 200% equivalents.
  for (const viewport of [
    { width: 1536, height: 864 },
    { width: 1280, height: 720 },
    { width: 960, height: 540 },
    { width: 1440, height: 900 },
    { width: 3440, height: 1440 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 640 }
  ]) {
    await page.setViewportSize(viewport);
    const scale = Math.min(viewport.width / 1920, viewport.height / 1080);
    const offsetX = (viewport.width - 1920 * scale) / 2;
    const offsetY = (viewport.height - 1080 * scale) / 2;
    await expect.poll(async () => {
      const rect = await page.locator('[data-home-canvas]').boundingBox();
      return Math.abs((rect?.width ?? 0) - 1920 * scale);
    }).toBeLessThan(1);
    const panels = await page.locator('[data-home-panel]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { name: node.getAttribute('data-home-panel'), side: node.closest('[data-home-side]')?.getAttribute('data-home-side'), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })
    );
    expect(panels.map(({ name }) => name)).toEqual(baseline.map(({ name }) => name));
    for (let index = 0; index < panels.length; index += 1) {
      const panel = panels[index];
      const original = baseline[index];
      const label = `${panel.name} at ${viewport.width}x${viewport.height}`;
      const sideShift = panel.side === 'left' ? -offsetX : offsetX;
      expect(Math.abs((panel.x - offsetX - sideShift) / scale - original.x), `${label} x`).toBeLessThan(1);
      expect(Math.abs((panel.y - offsetY) / scale - original.y), `${label} y`).toBeLessThan(1);
      expect(Math.abs(panel.width / scale - original.width), `${label} width`).toBeLessThan(1);
      expect(Math.abs(panel.height / scale - original.height), `${label} height`).toBeLessThan(1);
      expect(panel.x, label).toBeGreaterThanOrEqual(-1);
      expect(panel.y, label).toBeGreaterThanOrEqual(-1);
      expect(panel.x + panel.width, label).toBeLessThanOrEqual(viewport.width + 1);
      expect(panel.y + panel.height, label).toBeLessThanOrEqual(viewport.height + 1);
    }
    const metrics = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight
    }));
    expect(metrics.width).toBe(metrics.clientWidth);
    expect(metrics.height).toBeLessThanOrEqual(metrics.clientHeight);
    await page.mouse.wheel(0, 800);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});

test('home blog panel navigates directly to the blog hub by keyboard', async ({ page }) => {
  await page.goto('/');
  const blog = page.locator('a[data-home-blog]');
  await expect(blog).toHaveAttribute('href', '/blog/');
  await expect(page.locator('[data-home-panel="blog"] details, [data-home-panel="blog"] nav')).toHaveCount(0);
  await blog.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/blog/');
  for (const item of BLOG_SUBNAV_LINKS) {
    const link = page.locator('[data-blog-category-nav]').getByRole('link', { name: item.label, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', item.href);
  }
  await page.locator('[data-blog-category-nav]').getByRole('link', { name: '技术笔记', exact: true }).click();
  await expect(page).toHaveURL('/blog/tech-notes/');
});

test('home search opens the shared search interface and restores focus', async ({ page }) => {
  await page.goto('/');
  const search = page.locator('[data-open-search]');
  await search.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(search).toBeFocused();
});

test('home quote scrolls on double click and supports keyboard switching', async ({ page }) => {
  await page.goto('/');
  const quote = page.locator('[data-home-quote]');
  const text = page.locator('[data-quote-text]');
  await expect(text).toHaveText(firstQuote);
  await quote.dblclick();
  await expect.poll(() => quote.evaluate((node) => node.getAnimations({ subtree: true }).some((animation) => animation.playState === 'running'))).toBe(true);
  await expect(text).toHaveText(secondQuote);
  await expect.poll(() => quote.evaluate((node) => node.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length)).toBe(0);
  await quote.focus();
  await page.keyboard.press('Enter');
  await expect(text).toHaveText(firstQuote);
});

test('home quote advances automatically after fifteen seconds', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const text = page.locator('[data-quote-text]');
  await expect(text).toHaveText(firstQuote);
  const pause = page.locator('[data-quote-pause]');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await page.clock.runFor(15_100);
  await expect(text).toHaveText(firstQuote);
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await page.clock.runFor(15_100);
  await expect(text).toHaveText(secondQuote);
});

test('home reduced motion changes quotes without animated scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  const quote = page.locator('[data-home-quote]');
  await page.clock.runFor(15_100);
  await expect(page.locator('[data-quote-text]')).toHaveText(firstQuote);
  await quote.dblclick();
  await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
  expect(await quote.evaluate((node) => node.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length)).toBe(0);
});

test('home clock exposes the complete local date and updates every second', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-05T13:44:15Z') });
  await page.goto('/');
  const clock = page.locator('time[data-home-clock]');
  await expect(clock).toHaveAttribute('aria-label', /^2026\/09\/05 \d{2}:44:15$/);
  await page.clock.runFor(1_000);
  await expect(clock).toHaveAttribute('aria-label', /^2026\/09\/05 \d{2}:44:16$/);
  await expect(clock).toHaveAttribute('datetime', /2026-09-05T/);
  const overflow = await clock.evaluate((element) => ({
    time: element.scrollWidth > element.clientWidth,
    card: element.parentElement!.scrollWidth > element.parentElement!.clientWidth,
    digits: [...element.querySelectorAll('[data-clock-digit]')].some((digit) => digit.scrollWidth > digit.clientWidth)
  }));
  expect(overflow).toEqual({ time: false, card: false, digits: false });
});

test('home links open their independent pages', async ({ page }) => {
  const entries = [
    ['作品橱窗', '/projects/'],
    ['关于我', '/about/'],
    ['书签', '/about/bookmarks/'],
    ['软件', '/about/tools/'],
    ['装备', '/about/gear/'],
    ['友链', '/about/friends/'],
    ['留言板', '/guestbook/'],
    ['计划', '/plans/'],
    ['实验场', '/lab/']
  ];
  for (const [label, path] of entries) {
    await page.goto('/');
    const link = page.locator('[data-home-stage]').getByRole('link', { name: label, exact: true });
    await expect(link).toHaveAttribute('href', path);
    await link.click();
    await expect(page).toHaveURL(path);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main')).not.toBeEmpty();
  }
});

test('returning home reinitializes quotes and the clock once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  await page.locator('[data-music-player]').evaluate((player) => player.setAttribute('data-home-persist-probe', 'same-node'));
  for (let visit = 0; visit < 2; visit += 1) {
    await page.locator('[data-home-stage]').getByRole('link', { name: '计划', exact: true }).click();
    await expect(page).toHaveURL('/plans/');
    await expect(page.locator('[data-music-player]')).toHaveCount(1);
    await expect(page.locator('[data-music-player]')).toHaveAttribute('data-home-persist-probe', 'same-node');
    await expect(page.locator('[data-music-player]')).toHaveAttribute('data-display-mode', 'dock');
    await page.locator('[data-back-button]').click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-home-canvas]')).toHaveCount(1);
    await expect(page.locator('[data-music-player]')).toHaveCount(1);
    await expect(page.locator('[data-music-player]')).toHaveAttribute('data-home-persist-probe', 'same-node');
    await expect(page.locator('[data-music-player]')).toHaveAttribute('data-display-mode', 'home');
    await expect(page.locator('[data-quote-text]')).toHaveText(firstQuote);
    await page.locator('[data-home-quote]').dblclick();
    await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
    const previousTime = await page.locator('[data-home-clock]').getAttribute('aria-label');
    await page.clock.runFor(1_100);
    await expect(page.locator('[data-home-clock]')).not.toHaveAttribute('aria-label', previousTime!);
  }
});

test('pagination and legacy post paths stay available', async ({ page }) => {
  expect((await page.request.get('/page/1/')).status()).toBe(404);
  expect((await page.request.get('/page/2/')).status()).toBe(200);
  await page.goto('/page/7/');
  await expect(page.locator('article[data-post-card]')).toHaveCount(4);
  await page.goto('/page/3/');
  const spacedSlugLink = page.locator('a[href="/posts/FPGA开发(1)Vivado+Vitis 使用/"]').first();
  await expect(spacedSlugLink).toBeVisible();
  const resolvedPath = await spacedSlugLink.evaluate((link) => new URL((link as HTMLAnchorElement).href).pathname);
  expect(resolvedPath).toBe(encodeURI('/posts/FPGA开发(1)Vivado+Vitis 使用/'));
});

test('site footer stays compact on paginated pages', async ({ page }) => {
  await page.goto('/page/2/');
  const footer = page.locator('footer[data-site-footer]');
  await expect(footer).toBeVisible();
  await expect(footer.locator('section, img, li')).toHaveCount(0);
  expect((await footer.boundingBox())?.height).toBeLessThan(64);
});
