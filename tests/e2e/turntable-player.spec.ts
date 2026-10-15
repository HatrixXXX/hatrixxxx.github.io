import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('the same playing turntable survives every formerly missing card page', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const trackedWindow = window as Window & { __playerAudios?: HTMLAudioElement[] };
    trackedWindow.__playerAudios = [];
    window.Audio = new Proxy(NativeAudio, {
      construct(target, args) {
        const instance = Reflect.construct(target, args) as HTMLAudioElement;
        trackedWindow.__playerAudios?.push(instance);
        return instance;
      }
    });
  });

  await page.goto('/');
  const player = page.locator('[data-music-player]');
  await player.evaluate((element) => element.setAttribute('data-persist-probe', 'one-turntable'));
  await player.locator('[data-player-record]').click();
  await expect(player).toHaveAttribute('data-playback-state', 'playing');

  for (const path of ['/favorites/', '/playground/', '/creation/', '/']) {
    await page.locator(`a[href="${path}"]`).first().click();
    await expect(page).toHaveURL(path);
    await expect(player).toHaveCount(1);
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute('data-persist-probe', 'one-turntable');
    await expect(player).toHaveAttribute('data-playback-state', 'playing');
    expect(await page.evaluate(() => (window as Window & { __playerAudios?: HTMLAudioElement[] }).__playerAudios?.length)).toBe(1);
    if (path !== '/') {
      await player.locator('[data-player-toggle]').click();
      await expect(player).toHaveAttribute('data-ui-state', 'expanded');
      await page.keyboard.press('Escape');
      await expect(player).toHaveAttribute('data-ui-state', 'collapsed');
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('a[href="/favorites/"]').first().click();
  await expect(page).toHaveURL('/favorites/');
  await expect(player).toHaveAttribute('data-persist-probe', 'one-turntable');
  await expect(player).toHaveAttribute('data-playback-state', 'playing');
  await expect(player).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __playerAudios?: HTMLAudioElement[] }).__playerAudios?.length)).toBe(1);
  await player.locator('[data-player-toggle]').click();
  await expect(player).toHaveAttribute('data-ui-state', 'expanded');
});

test('pause fades immediately and resumes at normal volume', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = new Proxy(NativeAudio, {
      construct(target, args) {
        const instance = Reflect.construct(target, args) as HTMLAudioElement;
        (window as Window & { __playerAudio?: HTMLAudioElement }).__playerAudio = instance;
        return instance;
      }
    });
  });

  await page.goto('/about/');
  const player = page.locator('[data-music-player]');
  await player.locator('[data-player-toggle]').click();
  const record = player.locator('[data-player-record]');
  await record.click();
  await expect(player).toHaveAttribute('data-playback-state', 'playing');
  await page.waitForTimeout(700);

  await record.click();
  await expect.poll(
    () => page.evaluate(() => (window as Window & { __playerAudio?: HTMLAudioElement }).__playerAudio?.volume ?? 0.7),
    { timeout: 200 }
  ).toBeLessThan(0.7);
  await expect(player).toHaveAttribute('data-playback-state', 'paused');
  expect(await page.evaluate(() => (window as Window & { __playerAudio?: HTMLAudioElement }).__playerAudio?.volume)).toBe(0);

  await record.click();
  await expect(player).toHaveAttribute('data-playback-state', 'playing');
  expect(await page.evaluate(() => (window as Window & { __playerAudio?: HTMLAudioElement }).__playerAudio?.volume)).toBe(0.7);
});

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
  await expect(page.locator('#page-loader')).toBeHidden();
  const player = page.locator('[data-music-player]');
  await player.locator('[data-player-toggle]').click();
  const record = player.locator('[data-player-record]');
  const track = player.locator('[data-player-track]');

  await expect(player).toHaveAttribute('data-playback-state', 'paused');
  await record.hover();
  await expect(track).toHaveText('半岛铁盒-周杰伦');
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
  await expect(player.locator('[data-player-record-assembly]')).toHaveCSS('animation-name', 'none');
  await expect(track).not.toHaveText('半岛铁盒-周杰伦');
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

test('enabling reduced motion finishes a record exchange immediately', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const player = page.locator('[data-music-player]');
  await player.locator('[data-player-toggle]').click();
  const record = player.locator('[data-player-record]');

  await record.dblclick();
  await expect(player).toHaveAttribute('data-record-swap', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const state = await player.evaluate((element) => ({
    swapping: element.hasAttribute('data-record-swap'),
    disabled: (element.querySelector('[data-player-record]') as HTMLButtonElement).disabled,
    transform: (element.querySelector('[data-player-record-assembly]') as HTMLElement).style.transform,
    opacity: (element.querySelector('[data-player-record-assembly]') as HTMLElement).style.opacity,
  }));
  expect(state).toEqual({ swapping: false, disabled: false, transform: '', opacity: '' });
  await expect(player).toHaveAttribute('data-playback-state', 'playing');
});
