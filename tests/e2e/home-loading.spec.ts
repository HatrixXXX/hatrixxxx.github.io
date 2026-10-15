import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('shows the splash again on a homepage reload and holds it for refreshed artwork', async ({ page }) => {
  let requestCount = 0;
  let releaseReload!: () => void;
  let reloadRequested!: () => void;
  const gate = new Promise<void>((resolve) => { releaseReload = resolve; });
  const requested = new Promise<void>((resolve) => { reloadRequested = resolve; });
  await page.route('**/assets/home/character-parts/foot_L.webp', async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.continue();
      return;
    }
    reloadRequested();
    await gate;
    await route.continue();
  });

  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();

  const reload = page.reload({ waitUntil: 'domcontentloaded' });
  try {
    await requested;
    const loader = page.locator('#page-loader');
    await expect(loader).toBeVisible();
    await expect(loader.locator('.pl-ring-wrap')).toHaveCount(1);
    await expect(loader).not.toHaveClass(/pl-done/);
  } finally {
    releaseReload();
  }
  await reload;
  await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'ready');
  await expect(page.locator('#page-loader')).toBeHidden();
});

test('covers the homepage until client modules finish even after eight seconds', async ({ page }) => {
  let releaseScripts!: () => void;
  const scriptsGate = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.clock.install();
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'script') {
      await route.continue();
      return;
    }
    await scriptsGate;
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'commit' });
  const loader = page.locator('#page-loader');
  try {
    await expect(page.locator('[data-home-stage]')).toBeAttached();
    await expect(loader).toBeVisible();
    await expect(loader.locator('.pl-pct-num')).toHaveText('0%');
    await page.clock.runFor(7_000);
    await expect(loader).toBeVisible();
    await page.clock.runFor(1_100);
    await expect(loader).toBeVisible();
  } finally {
    releaseScripts();
    await page.clock.resume();
  }

  await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'ready');
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-layout-state', 'ready');
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('holds the cold-home splash until its display font is ready', async ({ page }) => {
  let releaseFont!: () => void;
  let fontRequested!: () => void;
  const fontGate = new Promise<void>((resolve) => { releaseFont = resolve; });
  const requested = new Promise<void>((resolve) => { fontRequested = resolve; });
  await page.route(/orbitron-latin-800-normal\.woff2/, async (route) => {
    fontRequested();
    await fontGate;
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const loader = page.locator('#page-loader');
  try {
    await requested;
    await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'ready');
    await expect(page.locator('[data-music-player]')).toHaveAttribute('data-layout-state', 'ready');
    await page.evaluate(async () => {
      const value = document.querySelector<HTMLElement>('[data-home-canvas]')!.style.getPropertyValue('--home-background-image');
      const src = value.match(/url\("([^\"]+)"\)/)?.[1];
      if (!src) throw new Error('Missing home background URL');
      const image = new Image();
      image.src = src;
      await image.decode();
    });
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => document.fonts.status)).toBe('loading');
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(loader).not.toHaveClass(/pl-done/);
  } finally {
    releaseFont();
  }
  await expect(loader).not.toHaveClass(/pl-visible/);
  expect(await page.evaluate(() => document.fonts.check('800 64px Orbitron'))).toBe(true);
});

