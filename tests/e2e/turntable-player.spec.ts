import { expect, test } from '@playwright/test';

test('the chassis and record keep the reference top-down proportions on desktop and mobile', async ({ page }) => {
  await page.goto('/about/');
  const player = page.locator('[data-music-player]');
  await player.locator('[data-player-toggle]').click();
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
  await expect(player.locator('.record-assembly')).toHaveCSS('transform', 'none');

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await player.evaluate((element) => {
      const chassis = element.getBoundingClientRect();
      const record = element.querySelector<HTMLElement>('[data-turntable-record]')!.getBoundingClientRect();
      return {
        chassisRatio: chassis.width / chassis.height,
        recordRatio: record.width / record.height,
        recordX: (record.left + record.width / 2 - chassis.left) / chassis.width,
        recordY: (record.top + record.height / 2 - chassis.top) / chassis.height,
      };
    });
    expect(geometry.chassisRatio).toBeCloseTo(376 / 289, 2);
    expect(geometry.recordRatio).toBeCloseTo(1, 2);
    expect(geometry.recordX).toBeCloseTo(.47, 1);
    expect(geometry.recordY).toBeCloseTo(.48, 1);
  }
});

test('the record plays, pauses, shuffles on double click, and reveals the track on hover', async ({ page }) => {
  await page.goto('/about/');
  const player = page.locator('[data-music-player]');
  await player.locator('[data-player-toggle]').click();
  const record = player.locator('[data-player-record]');
  const track = player.locator('[data-player-track]');

  await expect(player).toHaveAttribute('data-playback-state', 'paused');
  await record.hover();
  await expect(track).toHaveText('其实-薛之谦');
  await expect(track).toHaveCSS('opacity', '1');
  await page.mouse.move(500, 500);
  const exitState = await player.evaluate((element) => ({
    hover: element.querySelector('.record-assembly')!.matches(':hover'),
    inputMode: element.dataset.inputMode,
    transitionDuration: getComputedStyle(element.querySelector('[data-player-track]')!).transitionDuration,
    transitionProperty: getComputedStyle(element.querySelector('[data-player-track]')!).transitionProperty,
  }));
  expect(exitState.hover).toBe(false);
  expect(exitState.inputMode).toBe('pointer');
  expect(exitState.transitionDuration).toContain('0.16s');
  expect(exitState.transitionProperty).toContain('visibility');
  await expect(track).toHaveCSS('opacity', '0');
  await expect(track).toHaveCSS('visibility', 'hidden');

  await record.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(record).toBeFocused();
  await expect(track).toHaveCSS('visibility', 'visible');
  await record.hover();
  await page.mouse.move(500, 500);
  await expect(track).toHaveCSS('visibility', 'hidden');

  await record.click();
  await expect(player).toHaveAttribute('data-playback-state', 'playing');
  await expect(record).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(500, 500);
  await expect(track).toHaveCSS('visibility', 'hidden');
  await record.click();
  await expect(player).toHaveAttribute('data-playback-state', 'paused');

  await record.dblclick();
  await expect(player).toHaveAttribute('data-record-swap', 'true');
  await expect(record).toBeDisabled();
  await expect(player.locator('.record-assembly')).toHaveCSS('animation-name', 'record-exchange');
  await expect(track).not.toHaveText('其实-薛之谦');
  await expect(player).toHaveAttribute('data-playback-state', 'playing');
  const selectedTrack = await track.textContent();
  await record.press('Shift+Enter');
  await expect(track).not.toHaveText(selectedTrack ?? '');
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
});

test('reduced motion presents the engaged arm without rotation or transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/about/');
  const player = page.locator('[data-music-player]');
  await player.locator('[data-player-toggle]').click();
  await player.locator('[data-player-record]').click();
  await expect(player).toHaveAttribute('data-playback-state', 'playing');
  await expect(player.locator('[data-turntable-record]')).toHaveCSS('animation-name', 'none');
  await expect(player.locator('[data-turntable-tonearm]')).toHaveCSS('transition-duration', '0s');
  await player.locator('[data-player-record]').dblclick();
  await expect(player).not.toHaveAttribute('data-record-swap', 'true');
  await expect(player).toHaveAttribute('data-playback-state', 'playing');
});
