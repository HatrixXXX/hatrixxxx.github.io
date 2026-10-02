import { expect, test } from '@playwright/test';

const firstQuote = '轻松即单纯，速成即精准';
const secondQuote = '兽人永不为奴，除非包吃包住';

test('Hatrix is a flat transparent label beside the level ring', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const name = page.locator('[data-home-panel="identity-name"]');
  expect.soft(await name.evaluate((node) => getComputedStyle(node).transform)).toBe('none');
  const surface = await name.locator('.identity-name').evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      background: style.backgroundColor,
      borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
      shadow: style.boxShadow
    };
  });
  expect.soft(surface.background).toBe('rgba(0, 0, 0, 0)');
  expect.soft(surface.borders).toEqual(['0px', '0px', '0px', '0px']);
  expect.soft(surface.shadow).toBe('none');
  const ringBox = await page.locator('[data-home-panel="identity"]').boundingBox();
  const nameBox = await name.boundingBox();
  expect(ringBox).not.toBeNull();
  expect(nameBox).not.toBeNull();
  expect.soft(Math.abs(ringBox!.y - 355)).toBeLessThan(0.5);
  expect.soft(Math.abs(nameBox!.y - 389)).toBeLessThan(0.5);
  expect.soft(Math.abs(ringBox!.y + ringBox!.height / 2 - nameBox!.y - nameBox!.height / 2)).toBeLessThan(0.5);
  expect(nameBox!.x - ringBox!.x - ringBox!.width).toBeGreaterThanOrEqual(12);
});

test('quote shares the player plane and aligns with the lower row outer edges', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const geometry = await page.evaluate(() => {
    const panel = (name: string) => document.querySelector<HTMLElement>(`[data-home-panel="${name}"]`)!;
    const corners = (element: HTMLElement, matrix = new DOMMatrix(getComputedStyle(element).transform), rect = { x: 0, y: 0, width: element.offsetWidth, height: element.offsetHeight }) =>
      [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]].map(([x, y]) => {
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        return { x: point.x / point.w, y: point.y / point.w };
      });
    const music = panel('music');
    const quote = corners(panel('quote'));
    const musicMatrix = new DOMMatrix(getComputedStyle(music).transform);
    const expected = corners(music, musicMatrix, { x: 0, y: -122, width: 625, height: 110 });
    const quoteBottomInPlayerPlane = new DOMPoint(quote[3].x, quote[3].y).matrixTransform(musicMatrix.inverse());
    const quoteBox = panel('quote').getBoundingClientRect();
    const musicBox = music.getBoundingClientRect();
    const friendsBox = panel('friends').getBoundingClientRect();
    const yAt = (a: { x: number; y: number }, b: { x: number; y: number }, x: number) => a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    const rowGaps = [corners(music), corners(panel('friends'))].flatMap((row) => {
      const left = Math.max(quote[3].x, row[0].x);
      const right = Math.min(quote[2].x, row[1].x);
      return [left, right].map((x) => yAt(row[0], row[1], x) - yAt(quote[3], quote[2], x));
    });
    return {
      planeErrors: quote.map((point, index) => Math.hypot(point.x - expected[index].x, point.y - expected[index].y)),
      leftError: Math.abs(quoteBox.left - musicBox.left),
      rightError: Math.abs(quoteBox.right - friendsBox.right),
      localPlayerGap: -quoteBottomInPlayerPlane.y / quoteBottomInPlayerPlane.w,
      minimumRowGap: Math.min(...rowGaps)
    };
  });
  for (const error of geometry.planeErrors) expect.soft(error).toBeLessThan(0.05);
  expect.soft(geometry.leftError).toBeLessThanOrEqual(2);
  expect.soft(geometry.rightError).toBeLessThanOrEqual(2);
  expect.soft(geometry.localPlayerGap).toBeCloseTo(12, 3);
  expect(geometry.minimumRowGap).toBeGreaterThan(0);
});

test('quote clears the friends panel across its entire projected bottom edge', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const gap = await page.evaluate(() => {
    const corners = (name: string) => {
      const panel = document.querySelector<HTMLElement>(`[data-home-panel="${name}"]`)!;
      const matrix = new DOMMatrix(getComputedStyle(panel).transform);
      return [[0, 0], [panel.offsetWidth, 0], [panel.offsetWidth, panel.offsetHeight], [0, panel.offsetHeight]].map(([x, y]) => {
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        return { x: point.x / point.w, y: point.y / point.w };
      });
    };
    const quote = corners('quote');
    const friends = corners('friends');
    const yAt = (a: { x: number; y: number }, b: { x: number; y: number }, x: number) => a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
    return Math.min(...[friends[0].x, quote[2].x].map((x) => yAt(friends[0], friends[1], x) - yAt(quote[3], quote[2], x)));
  });
  expect(gap).toBeGreaterThan(0);
  expect(await page.locator('[data-quote-text]').evaluate((node) => node.scrollHeight <= node.parentElement!.clientHeight)).toBe(true);
});

