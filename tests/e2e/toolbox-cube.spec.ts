import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.tool-deck { animation: none !important; transform: none !important; }';
      document.head.append(style);
    }, { once: true });
  });
});

const warmPixelRatio = async (image: Buffer) => {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  let warmPixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const [red, green, blue] = data.subarray(offset, offset + 3);
    if (red > 18 && red > blue * 1.55 && green > blue * 1.25) warmPixels++;
  }
  return warmPixels / (info.width * info.height);
};

test('hover lifts one cube and leaving the tray returns it to its socket', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/toolbox/');
  await page.addStyleTag({ content: '[data-magnetic-frame] { display: none !important; } .tool-deck { animation: none !important; transform: none !important; }' });

  const triggers = page.locator('[data-cube-trigger]');
  const canvas = page.locator('[data-cube-preview] [data-cube-canvas]');
  await expect(triggers.first()).toBeEnabled();
  await page.waitForFunction(() => !document.querySelector('#page-loader')?.classList.contains('pl-visible'));
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const capture = () => page.screenshot({ clip: box! });
  const changedPixels = async (before: Buffer, after: Buffer) => {
    const first = await sharp(before).raw().toBuffer();
    const second = await sharp(after).raw().toBuffer();
    let changed = 0;
    for (let pixel = 0; pixel < first.length; pixel += 4) {
      if (Math.max(...[0, 1, 2].map((channel) =>
        Math.abs(first[pixel + channel] - second[pixel + channel])
      )) > 5) changed++;
    }
    return changed;
  };
  const moveToTrigger = async (index: number) => {
    const triggerBox = await triggers.nth(index).boundingBox();
    expect(triggerBox).not.toBeNull();
    await page.mouse.move(
      triggerBox!.x + triggerBox!.width / 2,
      triggerBox!.y + triggerBox!.height / 2
    );
  };
  const atRest = await capture();
  await expect(page.locator('.tool-deck__image')).toHaveCSS('visibility', 'hidden');
  const { data: restPixels, info: restInfo } = await sharp(atRest).raw().toBuffer({ resolveWithObject: true });
  const railPixel = (Math.round(restInfo.height * 0.1) * restInfo.width + Math.round(restInfo.width * 0.5)) * restInfo.channels;
  expect(Math.max(...restPixels.subarray(railPixel, railPixel + 3))).toBeGreaterThan(40);

  await moveToTrigger(0);
  await page.waitForTimeout(280);
  const firstLifted = await capture();
  expect(await changedPixels(atRest, firstLifted)).toBeGreaterThan(200);

  await moveToTrigger(1);
  await page.waitForTimeout(280);
  const secondLifted = await capture();
  expect(await changedPixels(firstLifted, secondLifted)).toBeGreaterThan(200);

  await page.mouse.move(0, 0);
  await page.waitForTimeout(220);
  expect(await changedPixels(atRest, await capture())).toBeLessThan(10);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(80);
  const motionRest = await capture();
  await moveToTrigger(0);
  await page.waitForTimeout(70);
  expect(await changedPixels(motionRest, await capture())).toBeGreaterThan(50);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(220);
  expect(await changedPixels(motionRest, await capture())).toBeLessThan(10);
});

test('touching a cube does not leave a hover lift behind', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce'
  });
  try {
    const page = await context.newPage();
    await page.goto('/toolbox/');
    await page.addStyleTag({ content: '[data-magnetic-frame] { display: none !important; }' });
    const trigger = page.locator('[data-cube-trigger]').first();
    await expect(trigger).toBeEnabled();
    await page.waitForFunction(() => !document.querySelector('#page-loader')?.classList.contains('pl-visible'));
    const canvas = page.locator('[data-cube-preview] [data-cube-canvas]');
    const canvasBox = await canvas.boundingBox();
    const triggerBox = await trigger.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(triggerBox).not.toBeNull();
    const capture = () => page.screenshot({ clip: canvasBox! });
    const atRest = await capture();
    const cdp = await context.newCDPSession(page);
    const x = triggerBox!.x + triggerBox!.width / 2;
    const y = triggerBox!.y + triggerBox!.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await page.waitForTimeout(100);
    expect((await capture()).equals(atRest)).toBe(true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await context.close();
  }
});

