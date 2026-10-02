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
  await expect(loader.locator('.pl-pct-num')).toHaveText('85%');
  await expect(loader).not.toHaveClass(/pl-done/);
  await page.evaluate(() => (window as unknown as { __releasePlayer: () => void }).__releasePlayer());
  await expect(page.locator('[data-music-player]')).toHaveAttribute('data-layout-state', 'ready');
  await expect(loader).not.toHaveClass(/pl-visible/);
});

test('a pending background independently holds the loader', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  // Astro emits the initial page-load after window.load. Give the background
  // a cold URL at that event so the real readiness probe can remain pending
  // independently of the initial document's load event and character decoder.
  await page.addInitScript(() => {
    document.addEventListener('astro:page-load', () => {
      const canvas = document.querySelector<HTMLElement>('[data-home-canvas]')!;
      const value = canvas.style.getPropertyValue('--home-background-image');
      canvas.style.setProperty('--home-background-image', value.replace('f=webp', 'f=webp&readiness-probe=1'));
    }, { once: true });
  });
  let requested = false;
  await page.route('**/*readiness-probe=1', async (route) => {
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

test('reveals the player only at its final homepage geometry, including return visits', async ({ page }) => {
  const fallbackRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'image' && request.url().includes('hatrix-character-v5')) fallbackRequests.push(request.url());
  });
  await page.addInitScript(() => {
    const samples: Array<{ x: number; y: number }> = [];
    Object.defineProperty(window, '__playerVisibleSamples', { value: samples });
    const sample = () => {
      const player = document.querySelector<HTMLElement>('[data-music-player]');
      if (location.pathname === '/' && player && getComputedStyle(player).visibility !== 'hidden') {
        const box = player.getBoundingClientRect();
        samples.push({ x: box.x, y: box.y });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/');
  const player = page.locator('[data-music-player]');
  await player.evaluate((node) => node.setAttribute('data-persist-probe', 'original'));
  for (let visit = 0; visit < 3; visit += 1) {
    await expect(player).toHaveAttribute('data-layout-state', 'ready');
    await expect(player).toHaveAttribute('data-persist-probe', 'original');
    await expect(page.locator('#page-loader')).not.toHaveClass(/pl-visible/);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    const finalBox = await player.boundingBox();
    const samples = await page.evaluate(() => (window as unknown as { __playerVisibleSamples: Array<{ x: number; y: number }> }).__playerVisibleSamples);
    expect(finalBox).not.toBeNull();
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(Math.abs(sample.x - finalBox!.x)).toBeLessThan(1);
      expect(Math.abs(sample.y - finalBox!.y)).toBeLessThan(1);
    }
    expect(await player.evaluate((node) => node.getAnimations().some((animation) =>
      animation.playState === 'running' && getComputedStyle(node).transitionProperty.includes('transform')))).toBe(false);
    if (visit === 2) break;
    await page.locator('[data-home-stage]').getByRole('link', { name: '计划', exact: true }).click();
    await expect(player).toHaveAttribute('data-display-mode', 'dock');
    await page.evaluate(() => { (window as unknown as { __playerVisibleSamples: unknown[] }).__playerVisibleSamples.length = 0; });
    await page.locator('[data-back-button]').click();
    await expect(page).toHaveURL('/');
  }
  await expect(page.locator('[data-character-fallback]')).toHaveCount(0);
  expect(fallbackRequests).toEqual([]);
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
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/character-parts/foot_L.webp', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const rig = page.locator('[data-char-rig]');
  const loader = page.locator('#page-loader');
  try {
    await expect(loader).toHaveClass(/pl-visible/);
    await expect(rig).toHaveAttribute('data-character-state', 'error', { timeout: 10_000 });
    await expect(loader).not.toHaveClass(/pl-visible/);
  } finally {
    release();
  }
  await expect.poll(() => rig.locator('[data-part="foot_L"]').evaluate((element: HTMLImageElement) =>
    element.complete && element.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(rig).toHaveAttribute('data-character-state', 'error');
  await expect(rig).toBeHidden();
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
