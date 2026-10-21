import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

const titles = [
  'FPGA-3DGS 渲染',
  'RoboMaster 步兵',
  '四旋翼无人机',
  '小车系列',
  '实验室文化墙',
  '装甲板钥匙扣',
  '轮腿步兵金属钥匙扣',
  'PCB 信仰尺',
  'USB3-Hub',
  '三年总结文档',
  'CoNet 在线笔记',
  '步兵完全手册',
  '涂装小老鼠',
  '纸模型作品',
  '个人网站'
];

test('showcase stacks fifteen works across shelves of five jars', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const showcase = page.locator('[data-project-showcase]');
  await expect(showcase.locator('[data-project-shelf]')).toHaveCount(3);
  await expect(showcase.locator('[data-project-badge]')).toHaveCount(15);
  await expect(showcase.locator('[data-empty-mount]')).toHaveCount(0);
  for (const [shelf, count] of [5, 5, 5].entries()) {
    await expect(showcase.locator('[data-project-shelf]').nth(shelf).locator('[data-project-badge]')).toHaveCount(count);
  }
  expect(await showcase.evaluate((element) => {
    const first = element.querySelector('[data-project-shelf]:first-child [data-project-badge]');
    const last = element.querySelectorAll('[data-project-shelf]')[2]?.querySelector('[data-project-badge]');
    if (!first || !last) return Infinity;
    return Math.abs(first.getBoundingClientRect().left - last.getBoundingClientRect().left);
  })).toBeLessThan(1);
  expect(await showcase.locator('.showcase-badge-name').allTextContents()).toEqual(titles);
  await expect(showcase.locator('.showcase-badge-art img')).toHaveCount(15);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(900);
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('showcase text stays unselected and its images cannot be dragged', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const showcase = page.locator('[data-project-showcase]');
  expect(await showcase.locator('img').evaluateAll((images) => images.every((image) => !(image as HTMLImageElement).draggable))).toBe(true);

  await showcase.locator('[data-project-badge="3"]').click();
  await showcase.locator('[data-detail-panel][data-ready]').waitFor();
  const intro = showcase.locator('[data-project-detail="3"] [data-project-intro]');
  const bounds = await intro.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + 20, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width - 20, bounds!.y + bounds!.height / 2, { steps: 15 });
  await page.mouse.up();
  expect(await page.evaluate(() => getSelection()?.toString())).toBe('');
});

test('project details open on selection without occupying shelf layout', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const showcase = page.locator('[data-project-showcase]');
  const dialog = showcase.locator('[data-detail-panel]');
  await expect(dialog).toBeHidden();
  const badge = showcase.locator('[data-project-badge="2"]');
  await badge.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-label', `作品详情：${titles[2]}`);
  await expect(dialog.locator('[data-project-detail="2"]')).toContainText(titles[2]);
  await expect(dialog.locator('[data-project-detail="2"] [data-project-intro]')).toHaveText('花了一个下午攒出来的小飞机，无自研成分。');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(badge).toBeFocused();
});

test('selected jar enlarges to the left before showing its compact introduction', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const badge = page.locator('[data-project-badge="2"]');
  const source = await badge.locator('.showcase-vessel').boundingBox();
  await badge.click();
  const dialog = page.locator('[data-detail-panel]');
  const vessel = dialog.locator('[data-project-detail="2"] [data-expanded-vessel]');
  const card = dialog.locator('[data-project-detail="2"] [data-info-card]');
  await expect(vessel).toBeVisible();
  await expect(card).toBeVisible();
  await expect.poll(async () => (await vessel.boundingBox())?.width ?? 0).toBeGreaterThan(source!.width * 1.5);
  const enlarged = await vessel.boundingBox();
  expect(enlarged!.x + enlarged!.width / 2).toBeLessThan(720);
  await expect(card.locator('[data-project-intro]')).toHaveText('花了一个下午攒出来的小飞机，无自研成分。');
  expect(await card.locator('[data-project-intro]').evaluate((element) => Array.from(element.textContent || '').length)).toBeLessThanOrEqual(100);
  await expect(dialog).toHaveAttribute('data-ready', '');
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  expect(await dialog.evaluate((element) => getComputedStyle(element, '::backdrop').backgroundColor)).toContain('0.78');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveAttribute('data-closing', '');
  await expect(dialog).toBeHidden();
});

