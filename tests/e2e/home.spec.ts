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

test('lower stack shares one vertical-sided parallelogram plane with exact gaps and extents', async ({ page }) => {
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
    const projected = Object.fromEntries(['quote', 'music', 'friends', 'guestbook'].map((name) => [name, corners(panel(name))]));
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
    quote: [[8.88462, 676.61538], [606, 642], [606, 752], [8.88462, 786.61538]],
    music: [[8.88462, 790.61538], [387.05769, 768.69231], [387.05769, 940.69231], [8.88462, 962.61538]],
    friends: [[399, 768], [606, 756], [606, 844], [399, 856]],
    guestbook: [[399, 860], [606, 848], [606, 928], [399, 940]]
  };
  for (const [name, expected] of Object.entries(expectedCorners)) {
    geometry.projected[name].forEach((point, index) => {
      expect.soft(Math.abs(point.x - expected[index][0]), `${name} corner ${index} x`).toBeLessThan(0.05);
      expect.soft(Math.abs(point.y - expected[index][1]), `${name} corner ${index} y`).toBeLessThan(0.05);
    });
  }
  const { quote, music, friends, guestbook } = geometry.local;
  for (const projected of Object.values(geometry.projected)) {
    expect.soft(projected[0].x).toBeCloseTo(projected[3].x, 2);
    expect.soft(projected[1].x).toBeCloseTo(projected[2].x, 2);
    expect.soft(projected[1].x - projected[0].x).toBeCloseTo(projected[2].x - projected[3].x, 2);
    expect.soft(projected[1].y - projected[0].y).toBeCloseTo(projected[2].y - projected[3].y, 2);
  }
  // Computed matrix3d values are serialized to limited precision by Chromium.
  for (const edge of [0, 1]) {
    expect.soft(music[edge].y - quote[edge + 2].y).toBeCloseTo(4, 2);
    expect.soft(friends[edge].y - quote[edge + 2].y).toBeCloseTo(4, 2);
    expect.soft(guestbook[edge].y - friends[edge + 2].y).toBeCloseTo(4, 2);
  }
  for (const bottom of [2, 3]) {
    expect.soft(music[bottom].y).toBeCloseTo(172, 2);
    expect.soft(guestbook[bottom].y).toBeCloseTo(172, 2);
  }
  expect.soft(friends[0].x - music[1].x).toBeCloseTo(12, 2);
  for (const points of [quote, [...music, ...friends, ...guestbook]]) {
    expect.soft(Math.min(...points.map(({ x }) => x))).toBeCloseTo(-392, 2);
    expect.soft(Math.max(...points.map(({ x }) => x))).toBeCloseTo(208, 2);
  }
  expect.soft(geometry.musicPanelHeight).toBe(172);
  expect.soft(geometry.musicCssHeight).toBe('172px');
  expect.soft(geometry.ring).toEqual({ x: 72, y: 355, width: 180, height: 180 });
  expect.soft(geometry.name).toEqual({ x: 264, y: 389, width: 300, height: 112 });
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

test('home quote is a non-interactive live region without manual switching', async ({ page }) => {
  await installQuoteProbe(page);
  await page.goto('/');
  const quote = page.locator('[data-home-quote]');
  const text = page.locator('[data-quote-text]');
  const source = page.locator('[data-quote-source]');
  await expect(text).toHaveText(firstQuote);
  await expect(source).toHaveText(firstQuoteSource);
  expect.soft(await quote.evaluate((node) => node.tagName)).not.toBe('BUTTON');
  await expect.soft(page.locator('[data-quote-pause]')).toHaveCount(0, { timeout: 200 });
  await expect.soft(quote).toHaveAttribute('role', 'status', { timeout: 200 });
  await expect.soft(quote).toHaveAttribute('aria-live', 'polite', { timeout: 200 });
  await expect.soft(quote).toHaveAttribute('aria-atomic', 'true', { timeout: 200 });
  expect.soft(await quote.evaluate((node) => (node as HTMLElement).tabIndex)).toBe(-1);
  await quote.dispatchEvent('dblclick');
  await expect.soft(text).toHaveText(firstQuote, { timeout: 200 });
  await quote.focus();
  await expect.soft(quote).not.toBeFocused({ timeout: 200 });
  await page.keyboard.press('Enter');
  await expect.soft(text).toHaveText(firstQuote, { timeout: 200 });
  await page.keyboard.press('Space');
  await expect.soft(text).toHaveText(firstQuote, { timeout: 200 });
  await page.clock.runFor(HOME_QUOTE_INTERVAL - 1);
  await expect(text).toHaveText(firstQuote);
});

test('home quote keeps the sentence above its bottom-right source', async ({ page }) => {
  await page.goto('/');
  const positions = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.quote-card')!.getBoundingClientRect();
    const text = document.querySelector<HTMLElement>('[data-quote-text]')!.getBoundingClientRect();
    const source = document.querySelector<HTMLElement>('[data-quote-source]')!.getBoundingClientRect();
    return {
      cardCenterY: card.top + card.height / 2,
      textCenterY: text.top + text.height / 2,
      sourceCenterX: source.left + source.width / 2,
      sourceTop: source.top,
      sourceBottom: source.bottom,
      cardCenterX: card.left + card.width / 2,
      cardBottom: card.bottom,
    };
  });
  expect(positions.textCenterY).toBeLessThan(positions.cardCenterY);
  expect(positions.sourceTop).toBeGreaterThan(positions.textCenterY);
  expect(positions.sourceCenterX).toBeGreaterThan(positions.cardCenterX);
  expect(positions.sourceBottom).toBeLessThan(positions.cardBottom);

  const longContent = await page.evaluate(() => {
    const textNode = document.querySelector<HTMLElement>('[data-quote-text]')!;
    const textWindow = document.querySelector<HTMLElement>('[data-quote-text-window]')!;
    const sourceNode = document.querySelector<HTMLElement>('[data-quote-source]')!;
    textNode.textContent = '即使金句变成两行内容，也要与右下角的出处保持清楚分隔，不发生重叠。';
    sourceNode.textContent = `— ${'很长的出处'.repeat(20)}`;
    const windowNode = document.querySelector<HTMLElement>('.quote-window')!;
    return {
      contentWidth: windowNode.clientWidth,
      textBottom: textWindow.offsetTop + textNode.offsetTop + textNode.offsetHeight,
      sourceLeft: sourceNode.offsetLeft,
      sourceTop: sourceNode.offsetTop,
      sourceRight: sourceNode.offsetLeft + sourceNode.offsetWidth,
    };
  });
  expect(longContent.textBottom).toBeLessThanOrEqual(longContent.sourceTop);
  expect(longContent.sourceLeft).toBeGreaterThanOrEqual(0);
  expect(longContent.sourceRight).toBeLessThanOrEqual(longContent.contentWidth);
});

