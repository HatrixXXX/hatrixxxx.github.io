import { expect, test } from '@playwright/test';

async function readSakanaLayout(page: import('@playwright/test').Page) {
  return page.locator('[data-sakana-layer]').evaluate((layer) => {
    const left = layer.querySelector<HTMLElement>('[data-sakana-anchor="left"]');
    const right = layer.querySelector<HTMLElement>('[data-sakana-anchor="right"]');
    const chisato = layer.querySelector<HTMLElement>(
      '[data-sakana-mount="chisato"] .sakana-character'
    );
    const takina = layer.querySelector<HTMLElement>(
      '[data-sakana-mount="takina"] .sakana-character'
    );
    const beds = [...layer.querySelectorAll<HTMLElement>('.sakana-bed')];
    if (!left || !right || !chisato || !takina || beds.length !== 2) {
      throw new Error('Sakana layout is incomplete');
    }

    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height
      };
    };

    return {
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      layerZIndex: getComputedStyle(layer).zIndex,
      chisatoArtworkTransform: getComputedStyle(chisato, '::before').transform,
      takinaArtworkTransform: getComputedStyle(takina, '::before').transform,
      bedDisplays: beds.map((bed) => getComputedStyle(bed).display),
      left: rect(left),
      right: rect(right),
      chisato: rect(chisato)
    };
  });
}

test('renders mirrored artwork and responsive mounts without horizontal overflow', async ({ page }) => {
  await page.goto('/');

  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  await expect(layer).toHaveAttribute('data-sakana-state', 'ready');
  await expect(layer.locator('[data-sakana-anchor]')).toHaveCount(2);
  await expect(layer.locator('[data-sakana-mount="chisato"]')).toHaveCount(1);
  await expect(layer.locator('[data-sakana-mount="takina"]')).toHaveCount(1);

  const desktop = await readSakanaLayout(page);
  expect(desktop.layerZIndex).toBe('15');
  expect(desktop.chisatoArtworkTransform).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  expect(desktop.takinaArtworkTransform).toBe('none');
  expect(desktop.bedDisplays).toEqual(['none', 'none']);
  expect(desktop.scrollWidth).toBe(desktop.viewportWidth);
  expect(desktop.left.left).toBeCloseTo(-50, 1);
  expect(desktop.left.bottom).toBeCloseTo(desktop.viewportHeight, 1);
  expect(desktop.left.width).toBeCloseTo(250, 1);
  expect(desktop.left.height).toBeCloseTo(400, 1);
  expect(desktop.chisato.left).toBeCloseTo(0, 1);
  expect(desktop.right.right).toBeCloseTo(desktop.viewportWidth, 1);
  expect(desktop.right.bottom).toBeCloseTo(desktop.viewportHeight, 1);
  expect(desktop.right.width).toBeCloseTo(250, 1);
  expect(desktop.right.height).toBeCloseTo(400, 1);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await readSakanaLayout(page);
  expect(mobile.scrollWidth).toBe(mobile.viewportWidth);
  expect(mobile.left.left).toBeCloseTo(-32, 1);
  expect(mobile.left.bottom).toBeCloseTo(844, 1);
  expect(mobile.left.width).toBeCloseTo(160, 1);
  expect(mobile.left.height).toBeCloseTo(256, 1);
  expect(mobile.chisato.left).toBeCloseTo(0, 1);
  expect(mobile.right.right).toBeCloseTo(390, 1);
  expect(mobile.right.bottom).toBeCloseTo(844, 1);
  expect(mobile.right.width).toBeCloseTo(160, 1);
  expect(mobile.right.height).toBeCloseTo(256, 1);
});

test('initializes locked roles once and persists them across client navigation', async ({ page }) => {
  const remoteSakanaRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.hostname !== '127.0.0.1' &&
      (url.pathname.toLowerCase().includes('sakana') || url.hostname === 'lab.magiconch.com')
    ) {
      remoteSakanaRequests.push(request.url());
    }
  });

  await page.goto('/');
  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveAttribute('data-sakana-state', 'ready');
  await expect(layer).toHaveAttribute('data-sakana-motion', 'full');

  const chisato = layer.locator('[data-sakana-mount="chisato"]');
  const takina = layer.locator('[data-sakana-mount="takina"]');
  await expect(chisato.locator('.sakana-character')).toHaveAttribute('data-character', 'chisato');
  await expect(takina.locator('.sakana-character')).toHaveAttribute('data-character', 'takina');
  await expect(layer.locator('canvas')).toHaveCount(2);
  await expect(chisato).not.toHaveAttribute('data-can-switch-character', 'true');
  await expect(takina).not.toHaveAttribute('data-can-switch-character', 'true');

  await expect(chisato.locator('.sakana-bed')).toBeHidden();
  await expect(takina.locator('.sakana-bed')).toBeHidden();

  await layer.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));
  await page.getByRole('link', { name: '归档', exact: true }).click();
  await expect(page).toHaveURL(/\/archives\/$/);
  await expect(page.locator('[data-sakana-layer]')).toHaveAttribute('data-persist-probe', 'same-node');
  await expect(page.locator('[data-sakana-layer] canvas')).toHaveCount(2);
  expect(remoteSakanaRequests).toEqual([]);
});

test('dragging Chisato follows the pointer and moves only that instance', async ({ page }) => {
  for (const deltaX of [60, -60]) {
    await page.goto('/');
    const layer = page.locator('[data-sakana-layer]');
    await expect(layer).toHaveAttribute('data-sakana-state', 'ready');

    const chisato = layer.locator('[data-sakana-mount="chisato"] .sakana-character');
    const takina = layer.locator('[data-sakana-mount="takina"] .sakana-character');
    const initialTakinaStyle = await takina.getAttribute('style');
    const initialBox = await chisato.boundingBox();
    if (!initialBox) throw new Error('Chisato is not visible');
    const initialCenterX = initialBox.x + initialBox.width / 2;
    const centerY = initialBox.y + initialBox.height / 2;

    await page.mouse.move(initialCenterX, centerY);
    await page.mouse.down();
    await page.mouse.move(initialCenterX + deltaX, centerY - initialBox.height * 0.15);

    const draggedStyle = await chisato.getAttribute('style');
    const draggedBox = await chisato.boundingBox();
    if (!draggedBox) throw new Error('Chisato disappeared while dragging');
    const visualDeltaX = draggedBox.x + draggedBox.width / 2 - initialCenterX;
    expect(Math.sign(visualDeltaX)).toBe(Math.sign(deltaX));
    expect(await takina.getAttribute('style')).toBe(initialTakinaStyle);

    await page.mouse.up();
    await expect.poll(() => chisato.getAttribute('style')).not.toBe(draggedStyle);
  }
});
