import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('selector plates swing together around screws fixed to the front shell', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/favorites/');
    await expect(page.locator('[data-favorites]')).toHaveAttribute('data-bound', '');

    const before = await page.evaluate(() => {
      const reel = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
      const plates = [...document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-plate')];
      const screws = [...document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-screw')];
      const opening = reel.getBoundingClientRect();
      const positions = screws.map((screw) => screw.getBoundingClientRect());
      return {
        frontMounted: plates.every((plate) => !reel.contains(plate)),
        screwOutsideOpening: positions[0].x + positions[0].width / 2 < opening.left
          && positions[1].x + positions[1].width / 2 > opening.right,
        screwPositions: positions.map((box) => ({ x: box.x, y: box.y }))
      };
    });
    await page.locator('[data-favorites-reel]').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-favorites-selected]')).toHaveText('有趣的小物件');
    const screwPositions = await page.locator('.favorites-reel__paddle-screw').evaluateAll((screws) => screws.map((screw) => {
      const box = screw.getBoundingClientRect();
      return { x: box.x, y: box.y };
    }));

    expect(before.frontMounted).toBe(true);
    expect(before.screwOutsideOpening).toBe(true);
    screwPositions.forEach((position, index) => {
      expect(Math.abs(position.x - before.screwPositions[index].x)).toBeLessThan(1);
      expect(Math.abs(position.y - before.screwPositions[index].y)).toBeLessThan(1);
    });
  }
});

test('selector plates follow the spinning reel and return to rest', async ({ page }) => {
  await page.goto('/favorites/');
  await expect(page.locator('[data-favorites]')).toHaveAttribute('data-bound', '');
  await page.getByRole('button', { name: '随机转一个链接' }).click();
  const samples = await page.evaluate(async () => {
    const reel = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
    const plates = [...document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-plate')];
    const read = () => {
      return {
        progress: Number(reel.dataset.progress),
        angles: plates.map((plate) => {
          const matrix = new DOMMatrix(getComputedStyle(plate).transform);
          return Math.atan2(matrix.b, matrix.a);
        })
      };
    };
    const readings = [read()];
    for (let index = 0; index < 8; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      readings.push(read());
    }
    return readings;
  });
  expect(samples.some((sample, index) => index > 0
    && Math.abs(sample.progress - samples[index - 1].progress) > .001
    && Math.abs(sample.angles[0] - samples[index - 1].angles[0]) > .001)).toBe(true);
  expect(samples.every((sample) => Math.abs(sample.angles[0] - sample.angles[1]) < .001)).toBe(true);
  await expect(page.locator('[data-favorites-reel]')).not.toHaveAttribute('aria-busy', 'true', { timeout: 10000 });
  const settled = await page.locator('.favorites-reel__paddle-plate').evaluateAll((plates) => plates.map((plate) => getComputedStyle(plate).transform));
  expect(settled).toEqual(['matrix(1, 0, 0, 1, 0, 0)', 'matrix(1, 0, 0, 1, 0, 0)']);
});

test('a bookmark deep link rocks its blade and selectors before the blade flashes', async ({ page }) => {
  await page.goto('/favorites/?bookmark=2', { waitUntil: 'domcontentloaded' });
  const reel = page.locator('[data-favorites-reel]');
  const selected = page.locator('[data-favorites-item][data-index="2"]');
  const samples = await page.evaluate(async () => {
    const loader = document.querySelector<HTMLElement>('#page-loader');
    const loaderVisible = () => loader?.classList.contains('pl-visible')
      || document.documentElement.dataset.initialPageLoader === 'visible';
    if (loaderVisible()) await new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (loaderVisible()) return;
        observer.disconnect();
        resolve();
      });
      if (loader) observer.observe(loader, { attributes: true, attributeFilter: ['class'] });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-initial-page-loader'] });
    });
    const reel = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
    const plate = document.querySelector<HTMLElement>('.favorites-reel__paddle-plate')!;
    const selected = document.querySelector<HTMLElement>('[data-favorites-item][data-index="2"]')!;
    const result: Array<{ progress: number; angle: number; busy: string | null; flashing: boolean }> = [];
    for (let index = 0; index < 38; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const matrix = new DOMMatrix(getComputedStyle(plate).transform);
      result.push({ progress: Number(reel.dataset.progress), angle: Math.atan2(matrix.b, matrix.a), busy: reel.getAttribute('aria-busy'), flashing: selected.hasAttribute('data-flash') });
    }
    return result;
  });
  await expect(page.locator('#page-loader')).toBeHidden();
  expect(samples.some(({ progress, angle, busy, flashing }) => busy === 'true' && !flashing
    && Math.abs(progress - 2) > .01 && Math.abs(angle) > .015), JSON.stringify(samples)).toBe(true);
  const directions = samples.filter(({ progress, busy }) => busy === 'true' && Math.abs(progress - 2) > .003)
    .map(({ progress }) => Math.sign(progress - 2));
  expect(directions.filter((direction, index) => index > 0 && direction !== directions[index - 1]).length).toBeGreaterThanOrEqual(3);
  await expect(reel).not.toHaveAttribute('aria-busy', 'true');
  await expect(selected).toHaveAttribute('data-flash', '');
  await expect.poll(() => selected.evaluate((item) => getComputedStyle(item, '::after').animationName)).toBe('favorites-blade-flash');
  await expect(selected).not.toHaveAttribute('data-flash', '', { timeout: 2000 });
});

