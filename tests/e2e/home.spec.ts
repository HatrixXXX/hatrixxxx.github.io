import { expect, test, type Page } from '@playwright/test';
import { HOME_QUOTES, HOME_QUOTE_INTERVAL } from '../../src/data/home-quotes';

const firstQuote = '轻松即单纯，速成即精准。';
const secondQuote = '兽人永不为奴，除非包吃包住。';
const thirdQuote = '纵有疾风起，人生不言弃。';
const firstQuoteSource = '— Hatrix';
const secondQuoteSource = '— 网络';
const lastQuote = HOME_QUOTES.at(-1)!;

async function installQuoteProbe(page: Page, randomValue = 0) {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
  await page.addInitScript(({ fixedRandom, quoteInterval }) => {
    Math.random = () => fixedRandom;
    const timers = new Set<number>();
    const motionListeners = new Set<EventListenerOrEventListenerObject>();
    const probe = { timers, motionListeners, animations: 0 };
    Object.defineProperty(window, '__quoteProbe', { value: probe });
    const schedule = window.setTimeout.bind(window);
    const cancel = window.clearTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay !== quoteInterval || typeof handler !== 'function') return schedule(handler, delay, ...args);
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
    const listen = MediaQueryList.prototype.addEventListener;
    MediaQueryList.prototype.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
      if (this.media === '(prefers-reduced-motion: reduce)' && type === 'change' && listener) {
        motionListeners.add(listener);
        if (typeof options === 'object') options.signal?.addEventListener('abort', () => motionListeners.delete(listener), { once: true });
      }
      listen.call(this, type, listener, options);
    };
  }, { fixedRandom: randomValue, quoteInterval: HOME_QUOTE_INTERVAL });
}

async function quoteProbe(page: Page) {
  return page.evaluate(() => {
    const state = (window as unknown as { __quoteProbe: { timers: Set<number>; motionListeners: Set<unknown>; animations: number } }).__quoteProbe;
    return { timers: state.timers.size, motionListeners: state.motionListeners.size, animations: state.animations };
  });
}

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

test('lower stack keeps its shared plane with a second experiment entrance below the guestbook', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const geometry = await page.evaluate(() => {
    const panel = (name: string) => document.querySelector<HTMLElement>(`[data-home-panel="${name}"]`)!;
    const corners = (element: HTMLElement, matrix = new DOMMatrix(getComputedStyle(element).transform), rect = { x: 0, y: 0, width: element.offsetWidth, height: element.offsetHeight }) =>
      [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]].map(([x, y]) => {
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        return { x: point.x / point.w, y: point.y / point.w };
      });
    const friends = panel('friends');
    const inverse = new DOMMatrix(getComputedStyle(friends).transform).inverse();
    const projected = Object.fromEntries(['quote', 'music', 'friends', 'guestbook', 'lab-shortcut'].map((name) => [name, corners(panel(name))]));
    const local = Object.fromEntries(Object.entries(projected).map(([name, points]) => [name, points.map(({ x, y }) => {
      const point = new DOMPoint(x, y).matrixTransform(inverse);
      return { x: point.x / point.w, y: point.y / point.w };
    })]));
    const ringBox = panel('identity').getBoundingClientRect();
    const nameBox = panel('identity-name').getBoundingClientRect();
    return {
      projected, local,
      musicPanelHeight: panel('music').offsetHeight,
      musicCssHeight: getComputedStyle(document.querySelector<HTMLElement>('[data-music-player]')!).height,
      ring: { x: ringBox.x, y: ringBox.y, width: ringBox.width, height: ringBox.height },
      name: { x: nameBox.x, y: nameBox.y, width: nameBox.width, height: nameBox.height }
    };
  });
  const expectedCorners = {
    quote: [[8.88462, 652.61538], [606, 618], [606, 688], [8.88462, 722.61538]],
    music: [[8.88462, 730.61538], [383.07692, 708.92308], [383.07692, 997.92308], [8.88462, 1019.61538]],
    friends: [[391.03846, 708.46154], [606, 696], [606, 787], [391.03846, 799.46154]],
    guestbook: [[391.03846, 807.46154], [606, 795], [606, 886], [391.03846, 898.46154]],
    'lab-shortcut': [[391.03846, 906.46154], [606, 894], [606, 985], [391.03846, 997.46154]]
  };
  for (const [name, expected] of Object.entries(expectedCorners)) {
    geometry.projected[name].forEach((point, index) => {
      expect.soft(Math.abs(point.x - expected[index][0]), `${name} corner ${index} x`).toBeLessThan(0.05);
      expect.soft(Math.abs(point.y - expected[index][1]), `${name} corner ${index} y`).toBeLessThan(0.05);
    });
  }
  const { quote, music, friends, guestbook, 'lab-shortcut': labShortcut } = geometry.local;
  for (const projected of Object.values(geometry.projected)) {
    expect.soft(projected[0].x).toBeCloseTo(projected[3].x, 2);
    expect.soft(projected[1].x).toBeCloseTo(projected[2].x, 2);
    expect.soft(projected[1].x - projected[0].x).toBeCloseTo(projected[2].x - projected[3].x, 2);
    expect.soft(projected[1].y - projected[0].y).toBeCloseTo(projected[2].y - projected[3].y, 2);
  }
  // Computed matrix3d values are serialized to limited precision by Chromium.
  for (const edge of [0, 1]) {
    expect.soft(music[edge].y - quote[edge + 2].y).toBeCloseTo(8, 2);
    expect.soft(friends[edge].y - quote[edge + 2].y).toBeCloseTo(8, 2);
    expect.soft(guestbook[edge].y - friends[edge + 2].y).toBeCloseTo(8, 2);
    expect.soft(labShortcut[edge].y - guestbook[edge + 2].y).toBeCloseTo(8, 2);
  }
  for (const bottom of [2, 3]) {
    expect.soft(music[bottom].y).toBeCloseTo(289, 2);
    expect.soft(guestbook[bottom].y).toBeCloseTo(190, 2);
    expect.soft(labShortcut[bottom].y).toBeCloseTo(289, 2);
  }
  for (const card of [friends, guestbook, labShortcut]) {
    expect.soft(card[1].x - card[0].x).toBeCloseTo(216, 2);
    expect.soft(card[3].y - card[0].y).toBeCloseTo(91, 2);
  }
  expect.soft(friends[0].x - music[1].x).toBeCloseTo(8, 2);
  for (const points of [quote, [...music, ...friends, ...guestbook, ...labShortcut]]) {
    expect.soft(Math.min(...points.map(({ x }) => x))).toBeCloseTo(-384, 2);
    expect.soft(Math.max(...points.map(({ x }) => x))).toBeCloseTo(216, 2);
  }
  expect.soft(geometry.musicPanelHeight).toBe(289);
  expect.soft(geometry.musicCssHeight).toBe('289px');
  expect.soft(geometry.ring).toEqual({ x: 72, y: 355, width: 180, height: 180 });
  expect.soft(geometry.name).toEqual({ x: 264, y: 389, width: 300, height: 112 });
  await expect(page.locator('[data-home-panel="lab-shortcut"] a')).toHaveAttribute('href', '/playground/');
  await expect(page.locator('[data-home-panel="digest"] a')).toHaveAttribute('href', '/digest/');
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
  await expect(page.locator('[data-home-panel="recommendations"]')).toContainText('效率提升');
  await expect(page.locator('[data-home-panel="recommendations"] a')).toHaveCount(3);
  await expect(page.locator('header[data-site-header], footer[data-site-footer]')).toHaveCount(0);
  await expect(page.locator('[data-sakana-layer], [data-sidebar-stack]')).toHaveCount(0);
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
    const digest = box('digest');
    return {
      projected: getComputedStyle(element).transform.startsWith('matrix3d('),
      flatChildren: panels.every((panel) => getComputedStyle(panel).transform === 'none'),
      names: panels.map((panel) => panel.dataset.homePanel),
      middleAligned: projects.offsetTop === about.offsetTop && projects.offsetHeight === about.offsetHeight,
      bottomAligned: plans.offsetTop === digest.offsetTop && plans.offsetHeight === digest.offsetHeight,
      middleGap: about.offsetLeft - projects.offsetLeft - projects.offsetWidth,
      bottomGap: digest.offsetLeft - plans.offsetLeft - plans.offsetWidth
    };
  });
  expect(geometry.projected).toBe(true);
  expect(geometry.flatChildren).toBe(true);
  expect(geometry.names).toEqual(['clock', 'blog', 'projects', 'about', 'recommendations', 'plans', 'digest']);
  expect(geometry.middleAligned).toBe(true);
  expect(geometry.bottomAligned).toBe(true);
  for (const gap of [geometry.middleGap, geometry.bottomGap]) {
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThanOrEqual(16);
  }
});

