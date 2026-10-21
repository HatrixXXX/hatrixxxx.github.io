import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('clicking a side blade selects it, then clicking its centered blade opens its link', async ({ page, context }) => {
  const destination = 'https://www.zhihu.com/question/36882377/answer/3288717451';
  await context.route(destination, (route) => route.fulfill({ status: 200, body: 'bookmark destination' }));
  await page.goto('/favorites/');
  await page.waitForFunction(() => !document.documentElement.dataset.initialPageLoader);
  const blade = page.locator('[data-favorites-item][data-index="1"]');
  const popups: string[] = [];
  page.on('popup', (popup) => popups.push(popup.url()));

  await blade.click();
  await expect(blade).toHaveAttribute('data-selected', 'true');
  await expect(blade).toHaveAttribute('aria-label', '访问 有趣的小物件');
  await expect(page.locator('[data-favorites-reel]')).toHaveAttribute('data-progress', '1.0000');
  expect(popups).toHaveLength(0);

  const popupPromise = page.waitForEvent('popup', { timeout: 2500 });
  await blade.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(destination);

  const keyboardPopupPromise = page.waitForEvent('popup', { timeout: 2500 });
  await blade.focus();
  await page.keyboard.press('Enter');
  const keyboardPopup = await keyboardPopupPromise;
  await expect(keyboardPopup).toHaveURL(destination);
});

test.describe('touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('tapping a side blade selects it before a second tap opens its link', async ({ page, context }) => {
    const destination = 'https://www.zhihu.com/question/36882377/answer/3288717451';
    await context.route(destination, (route) => route.fulfill({ status: 200, body: 'bookmark destination' }));
    await page.goto('/favorites/');
    await page.waitForFunction(() => !document.documentElement.dataset.initialPageLoader);
    const blade = page.locator('[data-favorites-item][data-index="1"]');
    const popups: string[] = [];
    page.on('popup', (popup) => popups.push(popup.url()));

    await blade.tap();
    await expect(page.locator('[data-favorites-reel]')).toHaveAttribute('data-progress', '1.0000');
    expect(popups).toHaveLength(0);

    const popupPromise = page.waitForEvent('popup', { timeout: 2500 });
    await blade.tap();
    await expect(await popupPromise).toHaveURL(destination);
  });
});

test('the favorites reel selects a real link by wheel, drag, and keyboard', async ({ page }) => {
  await page.goto('/favorites/');
  const reel = page.locator('[data-favorites-reel]');
  const selected = page.locator('[data-favorites-selected]');
  const selectedBlade = page.locator('[data-favorites-item][data-selected="true"]');

  await expect(page.locator('[data-favorites-visit]')).toHaveCount(0);
  await expect(page.locator('[data-favorites-category]')).toHaveCount(0);
  await expect(page.locator('.favorites-actions button')).toHaveCount(1);
  await expect(page.locator('[data-favorites-random]')).toHaveText('试试手气');
  await expect(page.locator('[data-favorites-random] svg')).toHaveCount(0);

  await expect(selected).toHaveText('Human System Optimization');
  await reel.hover();
  await page.mouse.wheel(0, 110);
  await expect(reel).not.toBeFocused();
  await expect(selected).toHaveText('有趣的小物件');
  await expect(selectedBlade).toHaveAttribute('data-url', 'https://www.zhihu.com/question/36882377/answer/3288717451');

  const bounds = await reel.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2 - 90, { steps: 5 });
  await page.mouse.up();
  await expect(selected).toHaveText('修理手册');

  await reel.focus();
  await page.keyboard.press('ArrowDown');
  await expect(selected).toHaveText('全历史');
  await expect(selectedBlade).toHaveAttribute('aria-label', '访问 全历史');
});