test('loading state does not expose an amber panel through the toolbox opening', async ({ page }) => {
  const centerClip = (box: { x: number; y: number; width: number; height: number }) => ({
    x: box.x + box.width * 0.44,
    y: box.y + box.height * 0.38,
    width: box.width * 0.12,
    height: box.height * 0.16
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/assets/toolbox/*.glb*', (route) => route.abort());
  await page.goto('/toolbox/');
  const deck = page.locator('[data-tool-deck]');
  const failedRoot = page.locator('[data-tool-cube]');
  await expect(failedRoot).toHaveAttribute('data-cube-error', '');
  await page.waitForFunction(() => !document.querySelector('#page-loader')?.classList.contains('pl-visible'));
  const loadingBox = await deck.boundingBox();
  expect(loadingBox).not.toBeNull();
  expect(await warmPixelRatio(await page.screenshot({ clip: centerClip(loadingBox!) }))).toBeLessThan(0.1);
});

test('inspection shows only the cube over a dimmed page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/toolbox/');
  await page.getByRole('button', { name: '放大查看 VS Code 方块' }).click();

  const dialog = page.getByRole('dialog', { name: 'VS Code 方块预览' });
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).toEqual({ x: 0, y: 0, width: viewport!.width, height: viewport!.height });
  const surface = await dialog.evaluate((element) => {
    const panel = getComputedStyle(element);
    const backdrop = getComputedStyle(element, '::backdrop');
    return {
      background: panel.backgroundColor,
      border: panel.borderTopWidth,
      shadow: panel.boxShadow,
      padding: panel.paddingTop,
      backdrop: backdrop.backgroundColor,
      backdropFilter: backdrop.backdropFilter
    };
  });

  expect(surface).toEqual({
    background: 'rgba(0, 0, 0, 0)',
    border: '0px',
    shadow: 'none',
    padding: '0px',
    backdrop: 'rgba(3, 5, 9, 0.62)',
    backdropFilter: 'none'
  });
});

test('return animation restores the page brightness with the cube movement', async ({ page }) => {
  const backdropAlpha = () => page.locator('[data-cube-dialog]').evaluate((dialog) => {
    const color = getComputedStyle(dialog, '::backdrop').backgroundColor;
    const channels = color.match(/[\d.]+/g)?.map(Number) ?? [];
    return channels.length > 3 ? channels[3] : 1;
  });

  await page.goto('/toolbox/');
  const root = page.locator('[data-tool-cube]');
  const cube = page.getByRole('button', { name: '放大查看 VS Code 方块' });
  await cube.click();
  await expect(root).not.toHaveAttribute('data-cube-transitioning', '');
  expect(await backdropAlpha()).toBeCloseTo(0.62, 2);

  await page.mouse.click(4, 4);
  await expect(root).toHaveAttribute('data-cube-transitioning', '');
  await page.waitForTimeout(100);
  const returningAlpha = await backdropAlpha();
  expect(returningAlpha).toBeGreaterThan(0);
  expect(returningAlpha).toBeLessThan(0.55);
  await expect(page.getByRole('dialog', { name: 'VS Code 方块预览' })).not.toBeVisible();
});

test('return animation reveals the toolbox contents behind the returning cube', async ({ page }) => {
  await page.goto('/toolbox/');
  const root = page.locator('[data-tool-cube]');
  const cube = page.getByRole('button', { name: '放大查看 VS Code 方块' });
  const snapshot = page.locator('[data-cube-preview-snapshot]');
  await cube.click();
  await expect(root).not.toHaveAttribute('data-cube-transitioning', '');

  await page.mouse.click(4, 4);
  await expect(root).toHaveAttribute('data-cube-transitioning', '');
  await page.waitForTimeout(100);
  await expect(snapshot).toBeVisible();
  const opacity = Number(await snapshot.evaluate((canvas) => getComputedStyle(canvas).opacity));
  expect(opacity).toBeGreaterThan(0);
  expect(opacity).toBeLessThan(1);

  const dataUrl = await snapshot.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const image = Buffer.from(dataUrl.split(',')[1], 'base64');
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visiblePixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset + 3] > 20 && Math.max(data[offset], data[offset + 1], data[offset + 2]) > 20) {
      visiblePixels++;
    }
  }
  expect(visiblePixels).toBeGreaterThan(5_000);
  await expect(page.getByRole('dialog', { name: 'VS Code 方块预览' })).not.toBeVisible();
});

test('the enlarged cube keeps comfortable space around itself', async ({ page }) => {
  await page.goto('/toolbox/');
  await page.getByRole('button', { name: '放大查看 VS Code 方块' }).click();

  const root = page.locator('[data-tool-cube]');
  await expect(root).not.toHaveAttribute('data-cube-transitioning', '');
  const canvas = page.locator('[data-cube-dialog] canvas');
  const first = await sharp(await canvas.screenshot()).raw().toBuffer({ resolveWithObject: true });
  await page.waitForTimeout(400);
  const second = await sharp(await canvas.screenshot()).raw().toBuffer();
  const { data, info } = first;
  let top = info.height;
  let bottom = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * info.channels;
      const changed = Math.max(...[0, 1, 2].map((channel) =>
        Math.abs(data[offset + channel] - second[offset + channel])
      ));
      if (changed > 8) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  expect(bottom - top).toBeGreaterThan(info.height * 0.18);
  expect(bottom - top).toBeLessThan(info.height * 0.5);
});

test('tool cube opens for inspection and returns focus on Escape', async ({ page }) => {
  await page.goto('/toolbox/');

  const root = page.locator('[data-tool-cube]');
  const cube = page.getByRole('button', { name: '放大查看 VS Code 方块' });
  await expect(cube).toBeVisible();
  await cube.click();

  const inspection = page.getByRole('dialog', { name: 'VS Code 方块预览' });
  await expect(inspection).toBeVisible();
  await expect(inspection.locator('canvas')).toBeVisible();
  await expect(root).not.toHaveAttribute('data-cube-transitioning', '');
  await page.keyboard.press('Escape');

  await expect(inspection).toBeVisible();
  await expect(root).toHaveAttribute('data-cube-transitioning', '');
  await expect(inspection).not.toBeVisible();
  await expect(cube).toBeFocused();

  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '收藏夹' }).click();
  await expect(page).toHaveURL(/\/favorites\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/toolbox\/$/);
  await expect(page.getByRole('button', { name: '放大查看 VS Code 方块' })).toBeEnabled();
  await page.getByRole('button', { name: '放大查看 VS Code 方块' }).dispatchEvent('click');
  await expect(page.getByRole('dialog', { name: 'VS Code 方块预览' })).toBeVisible();
});

test('dragging beyond the former panel edge stays enlarged until a separate short click', async ({ page }) => {
  await page.goto('/toolbox/');
  const root = page.locator('[data-tool-cube]');
  const cube = page.getByRole('button', { name: '放大查看 VS Code 方块' });
  await cube.click();
  const inspection = page.getByRole('dialog', { name: 'VS Code 方块预览' });
  const canvas = inspection.locator('canvas');
  await expect(root).not.toHaveAttribute('data-cube-transitioning', '');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(4, 4, { steps: 12 });
  await page.mouse.up();
  await expect(inspection).toBeVisible();

  await page.mouse.click(4, 4);
  await expect(inspection).toBeVisible();
  await expect(root).toHaveAttribute('data-cube-transitioning', '');
  await expect(inspection).not.toBeVisible();
});

test('the clicked cube travels into an uncluttered inspection view', async ({ page }) => {
  await page.goto('/toolbox/');

  const root = page.locator('[data-tool-cube]');
  const cube = page.getByRole('button', { name: '放大查看 VS Code 方块' });
  await expect(cube).toBeEnabled();
  await cube.click();
  const inspection = page.getByRole('dialog', { name: 'VS Code 方块预览' });

  await expect(inspection).toBeVisible();
  await expect(inspection.getByRole('button')).toHaveCount(0);
  await expect(inspection).not.toContainText('拖动全方位旋转');
  await expect(root).toHaveAttribute('data-cube-transitioning', '');
  await expect(root).not.toHaveAttribute('data-cube-transitioning', '');
});

test('inspection shows the selected software name and one-sentence summary', async ({ page }) => {
  await page.goto('/toolbox/');
  const cube = page.getByRole('button', { name: '放大查看 CLion 方块' });
  await expect(cube).toBeEnabled();
  await cube.click();

  const inspection = page.getByRole('dialog', { name: 'CLion 方块预览' });
  await expect(inspection).toBeVisible();
  await expect(inspection.locator('[data-cube-name]')).toHaveText('CLion');
  await expect(inspection.locator('[data-cube-description]')).toHaveText('编写、调试 C/C++ 项目并管理构建');
});

test('the cube resumes its own rotation immediately after a drag', async ({ page }) => {
  await page.goto('/toolbox/');
  const cube = page.getByRole('button', { name: '放大查看 VS Code 方块' });
  await expect(cube).toBeEnabled();
  await cube.click();

  const root = page.locator('[data-tool-cube]');
  await expect(root).not.toHaveAttribute('data-cube-transitioning', '');
  const canvas = page.locator('[data-cube-dialog] canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 140, y + 50, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const first = await canvas.screenshot();
  await page.waitForTimeout(250);
  const second = await canvas.screenshot();
  const before = await sharp(first).raw().toBuffer();
  const after = await sharp(second).raw().toBuffer();
  let changedChannels = 0;
  for (let index = 0; index < before.length; index++) {
    if (Math.abs(before[index] - after[index]) > 5) changedChannels++;
  }

  expect(changedChannels).toBeGreaterThan(200_000);
});

test('drag rotates the cube while reduced motion keeps it still at rest', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/toolbox/');
  await page.getByRole('button', { name: '放大查看 VS Code 方块' }).click();

  const canvas = page.locator('[data-cube-dialog] canvas');
  await expect(canvas).toBeVisible();
  const atRest = await canvas.screenshot();
  await page.waitForTimeout(220);
  expect((await canvas.screenshot()).equals(atRest)).toBe(true);

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 42, y + 14, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const before = await sharp(atRest).raw().toBuffer();
  const after = await sharp(await canvas.screenshot()).raw().toBuffer();
  let changedChannels = 0;
  for (let index = 0; index < before.length; index++) {
    if (Math.abs(before[index] - after[index]) > 5) changedChannels++;
  }
  expect(changedChannels).toBeGreaterThan(200_000);
});

test('vertical drags keep rotating the cube past the top pole', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/toolbox/');
  await page.getByRole('button', { name: '放大查看 VS Code 方块' }).click();

  const canvas = page.locator('[data-cube-dialog] canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  const dragUp = async () => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - box!.height * 0.4, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(600);
  };

  await dragUp();
  const firstRotation = await canvas.screenshot();
  await dragUp();
  expect((await canvas.screenshot()).equals(firstRotation)).toBe(false);
});

test('wheel and arrow keys leave the enlarged cube at a fixed size and angle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/toolbox/');
  await page.getByRole('button', { name: '放大查看 VS Code 方块' }).click();

  const canvas = page.locator('[data-cube-dialog] canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const cubeClip = {
    x: box!.x + box!.width / 4,
    y: box!.y + box!.height / 4,
    width: box!.width / 2,
    height: box!.height / 2
  };
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  const initial = await page.screenshot({ clip: cubeClip });
  await page.mouse.wheel(0, -480);
  await page.waitForTimeout(250);
  expect((await page.screenshot({ clip: cubeClip })).equals(initial)).toBe(true);

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  expect((await page.screenshot({ clip: cubeClip })).equals(initial)).toBe(true);
});

test('a short click over a background link closes the cube without activating the link', async ({ page }) => {
  await page.goto('/toolbox/');
  const root = page.locator('[data-tool-cube]');
  await page.getByRole('button', { name: '放大查看 VS Code 方块' }).click();
  await expect(root).not.toHaveAttribute('data-cube-transitioning', '');

  const dialog = page.getByRole('dialog', { name: 'VS Code 方块预览' });
  const backgroundLink = page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '收藏夹' });
  const box = await backgroundLink.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  expect(await backgroundLink.evaluate((link) => link.matches(':hover'))).toBe(false);
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 650);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/toolbox\/$/);
});

test('touch drags rotate the cube without allowing pinch zoom', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce'
  });
  try {
    const page = await context.newPage();
    await page.goto('/toolbox/');
    await page.getByRole('button', { name: '放大查看 VS Code 方块' }).click();
    const canvas = page.locator('[data-cube-dialog] canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const { data: initialPixels, info: initialInfo } = await sharp(await canvas.screenshot())
      .raw().toBuffer({ resolveWithObject: true });
    let brightEdgePixels = 0;
    for (let row = 0; row < initialInfo.height; row++) {
      for (const column of [0, 1, 2, initialInfo.width - 3, initialInfo.width - 2, initialInfo.width - 1]) {
        const offset = (row * initialInfo.width + column) * initialInfo.channels;
        if (Math.max(initialPixels[offset], initialPixels[offset + 1], initialPixels[offset + 2]) > 100) {
          brightEdgePixels++;
        }
      }
    }
    expect(brightEdgePixels).toBe(0);
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const clip = { x: x - 70, y: y - 70, width: 140, height: 140 };
    const initial = await page.screenshot({ clip });
    const cdp = await context.newCDPSession(page);

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: x + step * 12, y: y + step * 5, id: 1 }]
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    const rotated = await page.screenshot({ clip });
    expect(rotated.equals(initial)).toBe(false);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }]
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x - 90, y, id: 1 }, { x: x + 90, y, id: 2 }]
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    const beforePinch = await sharp(rotated).raw().toBuffer();
    const afterPinch = await sharp(await page.screenshot({ clip })).raw().toBuffer();
    let changedChannels = 0;
    for (let index = 0; index < beforePinch.length; index++) {
      if (Math.abs(beforePinch[index] - afterPinch[index]) > 5) changedChannels++;
    }
    expect(changedChannels).toBeLessThan(50);
  } finally {
    await context.close();
  }
});

test('the cube stays visible after dragging and closing the inspection view', async ({ page }) => {
  await page.goto('/toolbox/');
  const preview = page.locator('[data-cube-preview] [data-cube-canvas]');
  const visibleCubePixels = async () => {
    const { data, info } = await sharp(await preview.screenshot()).raw().toBuffer({ resolveWithObject: true });
    let count = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (Math.max(data[i], data[i + 1], data[i + 2]) > 170) count++;
    }
    return count;
  };

  await expect.poll(visibleCubePixels).toBeGreaterThan(1000);
  await page.getByRole('button', { name: '放大查看 VS Code 方块' }).click();
  const canvas = page.locator('[data-cube-dialog] canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 260, y + 170, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.press('Escape');

  await expect(preview).toBeVisible();
  await expect.poll(visibleCubePixels).toBeGreaterThan(1000);
});

test('touch drag can be closed and returns the cube to its preview', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce'
  });
  try {
    const page = await context.newPage();
    await page.goto('/toolbox/');
    await page.getByRole('button', { name: '放大查看 VS Code 方块' }).tap();
    const dialog = page.getByRole('dialog', { name: 'VS Code 方块预览' });
    const box = await dialog.locator('canvas').boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: x + step * 14, y: y + step * 8, id: 1 }]
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.touchscreen.tap(3, 3);

    await expect(dialog).not.toBeVisible();
    await expect(page.locator('[data-cube-preview] [data-cube-canvas]')).toBeVisible();
  } finally {
    await context.close();
  }
});
