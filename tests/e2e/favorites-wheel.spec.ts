import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`wheel distance moves several blades continuously, keeps both arrows aligned, and snaps to a blade on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/favorites/');
    await page.waitForFunction(() => !document.documentElement.dataset.initialPageLoader);

    const motion = await page.evaluate(async () => {
      const reel = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
      const plates = [...document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-plate')];
      const samples: { progress: number; angles: number[] }[] = [];
      reel.dispatchEvent(new WheelEvent('wheel', { deltaY: 330, bubbles: true, cancelable: true }));
      const deadline = performance.now() + 700;
      while (performance.now() < deadline) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        samples.push({
          progress: Number(reel.dataset.progress),
          angles: plates.map((plate) => {
            const transform = new DOMMatrix(getComputedStyle(plate).transform);
            return Math.atan2(transform.b, transform.a);
          })
        });
      }
      return { samples, final: Number(reel.dataset.progress), busy: reel.hasAttribute('aria-busy') };
    });

    expect(motion.busy).toBe(false);
    expect(motion.final).toBe(3);
    const intermediateProgress = motion.samples
      .filter(({ progress }) => Math.abs(progress - Math.round(progress)) > .1)
      .map(({ progress }) => progress.toFixed(4));
    expect(new Set(intermediateProgress).size).toBeGreaterThanOrEqual(2);
    expect(motion.samples.every(({ angles }) => Math.abs(angles[0] - angles[1]) < .02)).toBe(true);
    expect(motion.samples.filter(({ progress }) => Math.abs(progress - Math.round(progress)) > .1).every(({ progress, angles }) => {
      const expected = 44 * .6 * Math.PI / 180 * Math.abs(Math.sin(Math.PI * progress));
      return Math.abs(Math.abs(angles[0]) - expected) < .03;
    })).toBe(true);

    await page.locator('[data-favorites-reel]').dispatchEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true });
    await page.waitForTimeout(600);
    await expect(page.locator('[data-favorites-reel]')).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('[data-favorites-reel]')).toHaveAttribute('data-progress', '3.0000');
  });
}

test('reduced motion accumulates small wheel deltas and shows the nearest blade immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/favorites/');
  await page.waitForFunction(() => !document.documentElement.dataset.initialPageLoader);
  const reel = page.locator('[data-favorites-reel]');
  await reel.evaluate((element) => {
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true }));
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true }));
  });
  await expect(reel).toHaveAttribute('data-progress', '1.0000');
  await expect(page.locator('[data-favorites-item][data-selected="true"]')).toHaveAttribute('data-index', '1');
  await expect(reel).not.toHaveAttribute('aria-busy', 'true');
});