test('mobile shelves remain scrollable and details open with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/creation/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const showcase = page.locator('[data-project-showcase]');
  const firstShelf = showcase.locator('.showcase-shelf-scroll').first();
  expect(await firstShelf.evaluate((element) => element.scrollWidth)).toBeGreaterThan(await firstShelf.evaluate((element) => element.clientWidth));
  await showcase.locator('[data-project-badge="4"]').click();
  await expect(showcase.locator('[data-project-detail="4"]')).toContainText(titles[4]);
  await expect(showcase.locator('[data-detail-panel]')).toBeVisible();
  await expect(showcase.locator('[data-project-detail="4"] [data-info-card]')).toHaveCSS('opacity', '1');
  expect(await showcase.locator('[data-project-detail="4"] [data-expanded-vessel]').evaluate((element) => element.getAnimations().length)).toBe(0);
  await showcase.locator('[data-project-detail="4"] [data-info-card]').click();
  await expect(showcase.locator('[data-detail-panel]')).toBeHidden();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});

test('turning on reduced motion during enlargement reveals the final state', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await page.locator('[data-project-badge="0"]').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const dialog = page.locator('[data-detail-panel]');
  await expect(dialog.locator('[data-project-detail="0"] [data-info-card]')).toHaveCSS('opacity', '1');
  expect(await dialog.locator('[data-project-detail="0"] [data-expanded-vessel]').evaluate((element) => element.getAnimations().length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('closing during enlargement keeps the backdrop opacity continuous', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const opacity = await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>('[data-project-badge="0"]')!.click();
    await new Promise((resolve) => window.setTimeout(resolve, 90));
    const dialog = document.querySelector<HTMLDialogElement>('[data-detail-panel]')!;
    const backdropAlpha = () => Number(getComputedStyle(dialog, '::backdrop').backgroundColor.match(/[\d.]+(?=\))/)?.[0] ?? 0);
    const before = backdropAlpha();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    return { before, after: backdropAlpha() };
  });
  expect(opacity.after).toBeLessThanOrEqual(opacity.before + 0.12);
  await expect(page.locator('[data-detail-panel]')).toBeHidden();
  await expect(page.locator('[data-project-badge="0"]')).toBeFocused();
});

test('hiding the page during enlargement settles the dialog and carousel', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>('[data-project-badge="0"]')!.click();
    document.querySelector<HTMLElement>('[data-project-detail="0"] [data-carousel-viewport]')!.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 240, bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => window.setTimeout(resolve, 70));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const dialog = page.locator('[data-detail-panel]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-ready', '');
  await expect(dialog.locator('[data-project-detail="0"] [data-info-card]')).toHaveCSS('opacity', '1');
  await expect(dialog.locator('[data-project-detail="0"] [data-project-carousel]')).not.toHaveAttribute('data-carousel-moving', '');
  await expect(dialog.locator('[data-project-detail="0"] [data-carousel-counter]')).toHaveText('02 / 03');
  expect(await dialog.locator('[data-project-detail="0"] [data-expanded-vessel]').evaluate((element) =>
    new DOMMatrixReadOnly(getComputedStyle(element).transform).a
  )).toBe(1);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
});

test('closing after an interrupted opening starts from the settled detail', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>('[data-project-badge="0"]')!.click();
    await new Promise((resolve) => window.setTimeout(resolve, 70));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const state = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>('[data-detail-panel]')!;
    const vessel = dialog.querySelector<HTMLElement>('[data-expanded-vessel]')!;
    const card = dialog.querySelector<HTMLElement>('[data-info-card]')!;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    return {
      scale: new DOMMatrixReadOnly(getComputedStyle(vessel).transform).a,
      cardOpacity: Number(getComputedStyle(card).opacity)
    };
  });
  expect(state.scale).toBeCloseTo(1, 1);
  expect(state.cardOpacity).toBeGreaterThan(0.95);
  await expect(page.locator('[data-detail-panel]')).toBeHidden();
});

test('hiding the page during return closes the dialog and restores focus', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const badge = page.locator('[data-project-badge="0"]');
  await badge.click();
  await expect(page.locator('[data-detail-panel]')).toHaveAttribute('data-ready', '');
  await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>('[data-detail-panel]')!;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('[data-detail-panel]')).toBeHidden();
  await expect(badge).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});

test('keyboard opens details and returns focus to the same jar', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const showcase = page.locator('[data-project-showcase]');
  const badge = showcase.locator('[data-project-badge="4"]');
  await badge.focus();
  await page.keyboard.press('Enter');
  await expect(showcase.locator('[data-detail-panel]')).toBeVisible();
  await expect(showcase.locator('[data-detail-panel]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(badge).toBeFocused();
});

test('rapid reopening starts a fresh enlargement', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const badge = page.locator('[data-project-badge="2"]');
  await badge.click();
  await expect(page.locator('[data-project-detail="2"] [data-info-card]')).toHaveCSS('opacity', '1');
  await page.evaluate(() => {
    document.querySelector<HTMLDialogElement>('[data-detail-panel]')!.close();
    document.querySelector<HTMLButtonElement>('[data-project-badge="2"]')!.click();
  });
  await page.waitForTimeout(50);
  const dialog = page.locator('[data-detail-panel]');
  await expect(dialog).not.toHaveAttribute('data-ready', '');
  expect(await dialog.locator('[data-project-detail="2"] [data-expanded-vessel]').evaluate((element) =>
    new DOMMatrixReadOnly(getComputedStyle(element).transform).a
  )).toBeLessThan(1);
  await expect(dialog).toHaveAttribute('data-ready', '');
});