test('a search result rocks the selected blade after the page transition', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+K');
  await page.locator('[data-search-input]').fill('HDL Bits');
  await page.locator('[data-search-result]').filter({ has: page.locator('strong', { hasText: /^HDL Bits$/ }) }).click();
  await expect(page).toHaveURL(/\/favorites\/\?bookmark=\d+/);
  await expect(page.locator('#page-loader')).toBeHidden();
  await expect(page.locator('[data-favorites-item][data-title="HDL Bits"]')).toHaveAttribute('data-flash', '');
  await expect(page.locator('[data-favorites-selected]')).toHaveText('HDL Bits');
});

test('the random blade flashes only after its spin stops', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/favorites/');
  const reel = page.locator('[data-favorites-reel]');
  await page.locator('[data-favorites-random]').click();
  await expect(reel).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-favorites-item][data-flash]')).toHaveCount(0);
  await expect(reel).not.toHaveAttribute('aria-busy', 'true', { timeout: 10000 });
  const selected = page.locator('[data-favorites-item][data-selected="true"]');
  await expect(selected).toHaveAttribute('data-flash', '');
  await expect.poll(() => selected.evaluate((item) => getComputedStyle(item, '::after').animationName)).toBe('favorites-blade-flash');
  await expect.poll(() => selected.evaluate((item) => getComputedStyle(item, '::after').maskImage)).toContain('reel-blade-mobile-v5.webp');
  await expect(page.locator('[data-favorites-item][data-flash]')).toHaveCount(0, { timeout: 2000 });
});

test('reduced motion selects deep links and random entries without rocking or flashing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/favorites/?bookmark=2');
  const reel = page.locator('[data-favorites-reel]');
  await expect(page.locator('[data-favorites-item][data-index="2"]')).toHaveAttribute('data-selected', 'true');
  await expect(reel).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-favorites-item][data-flash]')).toHaveCount(0);
  await page.locator('[data-favorites-random]').click();
  await expect(page.locator('[data-favorites-item][data-index="2"]')).toHaveAttribute('data-selected', 'false');
  await expect(reel).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-favorites-item][data-flash]')).toHaveCount(0);
  await expect.poll(() => reel.getAttribute('data-progress')).toMatch(/^-?\d+\.0000$/);
});

test('interrupting a random spin keeps the selector plate at its current angle', async ({ page }) => {
  await page.goto('/favorites/');
  await page.getByRole('button', { name: '随机转一个链接' }).click();
  await page.waitForFunction(() => {
    const plate = document.querySelector<HTMLElement>('.favorites-reel__paddle-plate')!;
    const matrix = new DOMMatrix(getComputedStyle(plate).transform);
    return Math.abs(Math.atan2(matrix.b, matrix.a)) > .1;
  });
  const angles = await page.evaluate(() => {
    const plate = document.querySelector<HTMLElement>('.favorites-reel__paddle-plate')!;
    const read = () => {
      const matrix = new DOMMatrix(getComputedStyle(plate).transform);
      return Math.atan2(matrix.b, matrix.a);
    };
    const before = read();
    document.querySelector<HTMLButtonElement>('[data-favorites-previous]')!.click();
    return { before, after: read() };
  });
  expect(Math.abs(angles.after - angles.before)).toBeLessThan(.001);
  await expect(page.locator('[data-favorites-reel]')).not.toHaveAttribute('aria-busy', 'true');
  await expect.poll(async () => page.locator('.favorites-reel__paddle-plate').first().evaluate((plate) => getComputedStyle(plate).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
});

test.describe('touch selectors', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('touch and keyboard selection keep the reduced-motion plates still', async ({ page }) => {
    await page.goto('/favorites/');
    await expect(page.locator('#page-loader')).toBeHidden();
    const next = page.getByRole('button', { name: '下一个链接' });
    const box = await next.boundingBox();
    expect(box).not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(page.locator('[data-favorites-selected]')).toHaveText('有趣的小物件');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await next.focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('[data-favorites-selected]')).toHaveText('Human System Optimization');
    const transforms = await page.locator('.favorites-reel__paddle-plate').evaluateAll((plates) => plates.map((plate) => getComputedStyle(plate).transform));
    expect(transforms).toEqual(['matrix(1, 0, 0, 1, 0, 0)', 'matrix(1, 0, 0, 1, 0, 0)']);
  });
});