test('long home quotes shrink to stay on one line', async ({ page }) => {
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
    };
  });
  expect(layout.whiteSpace).toBe('nowrap');
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.clientHeight).toBeLessThanOrEqual(layout.lineHeight + 1);
  expect(layout.fontSize).toBeLessThan(22);
});

test('home quote advances automatically after six seconds with running vertical animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installQuoteProbe(page);
  await page.goto('/');
  const text = page.locator('[data-quote-text]');
  await expect.soft(text).toHaveText(firstQuote, { timeout: 200 });
  expect.soft((await quoteProbe(page)).timers).toBe(1);
  await page.clock.runFor(HOME_QUOTE_INTERVAL - 1);
  await expect.soft(text).toHaveText(firstQuote, { timeout: 200 });
  await page.clock.runFor(1);
  await expect(text).toHaveText(secondQuote);
  await expect(page.locator('[data-quote-source]')).toHaveText(secondQuoteSource);
  const clipWindow = page.locator('[data-quote-text-window]');
  await expect(clipWindow).toHaveCSS('overflow', 'hidden');
  const clipBoundary = await page.evaluate(() => {
    const clip = document.querySelector<HTMLElement>('[data-quote-text-window]')!;
    const source = document.querySelector<HTMLElement>('[data-quote-source]')!;
    return {
      clipBottom: clip.offsetTop + clip.offsetHeight,
      sourceTop: source.offsetTop,
    };
  });
  expect(clipBoundary.clipBottom).toBeLessThanOrEqual(clipBoundary.sourceTop);
  expect(await quoteProbe(page)).toMatchObject({ timers: 1, animations: 1 });
  const animation = await text.evaluate((node) => {
    const running = node.getAnimations().find((animation) => animation.playState === 'running');
    const effect = running?.effect as KeyframeEffect | undefined;
    return { duration: effect?.getTiming().duration, frames: effect?.getKeyframes().map(({ transform, opacity }) => ({ transform, opacity })) };
  });
  expect(animation).toEqual({ duration: 420, frames: [
    { transform: 'translateY(100%)', opacity: '0' },
    { transform: 'translateY(0px)', opacity: '1' }
  ] });
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
  expect(layout.minFontSize).toBeGreaterThanOrEqual(14);
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

test('home quote and player share their surface and the friend card radius', async ({ page }) => {
  await page.goto('/');
  const surfaces = await page.evaluate(() => {
    const expected = document.createElement('div');
    expected.style.backgroundColor = '#26232ff2';
    document.body.append(expected);
    const expectedBackground = getComputedStyle(expected).backgroundColor;
    expected.remove();
    const quote = getComputedStyle(document.querySelector('.quote-card')!);
    const player = getComputedStyle(document.querySelector('[data-music-player]')!);
    const friend = getComputedStyle(document.querySelector('[data-home-panel="friends"] .tile')!);
    return { expectedBackground, background: quote.backgroundColor, playerBackground: player.backgroundColor, border: quote.borderColor, playerBorder: player.borderColor, quoteRadius: quote.borderRadius, friendRadius: friend.borderRadius };
  });
  expect.soft(surfaces.background).toBe(surfaces.expectedBackground);
  expect.soft(surfaces.background).toBe(surfaces.playerBackground);
  expect.soft(surfaces.border).toBe(surfaces.playerBorder);
  expect.soft(surfaces.quoteRadius).toBe('3px');
  expect(surfaces.friendRadius).toBe('3px');
});

test('enabling reduced motion cancels quote animation and preserves the next deadline', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installQuoteProbe(page);
  await page.goto('/');
  const quote = page.locator('[data-home-quote]');
  await page.clock.runFor(HOME_QUOTE_INTERVAL);
  await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
  expect(await quote.evaluate((node) => node.getAnimations({ subtree: true }).some((animation) => animation.playState === 'running'))).toBe(true);
  await page.clock.runFor(100);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => quote.evaluate((node) => node.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length)).toBe(0);
  expect((await quoteProbe(page)).timers).toBe(1);
  await page.clock.runFor(HOME_QUOTE_INTERVAL - 101);
  await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
  await page.clock.runFor(1);
  await expect(page.locator('[data-quote-text]')).toHaveText(thirdQuote);
  expect(await quoteProbe(page)).toMatchObject({ timers: 1, animations: 1 });
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
  await expect(page.locator('article[data-post-card]')).toHaveCount(5);
  expect((await page.request.get('/page/3/')).status()).toBe(404);
  await page.goto('/blog/');
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
    expect((await probe()).timers).toBe(0);
    await page.locator('[data-back-button]').click();
    await expect(page).toHaveURL('/');
    expect((await probe()).timers).toBe(1);
    expect((await probe()).motionListeners).toBe(listenerCount);
    const before = (await probe()).animations;
    await page.clock.runFor(HOME_QUOTE_INTERVAL - 1);
    await expect(page.locator('[data-quote-text]')).toHaveText(firstQuote);
    await page.clock.runFor(1);
    await expect(page.locator('[data-quote-text]')).toHaveText(secondQuote);
    expect(await probe()).toEqual({ timers: 1, motionListeners: listenerCount, animations: before + 1 });
  }
});
