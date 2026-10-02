import { expect, test } from '@playwright/test';

async function readSakanaLayout(page: import('@playwright/test').Page) {
  return page.locator('[data-sakana-layer]').evaluate((layer) => {
    const left = layer.querySelector<HTMLElement>('[data-sakana-anchor="left"]');
    const right = layer.querySelector<HTMLElement>('[data-sakana-anchor="right"]');
    const chisatoMount = left?.querySelector<HTMLElement>('[data-sakana-mount="chisato"]');
    const takinaMount = right?.querySelector<HTMLElement>('[data-sakana-mount="takina"]');
    if (!left || !right || !chisatoMount || !takinaMount) {
      throw new Error('Sakana anchor layout is incomplete');
    }

    const chisatoProbe = document.createElement('span');
    chisatoProbe.className = 'sakana-character';
    chisatoMount.append(chisatoProbe);
    const chisatoArtworkTransform = getComputedStyle(chisatoProbe, '::before').transform;
    chisatoProbe.remove();

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
      chisatoArtworkTransform,
      left: rect(left),
      right: rect(right)
    };
  });
}

test('mounts the decoration only on About routes', async ({ page }) => {
  for (const route of ['/projects/', '/']) {
    await page.goto(route);
    await expect(page.locator('[data-sakana-layer]')).toHaveCount(0);
  }

  for (const route of ['/about/', '/about/hobbies/']) {
    await page.goto(route);
    await expect(page.locator('[data-sakana-layer]')).toHaveCount(1);
  }
});

test('renders mirrored anchor slots responsively without horizontal overflow', async ({ page }) => {
  await page.goto('/about/');

  const layer = page.locator('[data-sakana-layer]');
  await expect(layer.locator('[data-sakana-anchor]')).toHaveCount(2);
  await expect(
    layer.locator('[data-sakana-anchor="left"] > [data-sakana-mount="chisato"]')
  ).toHaveCount(1);
  await expect(
    layer.locator('[data-sakana-anchor="right"] > [data-sakana-mount="takina"]')
  ).toHaveCount(1);

  const desktop = await readSakanaLayout(page);
  expect(desktop.layerZIndex).toBe('15');
  expect(desktop.chisatoArtworkTransform).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  expect(desktop.scrollWidth).toBe(desktop.viewportWidth);
  expect(desktop.left.left).toBeCloseTo(-50, 1);
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
  expect(mobile.left.left).toBeCloseTo(-32, 1);
  expect(mobile.left.bottom).toBeCloseTo(844, 1);
  expect(mobile.left.width).toBeCloseTo(160, 1);
  expect(mobile.left.height).toBeCloseTo(256, 1);
  expect(mobile.right.right).toBeCloseTo(390, 1);
  expect(mobile.right.bottom).toBeCloseTo(844, 1);
  expect(mobile.right.width).toBeCloseTo(160, 1);
  expect(mobile.right.height).toBeCloseTo(256, 1);
});

test('keeps the decoration hidden from accessibility and pointer interaction', async ({ page }) => {
  await page.goto('/about/');

  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveAttribute('aria-hidden', 'true');

  const contract = await layer.evaluate((element) => ({
    pointerEvents: [element, ...element.querySelectorAll<HTMLElement>('*')].map(
      (node) => getComputedStyle(node).pointerEvents
    ),
    focusableDescendants: element.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    ).length
  }));

  expect(contract.pointerEvents).toEqual(['none', 'none', 'none', 'none', 'none']);
  expect(contract.focusableDescendants).toBe(0);
});

test('mounts and unmounts with client-side navigation', async ({ page }) => {
  await page.goto('/projects/');
  await expect(page.locator('[data-sakana-layer]')).toHaveCount(0);

  await page.locator('.desktop-nav a[href="/about/"]').click();
  await expect(page).toHaveURL(/\/about\/$/);
  const layer = page.locator('[data-sakana-layer]');
  await expect(layer).toHaveCount(1);
  await layer.evaluate((element) => element.setAttribute('data-navigation-probe', 'mounted'));

  await page.locator('.desktop-nav a[href="/projects/"]').click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect(page.locator('[data-sakana-layer]')).toHaveCount(0);

  await page.locator('.desktop-nav a[href="/about/"]').click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.locator('[data-sakana-layer]')).toHaveCount(1);
  await expect(page.locator('[data-sakana-layer]')).not.toHaveAttribute(
    'data-navigation-probe',
    'mounted'
  );
});
