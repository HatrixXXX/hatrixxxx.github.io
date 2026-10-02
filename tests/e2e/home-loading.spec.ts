import { expect, test } from '@playwright/test';

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
  await page.route((url) => url.pathname.startsWith('/_image') && url.href.includes('liupin-workshop'), async (route) => {
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
  await page.route('**/character-parts/foot_L.webp', async (route) => {
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
  await page.route('**/character-parts/foot_L.webp', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('[data-char-rig]')).toHaveAttribute('data-character-state', 'error');
  await expect(page.locator('[data-char-rig]')).toBeHidden();
  await expect(page.locator('#page-loader')).not.toHaveClass(/pl-visible/);
});

test('dismisses after the deadline and never reveals a late character', async ({ page }) => {
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const imageRequested = new Promise<void>((resolve) => { requested = resolve; });
  await page.clock.install();
  await page.route('**/character-parts/foot_L.webp', async (route) => {
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
    await expect(rig).toHaveAttribute('data-character-state', 'error');
    await expect(loader).not.toHaveClass(/pl-visible/);
  } finally {
    release();
    await page.clock.resume();
  }
  await expect.poll(() => rig.locator('[data-part="foot_L"]').evaluate((element: HTMLImageElement) =>
    element.complete && element.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(rig).toHaveAttribute('data-character-state', 'error');
  await expect(rig).toBeHidden();
});

test('starts the cold-load deadline before an eager layer permits window.load', async ({ page }) => {
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const imageRequested = new Promise<void>((resolve) => { requested = resolve; });
  await page.clock.install();
  await page.route('**/character-parts/head.webp', async (route) => {
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
    await expect(rig).toHaveAttribute('data-character-state', 'error');
    await expect(loader).not.toHaveClass(/pl-visible/);
    expect(await page.evaluate(() => document.readyState)).toBe('interactive');
  } finally {
    release();
    await page.clock.resume();
  }
  await page.waitForLoadState('load');
  await expect.poll(() => rig.locator('[data-part="head"]').evaluate((element: HTMLImageElement) =>
    element.complete && element.naturalWidth > 0)).toBe(true);
  await expect(rig).toHaveAttribute('data-character-state', 'error');
  await expect(rig).toBeHidden();
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
    await player.locator('[data-player-toggle]').click();
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

for (const outcome of ['ready', 'deadline'] as const) {
  test(`a superseded home ${outcome} cannot dismiss the next navigation loader`, async ({ page }) => {
    let releaseCharacter!: () => void;
    let releaseNavigation!: () => void;
    let navigationRequested!: () => void;
    const characterGate = new Promise<void>((resolve) => { releaseCharacter = resolve; });
    const navigationGate = new Promise<void>((resolve) => { releaseNavigation = resolve; });
    const requested = new Promise<void>((resolve) => { navigationRequested = resolve; });
    await page.clock.install();
    await page.route('**/character-parts/foot_L.webp', async (route) => {
      await characterGate;
      await route.continue();
    });
    await page.route('**/blog/', async (route) => {
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
      await expect(loader.locator('.pl-pct-num')).toHaveText('80%');
    } finally {
      releaseCharacter();
      releaseNavigation();
      await page.clock.resume();
    }
    await expect(page).toHaveURL(/\/blog\/$/);
    await expect(loader).not.toHaveClass(/pl-visible/);
  });
}

for (const departure of ['pagehide', 'external', 'non-html'] as const) {
  test(`${departure} clears a canceled home loader before page recovery`, async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.clock.install();
    await page.route('**/character-parts/foot_L.webp', async (route) => {
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
