import { expect, test } from '@playwright/test';

test('Hatrix glow spreads from the click point without navigation or visible rings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const control = page.locator('.identity-name');
  const title = control.locator('h1');
  await expect(control.locator('.identity-trigger')).toHaveAttribute('type', 'button');
  const rect = await title.boundingBox();
  if (!rect) throw new Error('Hatrix title is missing');

  await page.mouse.click(rect.x + rect.width * 0.2, rect.y + rect.height * 0.5);
  await expect(control).toHaveAttribute('data-rippling', '');
  const localWidth = await title.evaluate((node) => (node as HTMLElement).offsetWidth);
  expect(Math.abs((await title.evaluate((node) => Number.parseFloat((node as HTMLElement).style.getPropertyValue('--ripple-x')))) - localWidth * 0.2)).toBeLessThan(2);
  await expect(title).toHaveCSS('animation-name', /hatrix-glow-pulse/);
  expect(await control.evaluate((node) => getComputedStyle(node, '::before').animationName)).toBe('none');
  await expect(control).not.toHaveAttribute('data-rippling', '', { timeout: 2_000 });
  await expect(page).toHaveURL('/');
});

test('Hatrix keeps still feedback without navigation for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const control = page.locator('.identity-name');
  await control.locator('.identity-trigger').click();
  await expect(control).toHaveAttribute('data-rippling', '');
  expect(await control.locator('h1').evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await expect(control).not.toHaveAttribute('data-rippling', '', { timeout: 1_000 });
  await expect(page).toHaveURL('/');
});

test('keyboard activation starts the glow from the title center', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const control = page.locator('.identity-name');
  const title = control.locator('h1');
  await control.locator('.identity-trigger').focus();
  await page.keyboard.press('Enter');
  await expect(control).toHaveAttribute('data-rippling', '');
  const origin = await title.evaluate((node) => ({
    x: Number.parseFloat((node as HTMLElement).style.getPropertyValue('--ripple-x')),
    center: (node as HTMLElement).offsetWidth / 2,
  }));
  expect(origin.x).toBeCloseTo(origin.center, 1);
  await expect(control).not.toHaveAttribute('data-rippling', '', { timeout: 2_000 });
  await expect(page).toHaveURL('/');
});

test('mobile touch places the ripple on the tapped letter', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('#page-loader')).toBeHidden();
    const title = page.locator('.identity-name h1');
    const rect = await title.boundingBox();
    if (!rect) throw new Error('Hatrix title is missing');
    await page.touchscreen.tap(rect.x + rect.width * 0.7, rect.y + rect.height * 0.5);
    await expect(page.locator('.identity-name')).toHaveAttribute('data-rippling', '');
    const local = await title.evaluate((node) => ({
      width: (node as HTMLElement).offsetWidth,
      x: Number.parseFloat((node as HTMLElement).style.getPropertyValue('--ripple-x')),
    }));
    expect(Math.abs(local.x - local.width * 0.7)).toBeLessThan(3);
  } finally {
    await context.close();
  }
});
