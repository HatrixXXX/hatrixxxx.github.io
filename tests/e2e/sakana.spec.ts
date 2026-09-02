import { expect, test } from '@playwright/test';

async function readSakanaLayout(page: import('@playwright/test').Page) {
  return page.locator('[data-sakana-layer]').evaluate((layer) => {
    const left = layer.querySelector<HTMLElement>('[data-sakana-anchor="left"]');
    const right = layer.querySelector<HTMLElement>('[data-sakana-anchor="right"]');
    const mirror = layer.querySelector<HTMLElement>('[data-sakana-mirror]');
    if (!left || !right || !mirror) throw new Error('Sakana anchors are missing');

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
      mirrorTransform: getComputedStyle(mirror).transform,
      left: rect(left),
      right: rect(right)
    };
  });
}

test('renders mirrored and responsive mounts without horizontal overflow', async ({ page }) => {
  await page.goto('/');

  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveCount(1);
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  await expect(layer.locator('[data-sakana-anchor]')).toHaveCount(2);
  await expect(layer.locator('[data-sakana-mount="chisato"]')).toHaveCount(1);
  await expect(layer.locator('[data-sakana-mount="takina"]')).toHaveCount(1);

  const desktop = await readSakanaLayout(page);
  expect(desktop.layerZIndex).toBe('15');
  expect(desktop.mirrorTransform).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  expect(desktop.scrollWidth).toBe(desktop.viewportWidth);
  expect(desktop.left.left).toBeCloseTo(0, 1);
  expect(desktop.left.bottom).toBeCloseTo(desktop.viewportHeight, 1);
  expect(desktop.left.width).toBeCloseTo(250, 1);
  expect(desktop.left.height).toBeCloseTo(400, 1);
  expect(desktop.right.right).toBeCloseTo(desktop.viewportWidth, 1);
  expect(desktop.right.bottom).toBeCloseTo(desktop.viewportHeight, 1);
  expect(desktop.right.width).toBeCloseTo(250, 1);
  expect(desktop.right.height).toBeCloseTo(400, 1);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await readSakanaLayout(page);
  expect(mobile.scrollWidth).toBe(mobile.viewportWidth);
  expect(mobile.left.left).toBeCloseTo(0, 1);
  expect(mobile.left.bottom).toBeCloseTo(844, 1);
  expect(mobile.left.width).toBeCloseTo(160, 1);
  expect(mobile.left.height).toBeCloseTo(256, 1);
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

  await chisato.locator('.sakana-bed').dispatchEvent('click');
  await takina.locator('.sakana-bed').dispatchEvent('click');
  await expect(chisato.locator('.sakana-character')).toHaveAttribute('data-character', 'chisato');
  await expect(takina.locator('.sakana-character')).toHaveAttribute('data-character', 'takina');

  await layer.evaluate((element) => element.setAttribute('data-persist-probe', 'same-node'));
  await page.getByRole('link', { name: '归档', exact: true }).click();
  await expect(page).toHaveURL(/\/archives\/$/);
  await expect(page.locator('[data-sakana-layer]')).toHaveAttribute('data-persist-probe', 'same-node');
  await expect(page.locator('[data-sakana-layer] canvas')).toHaveCount(2);
  expect(remoteSakanaRequests).toEqual([]);
});

test('dragging one character moves only that instance', async ({ page }) => {
  await page.goto('/');
  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveAttribute('data-sakana-state', 'ready');

  const chisato = layer.locator('[data-sakana-mount="chisato"] .sakana-character');
  const takina = layer.locator('[data-sakana-mount="takina"] .sakana-character');
  const initial = {
    chisato: await chisato.getAttribute('style'),
    takina: await takina.getAttribute('style')
  };
  const box = await chisato.boundingBox();
  if (!box) throw new Error('Chisato is not visible');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.35);

  const draggedStyle = await chisato.getAttribute('style');
  expect(draggedStyle).not.toBe(initial.chisato);
  expect(await takina.getAttribute('style')).toBe(initial.takina);

  await page.mouse.up();
  await expect.poll(() => chisato.getAttribute('style')).not.toBe(draggedStyle);
});