test('home recommendations use a full-height snippets card and the bottom row is fully linked', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const group = page.locator('[data-home-panel="recommendations"] section');
  await expect(group).toHaveAccessibleName('效率提升');
  const arrangement = await group.evaluate((section) => {
    const snippets = section.querySelector<HTMLAnchorElement>('a[href="/snippets/"]')!;
    const bookmark = section.querySelector<HTMLAnchorElement>('a[href="/favorites/"]')!;
    const software = section.querySelector<HTMLAnchorElement>('a[href="/toolbox/"]')!;
    const heading = section.querySelector<HTMLElement>('h2')!;
    return {
      fullHeight: snippets.offsetHeight === section.clientHeight,
      headingToRight: heading.offsetLeft > snippets.offsetLeft + snippets.offsetWidth,
      bookmarkUnderHeading: bookmark.offsetTop > heading.offsetTop + heading.offsetHeight,
      pairedBottomRow: bookmark.offsetTop === software.offsetTop && bookmark.offsetHeight === software.offsetHeight
    };
  });
  expect(arrangement).toEqual({ fullHeight: true, headingToRight: true, bookmarkUnderHeading: true, pairedBottomRow: true });
  const auxiliary = page.locator('[data-home-auxiliary-slot]');
  await expect(auxiliary).toHaveCount(0);
  for (const name of ['plans', 'digest']) {
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
  await expect(blog).toHaveAttribute('href', '/blogs/');
  await expect(page.locator('[data-home-panel="blog"] details, [data-home-panel="blog"] nav')).toHaveCount(0);
  await blog.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/blogs/');
  await expect(page).toHaveTitle(/^博客文章 \|/);
  await expect(page.locator('[data-hero]')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
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

test('home identity links and quote button are keyboard accessible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installQuoteProbe(page);
  await page.goto('/');
  await expect(page.locator('.level-badge')).toHaveAttribute('type', 'button');
  await expect(page.locator('.identity-trigger')).toHaveAttribute('type', 'button');
  await expect(page.locator('[data-home-level]')).toHaveAttribute('role', 'meter');
  const quote = page.locator('[data-home-quote]');
  const text = page.locator('[data-quote-text]');
  await expect(text).toHaveText(firstQuote);
  await expect(quote).toHaveAttribute('data-quote-cursor', 'source');
  expect(await page.locator('[data-quote-source]').evaluate((node) => getComputedStyle(node, '::after').backgroundColor)).toBe('rgb(138, 218, 241)');
  await expect(quote).toHaveAttribute('aria-describedby', 'quote-announcement');
  await expect(page.locator('[data-quote-announcement]')).toHaveAttribute('aria-live', 'polite');
  await quote.focus();
  await expect(quote).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(text).toHaveText(firstQuote);
  await page.keyboard.press('Enter');
  await expect(text).toHaveText(secondQuote);
  await expect(page.locator('[data-quote-announcement]')).toContainText(secondQuote);
});

test('pointer double-click advances the quote once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installQuoteProbe(page);
  await page.goto('/');
  const quote = page.locator('[data-home-quote]');
  await quote.dblclick();
  await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
  await expect(page.locator('[data-quote-source]')).toHaveText(secondQuoteSource);
});

test('a new click or hold resets the ring push while it is already spinning', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const ring = page.locator('[data-level-impulse]');
  const rates = () => page.evaluate(() => [
    document.querySelector('.level-tick-wheel')!.getAnimations()[0]?.playbackRate,
    document.querySelector('.level-armor-wheel')!.getAnimations()[0]?.playbackRate,
  ]);
  await expect(ring).toBeEnabled();
  expect(await rates()).toEqual([1, 1]);
  expect(await page.locator('.level-tick-wheel').evaluate((wheel) => getComputedStyle(wheel).animationDirection)).toBe('normal');
  expect(await page.locator('.level-armor-wheel').evaluate((wheel) => getComputedStyle(wheel).animationDirection)).toBe('reverse');
  await ring.click();
  await expect(page).toHaveURL('/');
  await expect.poll(async () => {
    const current = await rates();
    return current[0]! > 15 && current[0]! < 50 && current[1]! > 25 && current[1]! < 80;
  }, { intervals: [25, 50, 100], timeout: 800 }).toBe(true);
  await page.waitForTimeout(350);
  const slowing = await rates();
  await ring.click();
  await expect.poll(async () => {
    const current = await rates();
    return current[0]! > slowing[0]! + 4 && current[0]! < 50;
  }, { intervals: [25, 50, 100], timeout: 800 }).toBe(true);
  await ring.hover();
  await page.mouse.down();
  await expect(ring).toHaveAttribute('data-charging', '');
  expect(await ring.evaluate((node) => getComputedStyle(node).filter)).not.toContain('255, 210, 0');
  await page.waitForTimeout(550);
  await page.mouse.up();
  await expect.poll(async () => (await rates())[0], { intervals: [25, 50, 100], timeout: 800 }).toBeGreaterThan(45);
  await expect.poll(rates, { timeout: 7_000 }).toEqual([1, 1]);
  await expect(ring).not.toHaveAttribute('data-impulsing', '');
});

