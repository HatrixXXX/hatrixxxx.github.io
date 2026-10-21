import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('reel crossings spark beside both arrow tips on desktop and phone', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/favorites/');
    await expect(page.locator('#page-loader')).toBeHidden();

    const evidence = await page.evaluate(async () => {
      const reel = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
      document.querySelector<HTMLButtonElement>('[data-favorites-random]')!.click();
      const started = performance.now();
      let contacts: HTMLElement[] = [];
      while (performance.now() - started < 900) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        contacts = [...document.querySelectorAll<HTMLElement>('[data-favorites-spark-contact]')];
        if (contacts.length === 2 && contacts.every((contact) => contact.querySelector('[data-favorites-spark]'))) break;
      }
      const bounds = reel.getBoundingClientRect();
      const screws = [...document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-screw')].map((screw) => screw.getBoundingClientRect());
      const tips = contacts.map((contact) => {
        const box = contact.getBoundingClientRect();
        return { x: box.x, y: box.y, pointerEvents: getComputedStyle(contact).pointerEvents };
      });
      const sparks = contacts.map((contact) => [...contact.querySelectorAll<HTMLElement>('[data-favorites-spark]')]);
      return {
        active: sparks.map((particles) => particles.length),
        iterations: sparks.map((particles) => particles[0] ? getComputedStyle(particles[0]).animationIterationCount : ''),
        tips,
        screws: screws.map((box) => ({ x: box.x, width: box.width })),
        bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width }
      };
    });

    expect(evidence.active.length).toBe(2);
    expect(evidence.active.every((count) => count > 0)).toBe(true);
    expect(evidence.iterations).toEqual(['1', '1']);
    expect(evidence.tips.every((tip) => tip.pointerEvents === 'none')).toBe(true);
    expect(evidence.tips[0].x).toBeGreaterThan(evidence.screws[0].x + evidence.screws[0].width / 2 + 5);
    expect(evidence.tips[0].x).toBeLessThan(evidence.bounds.left + evidence.bounds.width * .3);
    expect(evidence.tips[1].x).toBeLessThan(evidence.screws[1].x + evidence.screws[1].width / 2 - 5);
    expect(evidence.tips[1].x).toBeGreaterThan(evidence.bounds.right - evidence.bounds.width * .3);
    expect(evidence.tips.every((tip) => tip.y > evidence.bounds.top - 20 && tip.y < evidence.bounds.bottom + 20)).toBe(true);

    await page.locator('[data-favorites-next]').click();
    await expect(page.locator('[data-favorites-spark]')).toHaveCount(0);
    await expect(page.locator('[data-favorites-reel]')).not.toHaveAttribute('aria-busy', 'true');
  }
});

test('sparks clear when the page hides and never appear with reduced motion', async ({ page }) => {
  await page.goto('/favorites/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const hidden = await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>('[data-favorites-random]')!.click();
    const started = performance.now();
    while (!document.querySelector('[data-favorites-spark]') && performance.now() - started < 900) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const before = document.querySelectorAll('[data-favorites-spark]').length;
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    return { before, after: document.querySelectorAll('[data-favorites-spark]').length };
  });
  expect(hidden.before).toBeGreaterThan(0);
  expect(hidden.after).toBe(0);

  await page.goto('/favorites/');
  await expect(page.locator('#page-loader')).toBeHidden();
  await page.locator('[data-favorites-random]').click();
  await page.waitForFunction(() => document.querySelector('[data-favorites-spark]'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-favorites-spark]')).toHaveCount(0);
  await expect(page.locator('[data-favorites-reel]')).not.toHaveAttribute('aria-busy', 'true');
  await page.locator('[data-favorites-random]').click();
  await expect(page.locator('[data-favorites-spark]')).toHaveCount(0);
  await expect(page.locator('[data-favorites-reel]')).not.toHaveAttribute('aria-busy', 'true');
});