test('selector arrows keep their screws fixed while following continuous reel motion', async ({ page }) => {
  await page.goto('/favorites/');
  await page.waitForFunction(() => !document.documentElement.dataset.initialPageLoader);
  const arrows = page.locator('[data-favorites-arrow]');
  await expect(arrows).toHaveCount(2);
  await expect(page.getByRole('button', { name: '上一个链接' })).toBeVisible();
  await expect(page.getByRole('button', { name: '下一个链接' })).toBeVisible();
  await expect(page.locator('.favorites-step')).toHaveCount(0);
  await expect(page.locator('[data-favorites-item] .favorites-reel__paddle')).toHaveCount(0);

  const screwPositions = await page.locator('.favorites-reel__paddle-screw').evaluateAll((screws) =>
    screws.map((screw) => {
      const { x, y } = screw.getBoundingClientRect();
      return { x, y };
    }));
  await page.locator('[data-favorites-reel]').dispatchEvent('keydown', { key: 'ArrowDown', bubbles: true });
  await page.waitForFunction(() => {
    const progress = Number(document.querySelector('[data-favorites-reel]')?.getAttribute('data-progress'));
    return progress > .15 && progress < .85;
  });
  const motion = await page.evaluate((before) => {
    const reel = document.querySelector('[data-favorites-reel]')!;
    const screws = Array.from(document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-screw'));
    const plates = Array.from(document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-plate'));
    return {
      fixed: screws.every((screw, index) => {
        const after = screw.getBoundingClientRect();
        return Math.abs(after.x - before[index].x) < 1 && Math.abs(after.y - before[index].y) < 1;
      }),
      angles: plates.map((plate) => getComputedStyle(plate).transform),
      bladeDuration: getComputedStyle(reel.querySelector<HTMLElement>('[data-favorites-item]')!).transitionDuration,
      selected: reel.querySelector('[data-favorites-item][data-index="1"]')?.getAttribute('data-selected')
    };
  }, screwPositions);
  expect(motion.fixed).toBe(true);
  expect(motion.selected).toBe('true');
  expect(motion.bladeDuration).toBe('0s');
  expect(motion.angles).toHaveLength(2);
  expect(motion.angles.every((angle) => angle !== 'matrix(1, 0, 0, 1, 0, 0)')).toBe(true);

  await page.getByRole('button', { name: '随机转一个链接' }).click();
  await page.waitForFunction(() => {
    const plate = document.querySelector<HTMLElement>('.favorites-reel__paddle-plate');
    return plate && getComputedStyle(plate).transform !== 'matrix(1, 0, 0, 1, 0, 0)';
  });
  expect(await page.locator('[data-favorites-reel]').getAttribute('data-progress')).not.toBe('0.0000');
});

test('reel keeps natural blade proportions and continuous coverage on desktop and phone', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/favorites/');
    const reel = page.locator('[data-favorites-reel]');
    await expect(reel.locator('[data-favorites-item][data-selected="true"]')).toBeVisible();
    await expect(reel).toHaveAttribute('data-progress', '0.0000');
    const measure = async () => page.evaluate(() => {
      const reel = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
      const selected = reel.querySelector<HTMLElement>('[data-favorites-item][data-selected="true"]')!;
      const bounds = reel.getBoundingClientRect();
      const blades = [...reel.querySelectorAll<HTMLElement>('[data-favorites-item]')]
        .filter((blade) => Number(getComputedStyle(blade).opacity) > .5)
        .map((blade) => blade.getBoundingClientRect())
        .filter((box) => box.bottom > bounds.top && box.top < bounds.bottom)
        .sort((a, b) => a.top - b.top);
      const gaps = blades.slice(1).map((box, index) => box.top - blades[index].bottom);
      return {
        bladeRatio: parseFloat(getComputedStyle(selected).width) / parseFloat(getComputedStyle(selected).height),
        coverageTop: blades[0].top - bounds.top,
        coverageBottom: bounds.bottom - blades.at(-1)!.bottom,
        largestGap: Math.max(...gaps),
        firstCenter: reel.querySelector<HTMLElement>('[data-favorites-item][data-index="0"]')!.getBoundingClientRect().y
      };
    });
    const still = await measure();
    expect(still.bladeRatio).toBeCloseTo(viewport.width < 1200 ? 866 / 149 : 1705 / 169, 1);
    expect(still.coverageTop).toBeLessThan(8);
    expect(still.coverageBottom).toBeLessThan(8);
    expect(still.largestGap).toBeLessThan(4);

    await page.getByRole('button', { name: '下一个链接' }).click();
    await page.waitForTimeout(135);
    const moving = await measure();
    expect(Math.abs(moving.firstCenter - still.firstCenter)).toBeGreaterThan(10);
    expect(moving.largestGap).toBeLessThan(4);
    await expect(page.locator('[data-favorites-selected]')).toHaveText('有趣的小物件');
  }
});

test('an interrupted random spin settles from its visible position', async ({ page }) => {
  await page.goto('/favorites/');
  await page.getByRole('button', { name: '随机转一个链接' }).click();
  await page.waitForTimeout(350);
  const { before, after } = await page.evaluate(() => {
    const reel = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
    const before = Number(reel.dataset.progress);
    document.querySelector<HTMLButtonElement>('[data-favorites-next]')!.click();
    return { before, after: Number(reel.dataset.progress) };
  });
  expect(Math.abs(before - Math.round(before))).toBeGreaterThan(.01);
  await expect(page.locator('[data-favorites-reel]')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-favorites-status]')).toContainText('已选中');
  expect(Math.abs(after - before)).toBeLessThan(1);
});

test('random spin lands on another saved link and reduced motion resolves immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/favorites/');
  const selected = page.locator('[data-favorites-selected]');
  await page.getByRole('button', { name: '随机转一个链接' }).click();
  await expect(selected).not.toHaveText('Human System Optimization');
  await expect(page.locator('[data-favorites-status]')).toContainText('已选中');
  await expect(page.locator('[data-favorites-item][data-selected="true"]')).toHaveAttribute('data-url', /^https:\/\//);
  expect(await page.locator('.favorites-reel__paddle-plate').first().evaluate((plate) => plate.getAnimations().length)).toBe(0);
});

test('random spin visibly turns and then settles on a different link', async ({ page }) => {
  await page.goto('/favorites/');
  const selected = page.locator('[data-favorites-selected]');
  const linkCount = await page.locator('[data-favorites-item]').count();
  await page.getByRole('button', { name: '随机转一个链接' }).click();
  await expect(page.locator('[data-favorites-status]')).toHaveText('正在随机转动…');
  await expect(page.locator('[data-favorites-status]')).toContainText('已选中', { timeout: Math.max(10000, linkCount * 150) });
  await expect(selected).not.toHaveText('Human System Optimization');
});

test('random spin cancels when the page becomes hidden', async ({ page }) => {
  await page.goto('/favorites/');
  await page.getByRole('button', { name: '随机转一个链接' }).click();
  await expect(page.locator('[data-favorites-reel]')).toHaveAttribute('aria-busy', 'true');
  const stillBusy = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    return document.querySelector('[data-favorites-reel]')?.getAttribute('aria-busy');
  });
  expect(stillBusy).toBeNull();
  const selected = await page.locator('[data-favorites-selected]').textContent();
  await page.waitForTimeout(1200);
  await expect(page.locator('[data-favorites-selected]')).toHaveText(selected ?? '');
});