test('holding the ring spreads a yellow glow and reaches flashing full charge at three seconds', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const ring = page.locator('[data-level-impulse]');
  await ring.hover();
  await page.mouse.down();
  await expect(ring).toHaveAttribute('data-charging', '');
  const initialGlow = await ring.evaluate((node) => {
    const style = getComputedStyle(node, '::before');
    return { opacity: Number(style.opacity), background: style.backgroundImage, border: style.borderTopWidth, transform: style.transform };
  });
  expect(initialGlow.background).toContain('radial-gradient');
  expect(initialGlow.background).toContain('255, 210, 0');
  expect(initialGlow.border).toBe('0px');
  expect(initialGlow.transform).toBe('none');
  await page.waitForTimeout(250);
  const earlyGlow = await ring.evaluate((node) => {
    const buttonStyle = getComputedStyle(node);
    return { charge: Number(buttonStyle.getPropertyValue('--charge')), spread: Number(buttonStyle.getPropertyValue('--charge-spread')), opacity: Number(getComputedStyle(node, '::before').opacity) };
  });
  expect(earlyGlow.spread / earlyGlow.charge).toBeGreaterThan(2.5);
  expect(earlyGlow.opacity).toBeGreaterThan(.22 + .78 * earlyGlow.charge + .08);
  await page.waitForTimeout(850);
  const strongerGlow = await ring.evaluate((node) => {
    const style = getComputedStyle(node, '::before');
    const buttonStyle = getComputedStyle(node);
    return { opacity: Number(style.opacity), background: style.backgroundImage, charge: Number(buttonStyle.getPropertyValue('--charge')), spread: Number(buttonStyle.getPropertyValue('--charge-spread')) };
  });
  expect(strongerGlow.opacity).toBeGreaterThan(initialGlow.opacity + 0.1);
  expect(strongerGlow.background).not.toBe(initialGlow.background);
  expect(strongerGlow.spread).toBe(1);
  expect(strongerGlow.charge).toBeLessThan(.65);
  await page.waitForTimeout(550);
  const beforeFull = await ring.evaluate((node) => ({ charge: Number(getComputedStyle(node).getPropertyValue('--charge')), spread: Number(getComputedStyle(node).getPropertyValue('--charge-spread')), full: node.hasAttribute('data-charge-full') }));
  expect(beforeFull.spread).toBe(1);
  expect(beforeFull.charge).toBeLessThan(1);
  expect(beforeFull.full).toBe(false);
  await page.evaluate(() => {
    const button = document.querySelector('[data-level-impulse]')!;
    const observer = new MutationObserver(() => {
      if (!button.hasAttribute('data-charge-full')) return;
      observer.disconnect();
      requestAnimationFrame(() => {
        document.documentElement.dataset.chargeFlashFirstOpacity = getComputedStyle(button, '::before').opacity;
      });
    });
    observer.observe(button, { attributes: true, attributeFilter: ['data-charge-full'] });
  });
  await page.waitForTimeout(1_550);
  await expect(ring).toHaveAttribute('data-charge-full', '');
  await expect(ring).toHaveCSS('--charge', '1');
  await expect(ring).toHaveCSS('--charge-spread', '1');
  await expect(ring).toHaveCSS('--charge-glow', '1');
  await expect.poll(() => page.locator('html').getAttribute('data-charge-flash-first-opacity')).toBeTruthy();
  expect(Number(await page.locator('html').getAttribute('data-charge-flash-first-opacity'))).toBeGreaterThan(0.92);
  expect(await ring.evaluate((node) => getComputedStyle(node, '::before').animationName)).toBe('level-charge-ready');
  expect(await ring.evaluate((node) => getComputedStyle(node, '::before').animationDuration)).toBe('0.26s');
  const pulseStart = await ring.evaluate((node) => {
    const style = getComputedStyle(node, '::before');
    return { opacity: Number(style.opacity), background: style.backgroundImage, filter: style.filter };
  });
  await expect.poll(async () => Math.abs(await ring.evaluate((node) => Number(getComputedStyle(node, '::before').opacity)) - pulseStart.opacity), { timeout: 800 }).toBeGreaterThan(0.08);
  expect(await ring.evaluate((node) => getComputedStyle(node, '::before').backgroundImage)).toBe(pulseStart.background);
  expect(await ring.evaluate((node) => getComputedStyle(node, '::before').filter)).toBe(pulseStart.filter);
  await page.mouse.up();
  await expect(ring).not.toHaveAttribute('data-charging', '');
  await expect.poll(() => page.locator('.level-tick-wheel').evaluate((wheel) => wheel.getAnimations()[0]?.playbackRate), { timeout: 800 }).toBeGreaterThan(100);
});