test('selection has no extra jar glow and the card enters from the left', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await page.locator('[data-project-badge="2"]').click();
  const filters = await page.evaluate(() => ({
    selected: getComputedStyle(document.querySelector<HTMLElement>('[data-project-badge="2"] .showcase-vessel')!).filter,
    other: getComputedStyle(document.querySelector<HTMLElement>('[data-project-badge="1"] .showcase-vessel')!).filter
  }));
  expect(filters.selected).toBe(filters.other);
  const card = page.locator('[data-project-detail="2"] [data-info-card]');
  expect(await card.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)).toBeLessThan(0);
});

test('jar glow appears on hover and clears when the pointer leaves', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const badge = page.locator('[data-project-badge="2"]');
  const vessel = badge.locator('.showcase-vessel');
  const resting = await vessel.evaluate((element) => getComputedStyle(element).filter);
  await badge.hover();
  await expect.poll(() => vessel.evaluate((element) => getComputedStyle(element).filter)).toContain('0px 0px 13px');
  await page.mouse.move(0, 400);
  await expect.poll(() => vessel.evaluate((element) => getComputedStyle(element).filter)).toBe(resting);
});

test('any click closes the enlargement and wheel input cannot scroll the shelves behind it', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  const badge = page.locator('[data-project-badge="2"]');
  const dialog = page.locator('[data-detail-panel]');
  await badge.click();
  await expect(dialog.locator('[data-close-detail]')).toHaveCount(0);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 650);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await dialog.locator('[data-project-detail="2"] [data-info-card]').click();
  await expect(dialog).toBeHidden();
  await badge.click();
  await dialog.locator('[data-project-detail="2"] [data-expanded-vessel]').click();
  await expect(dialog).toBeHidden();
  await badge.click();
  await page.mouse.click(5, 300);
  await expect(dialog).toBeHidden();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
});

test('the larger detail card keeps a 16:9 media window and readable copy', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await page.locator('[data-project-badge="1"]').click();
  const card = page.locator('[data-project-detail="1"] [data-info-card]');
  await expect.poll(async () => (await card.boundingBox())?.width ?? 0).toBeGreaterThan(620);
  const media = await card.locator('[data-project-carousel]').boundingBox();
  expect(media!.width / media!.height).toBeCloseTo(16 / 9, 1);
  expect(await card.locator('[data-project-intro]').evaluate((element) => getComputedStyle(element).paddingLeft)).not.toBe('2px');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileMedia = await card.locator('[data-project-carousel]').boundingBox();
  expect(mobileMedia!.width / mobileMedia!.height).toBeCloseTo(16 / 9, 1);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});

test('portrait project photos fit inside the carousel window', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await page.locator('[data-project-badge="0"]').click();
  const media = page.locator('[data-project-detail="0"] [data-project-carousel]');
  const portrait = media.locator('[data-carousel-slide] img').nth(1);
  await portrait.evaluate((image: HTMLImageElement) => image.decode());
  const windowHeight = await media.locator('[data-carousel-viewport]').evaluate((window) => window.getBoundingClientRect().height);
  const imageHeight = await portrait.evaluate((image) => image.getBoundingClientRect().height);
  expect(imageHeight).toBeLessThanOrEqual(windowHeight);
});

test('project carousel exposes subdued neighboring photos without a visible counter or backing panel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await page.locator('[data-project-badge="0"]').click();
  const media = page.locator('[data-project-detail="0"] [data-project-carousel]');
  const previews = await media.evaluate((root) => {
    const viewport = root.querySelector<HTMLElement>('[data-carousel-viewport]')!;
    const active = root.querySelector<HTMLElement>('[data-carousel-slide]')!;
    const previous = active.previousElementSibling as HTMLElement;
    const next = active.nextElementSibling as HTMLElement;
    const frame = viewport.getBoundingClientRect();
    const visibleWidth = (slide: HTMLElement) => {
      const bounds = slide.getBoundingClientRect();
      return Math.max(0, Math.min(bounds.right, frame.right) - Math.max(bounds.left, frame.left));
    };
    return {
      previousWidth: visibleWidth(previous),
      nextWidth: visibleWidth(next),
      activeCardWidth: active.getBoundingClientRect().width,
      previousCardWidth: previous.getBoundingClientRect().width,
      nextCardWidth: next.getBoundingClientRect().width,
      previousOpacity: Number(getComputedStyle(previous).opacity),
      nextOpacity: Number(getComputedStyle(next).opacity),
      background: getComputedStyle(root).backgroundImage
    };
  });
  expect(previews.previousWidth).toBeGreaterThan(24);
  expect(previews.nextWidth).toBeGreaterThan(24);
  expect(previews.previousCardWidth).toBeLessThan(previews.activeCardWidth * 0.7);
  expect(previews.nextCardWidth).toBeLessThan(previews.activeCardWidth * 0.7);
  expect(previews.previousOpacity).toBeLessThan(0.8);
  expect(previews.nextOpacity).toBeLessThan(0.8);
  expect(previews.background).toBe('none');
  await expect(media.locator('[data-carousel-counter]')).toHaveClass(/visually-hidden/);
});