test('keeps the cold-home splash when client modules and character start late', async ({ page }) => {
  let releaseScripts!: () => void;
  let releaseCharacter!: () => void;
  const scriptsGate = new Promise<void>((resolve) => { releaseScripts = resolve; });
  const characterGate = new Promise<void>((resolve) => { releaseCharacter = resolve; });
  await page.clock.install();
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') {
      await scriptsGate;
    } else if (route.request().url().includes('/assets/home/character-parts/foot_L.webp')) {
      await characterGate;
    }
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'commit' });
  const loader = page.locator('#page-loader');
  const rig = page.locator('[data-char-rig]');
  try {
    await expect(page.locator('[data-home-stage]')).toBeAttached();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    const remaining = await page.evaluate(() => 8_000 - (Date.now() - Number(document.documentElement.dataset.initialPageLoaderStartedAt)));
    await page.clock.runFor(Math.max(0, remaining - 500));
    await expect(loader).toBeVisible();
    releaseScripts();
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(rig).toHaveAttribute('data-character-state', 'loading');
    await page.clock.runFor(9_000);
    await expect(rig).toHaveAttribute('data-character-state', 'loading');
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(loader).not.toHaveClass(/pl-done/);
  } finally {
    releaseScripts();
    releaseCharacter();
    await page.clock.resume();
  }
  await expect(rig).toHaveAttribute('data-character-state', 'ready');
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('a pending player layout independently holds the loader', async ({ page }) => {
  await page.addInitScript(() => {
    const query = document.querySelector.bind(document);
    document.querySelector = ((selector: string) => selector === '[data-home-panel="music"]' ? null : query(selector)) as typeof document.querySelector;
    Object.defineProperty(window, '__releasePlayer', { value: () => {
      document.querySelector = query;
      document.dispatchEvent(new Event('astro:page-load'));
    } });
  });
  await page.goto('/');
  const loader = page.locator('#page-loader');
  await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'ready');
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-layout-state', 'pending');
  await expect(loader).toHaveClass(/pl-visible/);
  await expect(loader).not.toHaveClass(/pl-done/);
  await page.evaluate(() => (window as unknown as { __releasePlayer: () => void }).__releasePlayer());
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-layout-state', 'ready');
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('a pending background independently holds the loader', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.route('**/assets/home/cover.webp', async (route) => {
    requested = true;
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const loader = page.locator('#page-loader');
  try {
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'ready');
    await expect(page.locator('[data-music-player]')).toHaveAttribute('data-layout-state', 'ready');
    await expect(loader.locator('.pl-pct-num')).toHaveText('85%');
    await expect(loader).not.toHaveClass(/pl-done/);
  } finally {
    release();
  }
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('keeps the homepage covered past the accessory deadline while its background loads', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.clock.install();
  await page.route('**/assets/home/cover.webp', async (route) => {
    requested = true;
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const loader = page.locator('#page-loader');
  try {
    await expect.poll(() => requested).toBe(true);
    await expect(loader).toHaveClass(/pl-visible/);
    await page.clock.runFor(9_000);
    await expect(loader).toHaveClass(/pl-visible/);
  } finally {
    release();
    await page.clock.resume();
  }
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('keeps the loader over a non-home page until its background is ready', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.route((url) => url.pathname.startsWith('/assets/backgrounds/'), async (route) => {
    requested = true;
    await gate;
    await route.continue();
  });

  await page.goto('/blogs/', { waitUntil: 'domcontentloaded' });
  const loader = page.locator('#page-loader');
  try {
    await expect.poll(() => requested).toBe(true);
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(page.locator('html')).toHaveAttribute('data-page-background', 'loading');
    expect(await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundImage)).toBe('none');
    await page.waitForTimeout(700);
    await expect(loader).not.toHaveClass(/pl-done/);
  } finally {
    release();
  }
  await expect(page.locator('html')).not.toHaveAttribute('data-page-background', 'loading', { timeout: 3_000 });
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('keeps a click-through navigation covered while the destination background loads', async ({ page }) => {
  await page.goto('/');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.route((url) => url.pathname.startsWith('/assets/backgrounds/'), async (route) => {
    requested = true;
    await gate;
    await route.continue();
  });
  await page.locator('[data-home-blog]').click();
  const loader = page.locator('#page-loader');
  try {
    await expect(page).toHaveURL('/blogs/');
    await expect.poll(() => requested).toBe(true);
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(page.locator('html')).toHaveAttribute('data-page-background', 'loading');
    expect(await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundImage)).toBe('none');
    await page.waitForTimeout(700);
    await expect(loader).not.toHaveClass(/pl-done/);
  } finally {
    release();
  }
  await expect(page.locator('html')).not.toHaveAttribute('data-page-background', 'loading');
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('does not reveal an unfinished background after the loading deadline', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.clock.install();
  await page.route((url) => url.pathname.startsWith('/assets/backgrounds/'), async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/blogs/', { waitUntil: 'domcontentloaded' });
  const loader = page.locator('#page-loader');
  try {
    await expect(loader).toHaveClass(/pl-visible/);
    await page.clock.runFor(9_000);
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(page.locator('html')).toHaveAttribute('data-page-background', 'loading');
  } finally {
    release();
    await page.clock.resume();
  }
  await expect(page.locator('html')).not.toHaveAttribute('data-page-background', 'loading');
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('keeps the persisted player aligned with the current homepage panel on return visits', async ({ page }) => {
  await page.goto('/');
  const player = page.locator('[data-music-player]');
  await player.evaluate((node) => node.setAttribute('data-persist-probe', 'original'));
  for (let visit = 0; visit < 3; visit += 1) {
    await expect(player).toHaveAttribute('data-layout-state', 'ready');
    await expect(player).toHaveAttribute('data-persist-probe', 'original');
    await expect(player).toBeVisible();
    await expect(page.locator('#page-loader')).not.toHaveClass(/pl-visible/);
    const geometry = await page.evaluate(() => {
      const player = document.querySelector<HTMLElement>('[data-music-player]')!;
      const panel = document.querySelector<HTMLElement>('[data-home-panel="music"]')!;
      const playerBox = player.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      return {
        player: { x: playerBox.x, y: playerBox.y, width: playerBox.width, height: playerBox.height },
        panel: { x: panelBox.x, y: panelBox.y, width: panelBox.width, height: panelBox.height },
      };
    });
    expect(Math.abs(geometry.player.x - geometry.panel.x)).toBeLessThan(1);
    expect(Math.abs(geometry.player.y - geometry.panel.y)).toBeLessThan(1);
    expect(Math.abs(geometry.player.width - geometry.panel.width)).toBeLessThan(1);
    expect(Math.abs(geometry.player.height - geometry.panel.height)).toBeLessThan(1);
    if (visit === 2) break;
    await page.locator('[data-home-stage]').getByRole('link', { name: '计划', exact: true }).click();
    await expect(player).toHaveAttribute('data-display-mode', 'dock');
    await page.locator('[data-back-button]').click();
    await expect(page).toHaveURL('/');
  }
});

test('holds the loader and character until every layer is decoded', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/assets/home/character-parts/foot_L.webp', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const rig = page.locator('[data-char-rig]');
  const loader = page.locator('#page-loader');
  try {
    await expect(rig).toHaveAttribute('data-character-state', 'loading');
    await expect(rig).toBeHidden();
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(loader.locator('.pl-pct-num')).toHaveText('85%');
    await expect(loader).not.toHaveClass(/pl-done/);
  } finally {
    release();
  }
  await expect(rig).toHaveAttribute('data-character-state', 'ready');
  await expect(rig).toBeVisible();
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-layout-state', 'ready');
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('dismisses the loader but keeps a failed character hidden', async ({ page }) => {
  await page.route('**/assets/home/character-parts/foot_L.webp', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'error');
  await expect(page.locator('[data-char-rig]')).toBeHidden();
  await expect(page.locator('#page-loader')).not.toHaveClass(/pl-visible/);
});

test('keeps the splash until a late character layer decodes', async ({ page }) => {
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const imageRequested = new Promise<void>((resolve) => { requested = resolve; });
  await page.clock.install();
  await page.route('**/assets/home/character-parts/foot_L.webp', async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const rig = page.locator('[data-char-rig]');
  const loader = page.locator('#page-loader');
  try {
    await imageRequested;
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(rig).toHaveAttribute('data-character-state', 'loading');
    await page.clock.runFor(9_000);
    await expect(rig).toHaveAttribute('data-character-state', 'loading');
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(loader).not.toHaveClass(/pl-done/);
  } finally {
    release();
    await page.clock.resume();
  }
  await expect.poll(() => rig.locator('[data-part="foot_L"]').evaluate((element: HTMLImageElement) =>
    element.complete && element.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(rig).toHaveAttribute('data-character-state', 'ready');
  await expect(rig).toBeVisible();
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('keeps the cold splash while an eager layer prevents window.load', async ({ page }) => {
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const imageRequested = new Promise<void>((resolve) => { requested = resolve; });
  await page.clock.install();
  await page.route('**/assets/home/character-parts/head.webp', async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const rig = page.locator('[data-char-rig]');
  const loader = page.locator('#page-loader');
  try {
    await imageRequested;
    expect(await page.evaluate(() => document.readyState)).toBe('interactive');
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(rig).toHaveAttribute('data-character-state', 'loading');
    await page.clock.runFor(9_000);
    await expect(rig).toHaveAttribute('data-character-state', 'loading');
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(loader).not.toHaveClass(/pl-done/);
    expect(await page.evaluate(() => document.readyState)).toBe('interactive');
  } finally {
    release();
    await page.clock.resume();
  }
  await page.waitForLoadState('load');
  await expect.poll(() => rig.locator('[data-part="head"]').evaluate((element: HTMLImageElement) =>
    element.complete && element.naturalWidth > 0)).toBe(true);
  await expect(rig).toHaveAttribute('data-character-state', 'ready');
  await expect(rig).toBeVisible();
  await expect(loader).not.toHaveClass(/pl-visible/);
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('a canceled return-home navigation keeps the dock player ready and usable', async ({ page }) => {
  await page.addInitScript(() => {
    const instances: HTMLAudioElement[] = [];
    Object.defineProperty(window, '__playerAudioInstances', { value: instances });
    window.Audio = new Proxy(window.Audio, {
      construct(target, args) {
        const instance = Reflect.construct(target, args) as HTMLAudioElement;
        instances.push(instance);
        return instance;
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('#page-loader')).not.toHaveClass(/pl-visible/);
  await page.locator('[data-home-stage]').getByRole('link', { name: '计划', exact: true }).click();
  await expect(page).toHaveURL('/plans/');
  const player = page.locator('[data-music-player]');
  await player.evaluate((node) => node.setAttribute('data-persist-probe', 'original'));
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const homeRequested = new Promise<void>((resolve) => { requested = resolve; });
  await page.route(/\/$/, async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  try {
    await page.locator('[data-back-button]').dispatchEvent('click');
    await homeRequested;
    await page.evaluate(() => {
      const anchor = document.createElement('a');
      anchor.href = '#canceled-return';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    });
    await expect(page).toHaveURL('/plans/#canceled-return');
    await expect(player).toHaveAttribute('data-layout-state', 'ready');
    await expect(player).toHaveAttribute('data-display-mode', 'dock');
    await expect(player).toBeVisible();
    await player.locator('[data-player-toggle]').click();
    await expect(player).toHaveAttribute('data-ui-state', 'expanded');
    await player.click({ position: { x: 12, y: 12 } });
    await expect(player).toHaveAttribute('data-ui-state', 'collapsed');
  } finally {
    release();
  }
  await page.unrouteAll({ behavior: 'wait' });
  await expect(page).toHaveURL('/plans/#canceled-return');
  await expect(player).toHaveAttribute('data-layout-state', 'ready');
  await expect(player).toHaveAttribute('data-display-mode', 'dock');
  await expect(player).toHaveAttribute('data-persist-probe', 'original');
  await expect(player).toHaveCount(1);
  await player.locator('[data-player-toggle]').click();
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
  expect(await page.evaluate(() =>
    (window as unknown as { __playerAudioInstances: HTMLAudioElement[] }).__playerAudioInstances.length)).toBe(1);
});

for (const outcome of ['ready', 'still-loading'] as const) {
  test(`a superseded home ${outcome} cannot dismiss the next navigation loader`, async ({ page }) => {
    let releaseCharacter!: () => void;
    let releaseNavigation!: () => void;
    let navigationRequested!: () => void;
    const characterGate = new Promise<void>((resolve) => { releaseCharacter = resolve; });
    const navigationGate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
    const requested = new Promise<void>((resolve) => { navigationRequested = resolve; });
    await page.clock.install();
    await page.route('**/assets/home/character-parts/foot_L.webp', async (route) => {
      await characterGate;
      await route.continue();
    });
    await page.route('**/blogs/', async (route) => {
      navigationRequested();
      await navigationGate;
      await route.continue();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loader = page.locator('#page-loader');
    try {
      await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'loading');
      await expect(loader).toHaveClass(/pl-visible/);
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
      await page.locator('[data-home-blog]').dispatchEvent('click');
      await requested;
      if (outcome === 'ready') {
        releaseCharacter();
        await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'ready');
        await page.clock.runFor(2_500);
      } else {
        await page.clock.runFor(9_000);
      }
      await expect(loader).toHaveClass(/pl-visible/);
      await expect(loader).not.toHaveClass(/pl-done/);
      await expect(loader.locator('.pl-shutter-leaf')).toHaveCount(2);
      await expect(loader.locator('.pl-pct-num')).toHaveCount(0);
    } finally {
      releaseCharacter();
      releaseNavigation();
      await page.clock.resume();
    }
    await expect(page).toHaveURL(/\/blogs\/$/);
    await expect(loader).not.toHaveClass(/pl-visible/);
  });
}

for (const departure of ['pagehide', 'external', 'non-html'] as const) {
  test(`${departure} clears a canceled home loader before page recovery`, async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.clock.install();
    await page.route('**/assets/home/character-parts/foot_L.webp', async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loader = page.locator('#page-loader');
    try {
      await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'loading');
      await expect(loader).toHaveClass(/pl-visible/);
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
      await page.evaluate((kind) => {
        if (kind === 'pagehide') {
          window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        } else {
          const to = new URL(kind === 'external' ? 'https://example.com/' : '/rss.xml', location.href);
          document.dispatchEvent(Object.assign(new Event('astro:before-preparation'), { to }));
        }
      }, departure);
      await expect(loader).not.toHaveClass(/pl-visible|pl-done/);
      await expect(loader.locator(':scope > *')).toHaveCount(0);
      await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.clock.runFor(9_000);
      await expect(loader).not.toHaveClass(/pl-visible|pl-done/);
      await expect(loader.locator(':scope > *')).toHaveCount(0);
    } finally {
      release();
      await page.clock.resume();
    }
  });
}