test('reduced motion supports keyboard charging without ring rotation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const ring = page.locator('[data-level-impulse]');
  await ring.focus();
  await page.keyboard.down('Space');
  await expect(ring).toHaveAttribute('data-charging', '');
  await page.waitForTimeout(3_100);
  await expect(ring).toHaveAttribute('data-charge-full', '');
  expect(await ring.evaluate((node) => getComputedStyle(node, '::before').animationName)).toBe('none');
  await page.keyboard.up('Space');
  await expect(ring).toHaveAttribute('data-impulsing', '');
  expect(await page.locator('.level-tick-wheel').evaluate((node) => node.getAnimations().length)).toBe(0);
  await expect(ring).not.toHaveAttribute('data-impulsing', '', { timeout: 1_000 });
});

test('level ring glow fades as its released spin slows', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const ring = page.locator('[data-level-impulse]');
  await ring.hover();
  await page.mouse.down();
  await page.waitForTimeout(1_000);
  const glow = () => ring.evaluate((node) => {
    const style = getComputedStyle(node, '::before');
    return { opacity: Number(style.opacity), background: style.backgroundImage };
  });
  const charged = await glow();
  await page.mouse.up();
  const released = await glow();
  expect(released.opacity).toBeGreaterThan(charged.opacity * 0.75);
  expect(released.background).toBe(charged.background);
  await page.mouse.move(700, 700);
  const ringLight = () => ring.evaluate((node) => Number(getComputedStyle(node).filter.match(/rgba\(255, 210, 0, ([\d.]+)\)/)?.[1] ?? 0));
  await page.waitForTimeout(220);
  const releasedRingLight = await ringLight();
  expect(releasedRingLight).toBeGreaterThan(0.4);
  await page.waitForTimeout(600);
  const slowing = await glow();
  expect(slowing.opacity).toBeLessThan(released.opacity);
  expect(slowing.opacity).toBeGreaterThan(0);
  expect(await ringLight()).toBeLessThan(releasedRingLight * 0.8);
  await page.waitForTimeout(2_500);
  expect(await ringLight()).toBeLessThan(0.1);
  await expect(ring).not.toHaveAttribute('data-impulsing', '', { timeout: 7_000 });
  expect((await glow()).opacity).toBe(0);
  expect(await ringLight()).toBe(0);
});

test('home quote has matching projected insets and aligns with the source bottom', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-quote-source]')).toHaveText(firstQuoteSource);
  const positions = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.quote-card')!;
    const panel = document.querySelector<HTMLElement>('[data-home-panel="quote"]')!;
    const text = document.querySelector<HTMLElement>('[data-quote-text]')!;
    const source = document.querySelector<HTMLElement>('[data-quote-source]')!;
    const textRange = document.createRange();
    textRange.setStart(text.firstChild!, text.firstChild!.textContent!.length - 1);
    textRange.setEnd(text.firstChild!, text.firstChild!.textContent!.length);
    const sourceRange = document.createRange();
    sourceRange.setStart(source.firstChild!, 0);
    sourceRange.setEnd(source.firstChild!, 1);
    const matrix = new DOMMatrixReadOnly(getComputedStyle(panel).transform);
    const alongTopEdge = Math.hypot(matrix.m11, matrix.m12);
    const alongSideEdge = Math.hypot(matrix.m21, matrix.m22);
    return {
      cardWidth: card.offsetWidth,
      textBottom: text.offsetTop + text.offsetHeight,
      sourceBottom: source.offsetTop + source.offsetHeight,
      textLeft: text.offsetLeft,
      textRight: text.offsetLeft + text.offsetWidth,
      sourceLeft: source.offsetLeft,
      sourceRight: source.offsetLeft + source.offsetWidth,
      glyphGap: sourceRange.getBoundingClientRect().left - textRange.getBoundingClientRect().right,
      visualLeft: (text.offsetLeft + card.clientLeft) * alongTopEdge,
      visualTop: (text.offsetTop + card.clientTop) * alongSideEdge,
      visualBottom: (card.offsetHeight - card.clientTop - text.offsetTop - text.offsetHeight) * alongSideEdge,
    };
  });
  expect(positions.sourceLeft - positions.textRight).toBeGreaterThanOrEqual(0);
  expect(positions.sourceLeft - positions.textRight).toBeLessThanOrEqual(12);
  expect(positions.glyphGap).toBeGreaterThanOrEqual(0);
  expect(positions.glyphGap).toBeLessThan(20);
  expect(positions.sourceRight).toBeLessThan(positions.cardWidth - 24);
  expect(Math.abs(positions.textBottom - positions.sourceBottom)).toBeLessThan(2);
  expect(Math.abs(positions.visualTop - positions.visualBottom)).toBeLessThan(2);
  expect(Math.abs(positions.visualTop - positions.visualLeft)).toBeLessThan(2);

  const longContent = await page.evaluate(() => {
    const textNode = document.querySelector<HTMLElement>('[data-quote-text]')!;
    const sourceNode = document.querySelector<HTMLElement>('[data-quote-source]')!;
    textNode.textContent = '即使金句变长，也要与出处保持清楚分隔，不发生重叠。';
    sourceNode.textContent = `— ${'很长的出处'.repeat(20)}`;
    const windowNode = document.querySelector<HTMLElement>('.quote-window')!;
    return {
      contentWidth: windowNode.clientWidth,
      textRight: textNode.offsetLeft + textNode.offsetWidth,
      sourceLeft: sourceNode.offsetLeft,
      sourceRight: sourceNode.offsetLeft + sourceNode.offsetWidth,
    };
  });
  expect(longContent.textRight).toBeLessThan(longContent.sourceLeft);
  expect(longContent.sourceLeft).toBeGreaterThanOrEqual(0);
  expect(longContent.sourceRight).toBeLessThanOrEqual(longContent.contentWidth);
});