test('home presents the spatial panels and a permanent music player', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-home-stage]')).toBeVisible();
  await expect(page.locator('[data-home-title]')).toHaveText('Hatrix');
  await expect(page.locator('[data-home-title]')).toBeVisible();
  await expect(page.locator('[data-home-panel="identity-name"]')).toBeVisible();
  await expect(page.locator('[data-home-panel="quote"]')).toBeVisible();
  await expect(page.locator('[data-home-stage] h1')).toHaveCount(1);
  expect((await page.locator('[data-home-title]').boundingBox())?.width).toBeGreaterThan(100);
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
  await expect(page.getByRole('heading', { level: 1, name: '博客文章' })).toBeVisible();
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
  await expect(quote).toBeFocused();
  await page.keyboard.press('Space');
  await expect(text).toHaveText(secondQuote);
  await expect(quote).toBeFocused();
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
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await page.clock.runFor(14_999);
  await expect(text).toHaveText(firstQuote);
  await page.clock.runFor(101);
  await expect(text).toHaveText(secondQuote);
});

test('home reduced motion changes quotes without animated scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  const quote = page.locator('[data-home-quote]');
  await expect(page.locator('[data-quote-pause]')).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.locator('article[data-post-card]')).toHaveCount(6);
  await page.goto('/page/8/');
  await expect(page.locator('article[data-post-card]')).toHaveCount(1);
  await page.goto('/blog/');
  const spacedSlugLink = page.locator('a[href="/posts/FPGA开发(1)Vivado+Vitis 使用/"]').first();
  await expect(spacedSlugLink).toHaveCount(1);
  const resolvedPath = await spacedSlugLink.evaluate((link) => new URL((link as HTMLAnchorElement).href).pathname);
  expect(resolvedPath).toBe(encodeURI('/posts/FPGA开发(1)Vivado+Vitis 使用/'));
  expect((await page.request.get(resolvedPath)).status()).toBe(200);
});

test('ordinary paginated pages omit the site footer', async ({ page }) => {
  await page.goto('/page/2/');
  const footer = page.locator('footer[data-site-footer]');
  await expect(footer).toHaveCount(0);
});

test('normal-motion return visits keep one automatic quote timer and one listener', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => {
    const timers = new Set<number>();
    const probe = { timers, animations: 0 };
    Object.defineProperty(window, '__quoteProbe', { value: probe });
    const schedule = window.setTimeout.bind(window);
    const cancel = window.clearTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay !== 15_000 || typeof handler !== 'function') return schedule(handler, delay, ...args);
      const id = schedule(() => { timers.delete(id); handler(...args); }, delay);
      timers.add(id);
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = (id) => { if (typeof id === 'number') timers.delete(id); cancel(id); };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this.matches('[data-quote-text]')) probe.animations += 1;
      return animate.apply(this, args);
    };
  });
  const probe = () => page.evaluate(() => {
    const state = (window as unknown as { __quoteProbe: { timers: Set<number>; animations: number } }).__quoteProbe;
    return { timers: state.timers.size, animations: state.animations };
  });
  for (let visit = 0; visit < 2; visit += 1) {
    await page.locator('[data-home-stage]').getByRole('link', { name: '计划', exact: true }).click();
    await expect(page).toHaveURL('/plans/');
    expect((await probe()).timers).toBe(0);
    await page.locator('[data-back-button]').click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-quote-pause]')).toHaveAttribute('aria-pressed', 'false');
    expect((await probe()).timers).toBe(1);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
    const before = (await probe()).animations;
    await page.locator('[data-home-quote]').dispatchEvent('dblclick');
    await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
    expect(await probe()).toEqual({ timers: 1, animations: before + 1 });
    await page.clock.runFor(14_999);
    await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
    await page.clock.runFor(1);
    await expect(page.locator('[data-quote-text]')).toHaveText(firstQuote);
    expect(await probe()).toEqual({ timers: 1, animations: before + 2 });
    await page.clock.resume();
  }
});