test('project photos sit inside the mechanical card opening', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await page.locator('[data-project-badge="0"]').click();
  const card = await page.locator('[data-project-detail="0"] [data-info-card]').boundingBox();
  const media = await page.locator('[data-project-detail="0"] [data-project-carousel]').boundingBox();
  expect(media!.x - card!.x).toBeGreaterThanOrEqual(62);
  expect(media!.y - card!.y).toBeGreaterThanOrEqual(66);
});

test('small wheel deltas move the coverflow proportionally without visible controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await page.locator('[data-project-badge="0"]').click();
  const media = page.locator('[data-project-detail="0"] [data-project-carousel]');
  await expect(media.locator('[data-carousel-prev], [data-carousel-next]')).toHaveCount(0);
  const active = media.locator('[data-carousel-slide]').first();
  const x = () => active.evaluate((slide) => slide.getBoundingClientRect().x);
  const start = await x();
  const box = await media.locator('[data-carousel-viewport]').boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 60);
  const first = await x();
  await page.mouse.wheel(0, 60);
  const second = await x();
  expect(start - first).toBeGreaterThan(8);
  expect(start - first).toBeLessThan(100);
  expect(first - second).toBeGreaterThan(8);
  expect(Math.abs((start - first) - (first - second))).toBeLessThan(8);
  await page.mouse.wheel(0, -30);
  expect(await x()).toBeGreaterThan(second);
  await expect(media).not.toHaveAttribute('data-carousel-moving', '');
});

test('wheel motion settles on a single centered photo after input stops', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await page.locator('[data-project-badge="0"]').click();
  const media = page.locator('[data-project-detail="0"] [data-project-carousel]');
  const viewport = media.locator('[data-carousel-viewport]');
  const centerError = (index: number) => media.locator('[data-carousel-slide]').nth(index).evaluate((slide) => {
    const photo = slide.getBoundingClientRect();
    const window = slide.closest('[data-carousel-viewport]')!.getBoundingClientRect();
    return Math.abs((photo.left + photo.right - window.left - window.right) / 2);
  });
  const box = await viewport.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => centerError(1)).toBeLessThan(1);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => centerError(0)).toBeLessThan(1);
});

test('wheel, drag, and keyboard cycle local project images without closing the detail', async ({ page }) => {
  await page.goto('/creation/');
  await page.locator('#page-loader').waitFor({ state: 'hidden' });
  await expect(page.locator('[data-project-carousel]')).toHaveCount(await page.locator('[data-project-badge]').count());
  await page.locator('[data-project-badge="0"]').click();
  const dialog = page.locator('[data-detail-panel]');
  const media = dialog.locator('[data-project-detail="0"] [data-project-carousel]');
  const counter = media.locator('[data-carousel-counter]');
  const viewport = media.locator('[data-carousel-viewport]');
  const box = await viewport.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, 240);
  await expect(counter).toHaveText('02 / 03');
  await expect(media).not.toHaveAttribute('data-carousel-moving', '');
  await page.mouse.wheel(0, 480);
  await expect(counter).toHaveText('01 / 03');
  await expect(media).not.toHaveAttribute('data-carousel-moving', '');
  await page.mouse.wheel(0, -240);
  await expect(counter).toHaveText('03 / 03');
  await expect(media).not.toHaveAttribute('data-carousel-moving', '');
  await page.mouse.wheel(0, 240);
  await expect(counter).toHaveText('01 / 03');
  await expect(media).not.toHaveAttribute('data-carousel-moving', '');
  await page.mouse.move(box!.x + box!.width * .7, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * .2, box!.y + box!.height / 2);
  await page.mouse.up();
  await expect(counter).toHaveText('02 / 03');
  await expect(media).not.toHaveAttribute('data-carousel-moving', '');
  await expect(dialog).toBeVisible();
  expect(await media.locator('[data-carousel-slide] img').first().evaluate((element) => getComputedStyle(element).objectFit)).toBe('contain');
  await viewport.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText('01 / 03');
  await expect(media).not.toHaveAttribute('data-carousel-moving', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText('03 / 03');
});