test('long home quotes shrink with their sources to stay on one line', async ({ page }) => {
  const target = HOME_QUOTES.reduce((longest, quote) =>
    [...quote.text].length > [...longest.text].length ? quote : longest);
  const targetIndex = HOME_QUOTES.indexOf(target);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installQuoteProbe(page, (targetIndex - 1) / (HOME_QUOTES.length - 1));
  await page.goto('/');
  await expect.poll(async () => (await quoteProbe(page)).timers).toBe(1);
  await page.clock.runFor(HOME_QUOTE_INTERVAL);
  const text = page.locator('[data-quote-text]');
  await expect(text).toHaveText(target.text);
  const layout = await text.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
      scrollWidth: element.scrollWidth,
      whiteSpace: style.whiteSpace,
      sourceFontSize: Number.parseFloat(getComputedStyle(document.querySelector<HTMLElement>('[data-quote-source]')!).fontSize),
      cardHeight: document.querySelector<HTMLElement>('[data-home-panel="quote"]')!.offsetHeight,
      rowOverflow: document.querySelector<HTMLElement>('.quote-row')!.scrollWidth > document.querySelector<HTMLElement>('.quote-row')!.clientWidth,
    };
  });
  expect(layout.whiteSpace).toBe('nowrap');
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.clientHeight).toBeLessThanOrEqual(layout.lineHeight + 1);
  expect(layout.fontSize).toBeLessThan(17);
  expect(layout.sourceFontSize / layout.fontSize).toBeCloseTo(0.618, 2);
  expect(layout.cardHeight).toBe(70);
  expect(layout.rowOverflow).toBe(false);
});

test('home quote erases and types its source with a blinking bar caret', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installQuoteProbe(page);
  await page.goto('/');
  const text = page.locator('[data-quote-text]');
  const quote = page.locator('[data-home-quote]');
  await page.clock.runFor(1_500);
  await expect(text).toHaveText(firstQuote);
  await expect(page.locator('[data-quote-source]')).toHaveText(firstQuoteSource);
  await quote.dispatchEvent('dblclick');
  await expect(quote).toHaveAttribute('data-quote-phase', 'deleting');
  await expect(quote).toHaveAttribute('data-quote-cursor', 'source');
  expect(await page.locator('[data-quote-source]').evaluate((node) => getComputedStyle(node, '::after').animationName)).toBe('quote-caret-blink');
  await page.evaluate(() => {
    const source = document.querySelector('[data-quote-source]')!;
    const card = document.querySelector<HTMLElement>('[data-home-quote]')!;
    const history: string[] = [];
    const alignments: string[] = [];
    const starts: number[] = [];
    new MutationObserver(() => {
      if (card.dataset.quotePhase === 'typing' && card.dataset.quoteCursor === 'source') {
        history.push(source.textContent ?? '');
        alignments.push(getComputedStyle(source).textAlign);
        const first = source.firstChild;
        if (first?.nodeType === Node.TEXT_NODE && first.textContent) {
          const range = document.createRange();
          range.setStart(first, 0);
          range.setEnd(first, 1);
          starts.push(range.getBoundingClientRect().left);
        }
      }
    }).observe(source, { childList: true });
    Object.defineProperty(window, '__quoteSourceTypingHistory', { value: history });
    Object.defineProperty(window, '__quoteSourceTypingAlignments', { value: alignments });
    Object.defineProperty(window, '__quoteSourceTypingStarts', { value: starts });
  });
  await page.clock.runFor(100);
  expect((await page.locator('[data-quote-source]').textContent())!.length).toBeLessThan(firstQuoteSource.length);
  await expect(text).toHaveText(firstQuote);
  await page.clock.runFor(260);
  await expect(page.locator('[data-quote-source]')).toBeEmpty();
  await expect(quote).toHaveAttribute('data-quote-cursor', 'text');
  expect((await text.textContent())!.length).toBeLessThan(firstQuote.length);
  await expect(quote).toHaveAttribute('data-quote-phase', 'typing');
  await page.clock.runFor(2_000);
  const sourceHistory = await page.evaluate(() => (window as unknown as { __quoteSourceTypingHistory: string[] }).__quoteSourceTypingHistory);
  expect(sourceHistory.some((value) => value.length > 0 && value.length < secondQuoteSource.length)).toBe(true);
  const sourceAlignments = await page.evaluate(() => (window as unknown as { __quoteSourceTypingAlignments: string[] }).__quoteSourceTypingAlignments);
  expect(sourceAlignments.length).toBeGreaterThan(0);
  expect(new Set(sourceAlignments)).toEqual(new Set(['left']));
  const sourceStarts = await page.evaluate(() => (window as unknown as { __quoteSourceTypingStarts: number[] }).__quoteSourceTypingStarts);
  expect(sourceStarts.length).toBeGreaterThan(1);
  expect(Math.max(...sourceStarts) - Math.min(...sourceStarts)).toBeLessThan(2);
  await expect(text).toHaveText(secondQuote);
  await expect(page.locator('[data-quote-source]')).toHaveText(secondQuoteSource);
  await expect(page.locator('[data-quote-source]')).toHaveCSS('text-align', 'left');
  await expect(quote).not.toHaveAttribute('data-quote-phase', /.+/);
  await expect(quote).toHaveAttribute('data-quote-cursor', 'source');
  const caret = await page.locator('[data-quote-source]').evaluate((node) => {
    const style = getComputedStyle(node, '::after');
    return { width: Number.parseFloat(style.width), height: Number.parseFloat(style.height), clipPath: style.clipPath, animation: style.animationName, duration: style.animationDuration };
  });
  expect(caret.width).toBe(2);
  expect(caret.height).toBeGreaterThanOrEqual(17);
  expect(caret.clipPath).toBe('none');
  expect(caret.animation).toBe('quote-caret-blink');
  expect(caret.duration).toBe('1.2s');
  await page.clock.runFor(700);
  await expect(quote).toHaveAttribute('data-quote-cursor', 'source');
  expect(await page.locator('[data-quote-source]').evaluate((node) => getComputedStyle(node, '::after').animationName)).toBe('quote-caret-blink');
  expect(await quoteProbe(page)).toMatchObject({ timers: 1, animations: 0 });
});

