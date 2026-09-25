import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'America/Los_Angeles' });

test('home replaces the visible site name with a circular level badge', async ({ page }) => {
  await page.goto('/');
  const badge = page.getByRole('meter', { name: '等级年度进度' });
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('LV');
  await expect(page.locator('main')).toHaveAccessibleName('Hatrix');

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const box = (await badge.boundingBox())!;
    expect(Math.abs(box.width - box.height)).toBeLessThan(1);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
});

test('level advances at Beijing birthday midnight and resets the ring', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-28T15:59:58Z') });
  await page.goto('/');
  const badge = page.getByRole('meter', { name: '等级年度进度' });
  await expect(page.locator('[data-level-number]')).toHaveText('23');
  await expect(badge).toHaveAttribute('aria-valuetext', /23 岁.*364.*365/);
  expect(Number(await badge.getAttribute('aria-valuenow'))).toBeCloseTo(99.73, 2);
  expect(Number(await page.locator('[data-level-progress]').getAttribute('stroke-dashoffset'))).toBeCloseTo(100 / 365, 4);

  await page.clock.runFor(2_100);
  await expect(page.locator('[data-level-number]')).toHaveText('24');
  await expect(badge).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('[data-level-progress]')).toHaveAttribute('stroke-dashoffset', '100');
});

test('returning home recalculates the level using the current Beijing date', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-07-28T15:00:00Z') });
  await page.goto('/');
  await expect(page.locator('[data-level-number]')).toHaveText('23');
  await page.locator('[data-home-stage]').getByRole('link', { name: '计划', exact: true }).click();
  await expect(page).toHaveURL('/plans/');
  await page.clock.setSystemTime(new Date('2026-09-25T00:00:00Z'));
  await page.locator('[data-back-button]').click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-level-number]')).toHaveText('24');
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuetext', /24 岁.*58.*365/);
  expect(Number(await page.getByRole('meter').getAttribute('aria-valuenow'))).toBeCloseTo(15.89, 2);
  expect(Number(await page.locator('[data-level-progress]').getAttribute('stroke-dashoffset'))).toBeCloseTo(100 - 5800 / 365, 4);
  expect(await page.locator('[data-home-level]').evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
});

test('without JavaScript the level stays unknown and navigation remains available', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(test.info().project.use.baseURL!);
  await expect(page.locator('[data-level-number]')).toHaveText('—');
  await expect(page.locator('.level-fallback')).toBeVisible();
  await page.getByRole('link', { name: '计划', exact: true }).click();
  await expect(page).toHaveURL(/\/plans\/$/);
  await context.close();
});
