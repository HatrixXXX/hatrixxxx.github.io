import { expect, test } from '@playwright/test';

test('mouse yaw and pitch move both card groups through one camera view', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const center = async (name: string) => page.locator(`[data-home-panel="${name}"]`).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  const blog = await center('blog');
  const friends = await center('friends');

  await page.mouse.move(1760, 540);
  await page.waitForTimeout(400);
  expect((await center('blog')).x).toBeLessThan(blog.x - 5);
  expect((await center('friends')).x).toBeLessThan(friends.x - 5);

  await page.mouse.move(960, 900);
  await page.waitForTimeout(400);
  expect((await center('blog')).y).toBeLessThan(blog.y - 5);
  expect((await center('friends')).y).toBeLessThan(friends.y - 5);
});

test('camera view leaves the character and identity fixed, then recenters', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const leftSide = page.locator('[data-home-side="left"]');
  const left = page.locator('[data-home-tilt="left"]');
  const rightSide = page.locator('[data-home-side="right"]');
  const right = page.locator('[data-home-plane="right"]');
  const transform = (side: typeof left) => side.evaluate((element) => getComputedStyle(element).transform);
  const initialLeft = await transform(left);
  const initialLeftSide = await transform(leftSide);
  const initialRightSide = await transform(rightSide);
  const initialRight = await transform(right);
  const character = await page.locator('[data-home-character]').boundingBox();
  const name = await page.locator('[data-home-panel="identity-name"]').boundingBox();
  const search = await page.locator('[data-home-panel="search"]').boundingBox();
  const hip = page.locator('.bone-hip');
  const initialHipTranslate = await hip.evaluate((element) => getComputedStyle(element).translate);

  await page.mouse.move(1760, 190);
  await expect.poll(() => transform(right)).not.toBe(initialRight);
  await expect.poll(() => transform(left)).not.toBe(initialLeft);
  expect(await transform(leftSide)).toBe(initialLeftSide);
  expect(await transform(rightSide)).toBe(initialRightSide);
  expect(await page.locator('[data-home-character]').boundingBox()).toEqual(character);
  await page.waitForTimeout(350);
  expect(await page.locator('[data-home-panel="identity-name"]').boundingBox()).toEqual(name);
  expect(await page.locator('[data-home-panel="search"]').boundingBox()).toEqual(search);
  expect(await hip.evaluate((element) => getComputedStyle(element).translate)).toBe(initialHipTranslate);
  const panelBounds = await page.locator('[data-home-panel]').evaluateAll((panels) => panels.map((panel) => {
    const { left, top, right, bottom } = panel.getBoundingClientRect();
    return { left, top, right, bottom };
  }));
  for (const bounds of panelBounds) {
    const visibleWidth = Math.min(bounds.right, 1920) - Math.max(bounds.left, 0);
    const visibleHeight = Math.min(bounds.bottom, 1080) - Math.max(bounds.top, 0);
    expect(visibleWidth / (bounds.right - bounds.left)).toBeGreaterThan(0.95);
    expect(visibleHeight / (bounds.bottom - bounds.top)).toBeGreaterThan(0.95);
  }

  await page.mouse.move(-10, -10);
  await expect.poll(() => transform(right)).toBe(initialRight);
  await expect.poll(() => transform(left)).toBe(initialLeft);
});

test('reduced motion keeps the camera still and resets an active view', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const right = page.locator('[data-home-plane="right"]');
  const transform = () => right.evaluate((element) => getComputedStyle(element).transform);
  const initial = await transform();

  await page.mouse.move(1760, 190);
  await expect.poll(transform).not.toBe(initial);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(transform).toBe(initial);
  await page.mouse.move(250, 800);
  expect(await transform()).toBe(initial);
});

test('reprojected panels keep their links clickable', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.mouse.move(1760, 190);
  await page.locator('[data-home-panel="blog"] a').click();
  await expect(page).toHaveURL('/blogs/');

  await page.goto('/');
  await page.mouse.move(500, 800);
  await page.locator('[data-home-panel="friends"] a').click();
  await expect(page).toHaveURL('/friends/');
});