test('single-click quote leaves the text unchanged', async ({ page }) => {
  await installQuoteProbe(page);
  await page.goto('/');
  await page.clock.runFor(1_500);
  const quote = page.locator('[data-home-quote]');
  const text = page.locator('[data-quote-text]');
  const source = page.locator('[data-quote-source]');
  await expect(quote).not.toHaveAttribute('data-quote-phase', /.+/);
  const markup = await quote.locator('.quote-row').innerHTML();
  await quote.click();
  await page.clock.runFor(400);
  expect(await quote.locator('.quote-row').innerHTML()).toBe(markup);
  await page.clock.runFor(600);
  await expect(text).toHaveText(firstQuote);
  await expect(source).toHaveText(firstQuoteSource);
  await expect(quote).not.toHaveAttribute('data-quote-phase', /.+/);
});

test('quote ignores clicks while deleting and typing', async ({ page }) => {
  await installQuoteProbe(page);
  await page.goto('/');
  const quote = page.locator('[data-home-quote]');
  await page.clock.runFor(1_500);
  await quote.dblclick();
  await page.clock.runFor(250);
  await expect(quote).toHaveAttribute('data-quote-phase', 'deleting');
  const before = await quote.evaluate((node) => ({ text: node.querySelector('[data-quote-text]')?.textContent, source: node.querySelector('[data-quote-source]')?.textContent }));
  await quote.dispatchEvent('click', { detail: 1, clientX: 220 });
  await quote.dispatchEvent('dblclick');
  await page.clock.runFor(250);
  const during = await quote.evaluate((node) => ({ text: node.querySelector('[data-quote-text]')?.textContent, source: node.querySelector('[data-quote-source]')?.textContent }));
  expect(during).not.toEqual(before);
  await expect(quote).toHaveAttribute('data-quote-phase', /deleting|typing/);
  await page.clock.runFor(400);
  await expect(quote).toHaveAttribute('data-quote-phase', 'typing');
  await quote.dispatchEvent('click', { detail: 1, clientX: 220 });
  await quote.dispatchEvent('dblclick');
  await page.clock.runFor(2_000);
  await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
  await expect(page.locator('[data-quote-source]')).toHaveText(secondQuoteSource);
});

test('normal-motion double-click quote advances once', async ({ page }) => {
  await installQuoteProbe(page);
  await page.goto('/');
  const quote = page.locator('[data-home-quote]');
  await page.clock.runFor(1_500);
  await quote.dblclick();
  await page.clock.runFor(900);
  await page.clock.runFor(2_000);
  await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
});

test('home quote switches randomly without immediately repeating itself', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installQuoteProbe(page, 0.999_999);
  await page.goto('/');
  const text = page.locator('[data-quote-text]');
  const source = page.locator('[data-quote-source]');
  await expect(text).toHaveText(firstQuote);
  await expect.poll(async () => (await quoteProbe(page)).timers).toBe(1);
  await page.clock.runFor(HOME_QUOTE_INTERVAL);
  await expect(text).toHaveText(lastQuote.text);
  await expect(source).toHaveText(`— ${lastQuote.source}`);
  await page.clock.runFor(HOME_QUOTE_INTERVAL);
  await expect(text).toHaveText(secondQuote);
  await expect(source).toHaveText(secondQuoteSource);
});

test('home quote completes each shuffled round before starting the next one', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installQuoteProbe(page);
  await page.goto('/');
  await expect.poll(async () => (await quoteProbe(page)).timers).toBe(1);
  await page.evaluate(() => {
    const text = document.querySelector<HTMLElement>('[data-quote-text]')!;
    const history = [text.textContent ?? ''];
    const layout = {
      minFontSize: Number.parseFloat(getComputedStyle(text).fontSize),
      overflowing: text.scrollWidth > text.clientWidth,
    };
    new MutationObserver(() => {
      history.push(text.textContent ?? '');
      layout.minFontSize = Math.min(layout.minFontSize, Number.parseFloat(getComputedStyle(text).fontSize));
      layout.overflowing ||= text.scrollWidth > text.clientWidth;
    }).observe(text, { childList: true });
    Object.defineProperty(window, '__quoteHistory', { value: history });
    Object.defineProperty(window, '__quoteLayout', { value: layout });
  });

  await page.clock.runFor(HOME_QUOTE_INTERVAL * (HOME_QUOTES.length - 1));
  const firstRound = await page.evaluate(() =>
    [...(window as unknown as { __quoteHistory: string[] }).__quoteHistory]);
  expect(firstRound).toHaveLength(HOME_QUOTES.length);
  expect(new Set(firstRound)).toEqual(new Set(HOME_QUOTES.map(({ text }) => text)));

  await page.clock.runFor(HOME_QUOTE_INTERVAL * HOME_QUOTES.length);
  const history = await page.evaluate(() =>
    [...(window as unknown as { __quoteHistory: string[] }).__quoteHistory]);
  const secondRound = history.slice(HOME_QUOTES.length);
  expect(secondRound).toHaveLength(HOME_QUOTES.length);
  expect(new Set(secondRound)).toEqual(new Set(HOME_QUOTES.map(({ text }) => text)));
  expect(secondRound[0]).not.toBe(firstRound.at(-1));
  const layout = await page.evaluate(() =>
    (window as unknown as { __quoteLayout: { minFontSize: number; overflowing: boolean } }).__quoteLayout);
  expect(layout.overflowing).toBe(false);
  expect(layout.minFontSize).toBeGreaterThanOrEqual(10);
});

test('bfcache recovery starts a complete round from the quote already in the DOM', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installQuoteProbe(page);
  await page.goto('/');
  await expect.poll(async () => (await quoteProbe(page)).timers).toBe(1);
  await page.clock.runFor(HOME_QUOTE_INTERVAL);
  await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    const text = document.querySelector<HTMLElement>('[data-quote-text]')!;
    const history = [text.textContent ?? ''];
    new MutationObserver(() => { history.push(text.textContent ?? ''); })
      .observe(text, { childList: true });
    Object.defineProperty(window, '__bfcacheQuoteHistory', { value: history });
  });
  await expect.poll(async () => (await quoteProbe(page)).timers).toBe(1);
  await page.clock.runFor(HOME_QUOTE_INTERVAL * (HOME_QUOTES.length - 1));
  const round = await page.evaluate(() =>
    [...(window as unknown as { __bfcacheQuoteHistory: string[] }).__bfcacheQuoteHistory]);
  expect(round).toHaveLength(HOME_QUOTES.length);
  expect(new Set(round)).toEqual(new Set(HOME_QUOTES.map(({ text }) => text)));
});

test('home reduced motion changes quotes without animated scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installQuoteProbe(page);
  await page.goto('/');
  const quote = page.locator('[data-home-quote]');
  await page.clock.runFor(HOME_QUOTE_INTERVAL - 1);
  await expect.soft(page.locator('[data-quote-text]')).toHaveText(firstQuote, { timeout: 200 });
  await page.clock.runFor(1);
  await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
  expect(await quote.evaluate((node) => node.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length)).toBe(0);
  expect(await quoteProbe(page)).toMatchObject({ timers: 1, animations: 0 });
});

test('home quote uses a distinct dark surface and keeps the friend card radius', async ({ page }) => {
  await page.goto('/');
  const surfaces = await page.evaluate(() => {
    const expected = document.createElement('div');
    expected.style.backgroundColor = '#202b3bf2';
    expected.style.borderColor = '#21d8eacc';
    expected.style.color = '#ecf2f0';
    document.body.append(expected);
    const expectedStyle = getComputedStyle(expected);
    const expectedBackground = expectedStyle.backgroundColor;
    const expectedBorder = expectedStyle.borderColor;
    const expectedInk = expectedStyle.color;
    expected.remove();
    const quote = getComputedStyle(document.querySelector('.quote-card')!);
    const player = getComputedStyle(document.querySelector('[data-music-player]')!);
    const friend = getComputedStyle(document.querySelector('[data-home-panel="friends"] .tile')!);
    const guestbook = getComputedStyle(document.querySelector('[data-home-panel="guestbook"] .tile')!);
    const source = getComputedStyle(document.querySelector('[data-quote-source]')!);
    return { expectedBackground, expectedBorder, expectedInk, background: quote.backgroundColor, playerBackground: player.backgroundColor, friendBackground: friend.backgroundColor, guestbookBackground: guestbook.backgroundColor, border: quote.borderColor, playerBorder: player.borderColor, ink: quote.color, sourceInk: source.color, quoteRadius: quote.borderRadius, friendRadius: friend.borderRadius };
  });
  expect.soft(surfaces.background).toBe(surfaces.expectedBackground);
  expect.soft(surfaces.border).toBe(surfaces.expectedBorder);
  expect.soft(surfaces.ink).toBe(surfaces.expectedInk);
  expect.soft(surfaces.sourceInk).toBe('rgb(169, 231, 240)');
  expect.soft(surfaces.background).not.toBe(surfaces.playerBackground);
  expect.soft(surfaces.background).not.toBe(surfaces.friendBackground);
  expect.soft(surfaces.background).not.toBe(surfaces.guestbookBackground);
  expect.soft(surfaces.border).not.toBe(surfaces.playerBorder);
  expect.soft(surfaces.quoteRadius).toBe('3px');
  expect(surfaces.friendRadius).toBe('3px');
});

test('enabling reduced motion finishes typing and preserves the next deadline', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installQuoteProbe(page);
  await page.goto('/');
  const quote = page.locator('[data-home-quote]');
  await page.clock.runFor(HOME_QUOTE_INTERVAL);
  await expect(quote).toHaveAttribute('data-quote-phase', 'deleting');
  await page.clock.runFor(100);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
  await expect(quote).not.toHaveAttribute('data-quote-phase', /.+/);
  expect((await quoteProbe(page)).timers).toBe(1);
  await page.clock.runFor(HOME_QUOTE_INTERVAL - 101);
  await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
  await page.clock.runFor(1);
  await expect(page.locator('[data-quote-text]')).toHaveText(thirdQuote);
  expect(await quoteProbe(page)).toMatchObject({ timers: 1, animations: 0 });
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

test('double activating the clock plays a brief glitch and keeps the time readable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const card = page.locator('[data-home-clock-card]');
  const clock = card.locator('time');
  await expect(card).toBeEnabled();
  await card.dblclick();
  await expect(card).toHaveAttribute('data-clock-glitch', '');
  await expect(clock).toHaveAttribute('aria-label', /\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
  await expect(card).not.toHaveAttribute('data-clock-glitch', '');
  await card.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('data-clock-glitch', '');
});

test('clock glitch uses a short light pulse with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const card = page.locator('[data-home-clock-card]');
  const state = await card.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    return {
      active: element.hasAttribute('data-clock-glitch'),
      tubeAnimation: getComputedStyle(element.querySelector('[data-clock-digit]')!).animationName,
      cardAnimation: getComputedStyle(element).animationName
    };
  });
  expect(state).toEqual({ active: true, tubeAnimation: 'none', cardAnimation: 'clock-shell-glitch' });
  await expect(card).not.toHaveAttribute('data-clock-glitch', '');
});

test('clock card remains usable with two taps on a narrow touch screen', async ({ page, browser }) => {
  await page.goto('/');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const touchPage = await context.newPage();
    await touchPage.goto(new URL('/', page.url()).href);
    await expect(touchPage.locator('#page-loader')).toBeHidden();
    const card = touchPage.locator('[data-home-clock-card]');
    await expect(card).toBeInViewport();
    await card.tap();
    await card.tap();
    await expect(card).toHaveAttribute('data-clock-glitch', '');
  } finally {
    await context.close();
  }
});

test('home links open their independent pages', async ({ page }) => {
  const entries = [
    ['作品橱窗', '/creation/'],
    ['关于我', '/about/'],
    ['随笔', '/snippets/'],
    ['收藏夹', '/favorites/'],
    ['工具箱', '/toolbox/'],
    ['友链', '/friends/'],
    ['留言板', '/guestbook/'],
    ['计划', '/plans/'],
    ['资讯', '/digest/'],
    ['实验场', '/playground/']
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
  await installQuoteProbe(page);
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
    const previousTime = await page.locator('[data-home-clock]').getAttribute('aria-label');
    await page.clock.runFor(HOME_QUOTE_INTERVAL);
    await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
    expect((await quoteProbe(page)).timers).toBe(1);
    await expect(page.locator('[data-home-clock]')).not.toHaveAttribute('aria-label', previousTime!);
  }
});

test('pagination and legacy post paths stay available', async ({ page }) => {
  expect((await page.request.get('/page/1/')).status()).toBe(404);
  expect((await page.request.get('/page/2/')).status()).toBe(200);
  await page.goto('/page/2/');
  await expect(page.locator('article[data-post-card]')).toHaveCount(6);
  expect((await page.request.get('/page/3/')).status()).toBe(200);
  await page.goto('/page/3/');
  await expect(page.locator('article[data-post-card]')).toHaveCount(3);
  expect((await page.request.get('/page/4/')).status()).toBe(404);
  await page.goto('/blogs/');
  const mergedFpgaLink = page.locator('a[href="/posts/Xilinx FPGA开发/"]').first();
  await expect(mergedFpgaLink).toHaveCount(1);
  const resolvedPath = await mergedFpgaLink.evaluate((link) => new URL((link as HTMLAnchorElement).href).pathname);
  expect(resolvedPath).toBe(encodeURI('/posts/Xilinx FPGA开发/'));
  expect((await page.request.get(resolvedPath)).status()).toBe(200);
});

test('ordinary paginated pages omit the site footer', async ({ page }) => {
  await page.goto('/page/2/');
  const footer = page.locator('footer[data-site-footer]');
  await expect(footer).toHaveCount(0);
});

test('normal-motion return visits keep one automatic quote timer and one listener', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installQuoteProbe(page);
  await page.goto('/');
  const probe = () => quoteProbe(page);
  const listenerCount = (await probe()).motionListeners;
  for (let visit = 0; visit < 2; visit += 1) {
    await page.locator('[data-home-stage]').getByRole('link', { name: '计划', exact: true }).click();
    await expect(page).toHaveURL('/plans/');
    await page.clock.runFor(1_200);
    await expect(page.locator('#page-loader')).toBeHidden();
    expect((await probe()).timers).toBe(0);
    await page.locator('[data-back-button]').click();
    await expect(page).toHaveURL('/');
    await page.clock.runFor(1_200);
    await expect(page.locator('#page-loader')).toBeHidden();
    expect((await probe()).timers).toBe(1);
    expect((await probe()).motionListeners).toBe(listenerCount);
    await expect(page.locator('[data-quote-text]')).toHaveText(firstQuote);
    await page.clock.runFor(HOME_QUOTE_INTERVAL + 1_000);
    await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
    expect(await probe()).toEqual({ timers: 1, motionListeners: listenerCount, animations: 0 });
  }
});
