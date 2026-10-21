import { expect, test } from '@playwright/test';

test.use(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? { channel: 'chrome' } : {});

test('random selection blurs with speed, overshoots once, and returns with linked arrows', async ({ page }) => {
  await page.goto('/favorites/');
  await expect(page.locator('[data-favorites]')).toHaveAttribute('data-bound', '');
  await expect(page.locator('#page-loader')).toBeHidden();

  const motion = await page.evaluate(async () => {
    const reel = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
    const plates = [...document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-plate')];
    const screws = [...document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-screw')];
    const screwStart = screws.map((screw) => screw.getBoundingClientRect());
    const blur = (element: Element) => Number(getComputedStyle(element).filter.match(/blur\(([\d.]+)px\)/)?.[1] ?? 0);
    const initialProgress = Number(reel.dataset.progress);
    const start = performance.now();
    document.querySelector<HTMLButtonElement>('[data-favorites-random]')!.click();
    const initialSelectedBlur = blur(reel.querySelector('[data-favorites-item][data-selected="true"]')!);
    const initialOtherBlur = blur(reel.querySelector('[data-favorites-item][data-selected="false"]')!);
    const samples: { elapsed: number; progress: number; angles: number[]; selectedBlur: number; otherBlur: number }[] = [];
    let maxScrewDrift = 0;
    let maxShellBlur = 0;
    let maxArrowBlur = 0;
    while (reel.hasAttribute('aria-busy')) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      screws.forEach((screw, index) => {
        const box = screw.getBoundingClientRect();
        maxScrewDrift = Math.max(maxScrewDrift, Math.abs(box.x - screwStart[index].x), Math.abs(box.y - screwStart[index].y));
      });
      maxShellBlur = Math.max(maxShellBlur, blur(document.querySelector('.favorites-machine__frame')!));
      maxArrowBlur = Math.max(maxArrowBlur, ...plates.map(blur));
      samples.push({
        elapsed: performance.now() - start,
        progress: Number(reel.dataset.progress),
        selectedBlur: blur(reel.querySelector('[data-favorites-item][data-selected="true"]')!),
        otherBlur: blur(reel.querySelector('[data-favorites-item][data-selected="false"]')!),
        angles: plates.map((plate) => {
          const matrix = new DOMMatrix(getComputedStyle(plate).transform);
          return Math.atan2(matrix.b, matrix.a);
        })
      });
    }
    return {
      samples,
      duration: performance.now() - start,
      initialProgress,
      initialSelectedBlur,
      initialOtherBlur,
      maxScrewDrift,
      maxShellBlur,
      maxArrowBlur,
      linkCount: reel.querySelectorAll('[data-favorites-item]').length,
      selectedIndex: Number(reel.querySelector<HTMLElement>('[data-favorites-item][data-selected="true"]')!.dataset.index),
      rightMirror: getComputedStyle(document.querySelector('.favorites-reel__paddle--right')!).scale
    };
  });

  const samples = motion.samples;
  const final = samples.at(-1)!.progress;
  const lowest = Math.min(...samples.map((sample) => sample.progress));
  const turnaround = samples.findIndex((sample) => sample.progress === lowest);
  const at = (ms: number) => motion.samples.find((sample) => sample.elapsed >= ms)!;
  expect(motion.duration).toBeGreaterThan(1600);
  expect(motion.duration).toBeLessThan(1900);
  expect(Number.isInteger(final)).toBe(true);
  expect(motion.selectedIndex).toBe((final % motion.linkCount + motion.linkCount) % motion.linkCount);
  expect(final - lowest).toBeGreaterThanOrEqual(.26);
  expect(final - lowest).toBeLessThanOrEqual(.3);
  expect(samples[turnaround].elapsed).toBeGreaterThan(1000);
  expect(samples[turnaround].elapsed).toBeLessThan(1300);
  expect(samples.slice(1, turnaround + 1).every((sample, index) => sample.progress <= samples[index].progress + .0001)).toBe(true);
  expect(Math.abs(at(500).progress - motion.initialProgress)).toBeGreaterThan(motion.linkCount);
  expect(motion.initialSelectedBlur).toBeGreaterThan(3);
  expect(motion.initialOtherBlur).toBeGreaterThan(3);
  expect(at(500).selectedBlur).toBeLessThan(2);
  expect(at(500).otherBlur).toBeLessThan(2);
  expect(at(900).selectedBlur).toBeLessThan(at(500).selectedBlur);
  expect(at(1100).selectedBlur).toBeLessThan(.3);
  expect(motion.maxShellBlur).toBe(0);
  expect(motion.maxArrowBlur).toBe(0);
  expect(motion.maxScrewDrift).toBeLessThan(1);
  expect(motion.rightMirror).toBe('-1 1');
  expect(samples.every((sample) => Math.abs(sample.angles[0] - sample.angles[1]) < .002)).toBe(true);
  expect(samples.slice(0, turnaround).every((sample) => {
    const expected = 44 * Math.PI / 180 * Math.abs(Math.sin(Math.PI * sample.progress));
    return Math.abs(sample.angles[0] - expected) < .02;
  })).toBe(true);
  expect(samples[turnaround].angles[0]).toBeGreaterThan(.1);
  const rebound = samples.slice(turnaround);
  let signChanges = 0;
  let previousSign = 0;
  let leafSignChanges = 0;
  let previousLeafSign = 0;
  rebound.forEach((sample) => {
    const sign = sample.angles[0] > .02 ? 1 : sample.angles[0] < -.02 ? -1 : 0;
    if (sign && previousSign && sign !== previousSign) signChanges += 1;
    if (sign) previousSign = sign;
    const leafSign = sample.progress - final > .005 ? 1 : sample.progress - final < -.005 ? -1 : 0;
    if (leafSign && previousLeafSign && leafSign !== previousLeafSign) leafSignChanges += 1;
    if (leafSign) previousLeafSign = leafSign;
  });
  expect(signChanges).toBe(4);
  expect(leafSignChanges).toBe(4);
  expect(rebound.every((sample) => Math.abs(sample.progress - final) <= .3)).toBe(true);
  const negativePeaks: number[] = [];
  let negativePeak = 0;
  rebound.forEach((sample) => {
    if (sample.angles[0] < -.02) negativePeak = Math.max(negativePeak, -sample.angles[0]);
    else if (negativePeak) { negativePeaks.push(negativePeak); negativePeak = 0; }
  });
  if (negativePeak) negativePeaks.push(negativePeak);
  expect(negativePeaks).toHaveLength(2);
  expect(negativePeaks[0]).toBeGreaterThan(negativePeaks[1]);
  expect(negativePeaks[1]).toBeGreaterThan(.08);
  expect(rebound.every((sample) => {
    const startAngle = 44 * Math.PI / 180 * Math.abs(Math.sin(Math.PI * (final - .28)));
    const expected = startAngle * (sample.progress - final) / -.28;
    return Math.abs(sample.angles[0] - expected) < .04;
  })).toBe(true);
  expect(samples.at(-1)!.angles).toEqual([0, 0]);
});

test('a repeated random click continues from the visible reel position', async ({ page }) => {
  await page.goto('/favorites/');
  await expect(page.locator('#page-loader')).toBeHidden();
  const reel = page.locator('[data-favorites-reel]');
  await page.locator('[data-favorites-random]').click();
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('[data-favorites-reel]')?.dataset.progress) < -2);
  const { before, after } = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
    const before = Number(element.dataset.progress);
    document.querySelector<HTMLButtonElement>('[data-favorites-random]')!.click();
    return { before, after: Number(element.dataset.progress) };
  });
  expect(after).toBe(before);
  await expect(reel).not.toHaveAttribute('aria-busy', 'true', { timeout: 10000 });
  const final = Number(await reel.getAttribute('data-progress'));
  expect(Number.isInteger(final)).toBe(true);
});

test('mobile arrows mirror the damped rebound around fixed screws', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/favorites/');
  await expect(page.locator('#page-loader')).toBeHidden();

  const motion = await page.evaluate(async () => {
    const reel = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
    const plates = [...document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-plate')];
    const screws = [...document.querySelectorAll<HTMLElement>('.favorites-reel__paddle-screw')];
    const before = screws.map((screw) => screw.getBoundingClientRect());
    document.querySelector<HTMLButtonElement>('[data-favorites-random]')!.click();
    const samples: { progress: number; angles: number[] }[] = [];
    while (reel.hasAttribute('aria-busy')) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push({
        progress: Number(reel.dataset.progress),
        angles: plates.map((plate) => {
          const matrix = new DOMMatrix(getComputedStyle(plate).transform);
          return Math.atan2(matrix.b, matrix.a);
        })
      });
    }
    const screwDrift = screws.map((screw, index) => {
      const after = screw.getBoundingClientRect();
      return Math.max(Math.abs(after.x - before[index].x), Math.abs(after.y - before[index].y));
    });
    return { samples, screwDrift };
  });

  const final = motion.samples.at(-1)!.progress;
  const turnaround = motion.samples.findIndex((sample) => sample.progress === Math.min(...motion.samples.map((entry) => entry.progress)));
  const rebound = motion.samples.slice(turnaround);
  let signChanges = 0;
  let previousSign = 0;
  let leafSignChanges = 0;
  let previousLeafSign = 0;
  rebound.forEach((sample) => {
    const sign = sample.angles[0] > .02 ? 1 : sample.angles[0] < -.02 ? -1 : 0;
    if (sign && previousSign && sign !== previousSign) signChanges += 1;
    if (sign) previousSign = sign;
    const leafSign = sample.progress - final > .005 ? 1 : sample.progress - final < -.005 ? -1 : 0;
    if (leafSign && previousLeafSign && leafSign !== previousLeafSign) leafSignChanges += 1;
    if (leafSign) previousLeafSign = leafSign;
  });
  expect(signChanges).toBe(4);
  expect(leafSignChanges).toBe(4);
  expect(motion.samples.every((sample) => Math.abs(sample.angles[0] - sample.angles[1]) < .002)).toBe(true);
  expect(motion.screwDrift.every((drift) => drift < 1)).toBe(true);
  expect(Number.isInteger(final)).toBe(true);
  expect(motion.samples.at(-1)!.angles).toEqual([0, 0]);
});

test('mouse wheel uses sixty percent of the keyboard paddle swing', async ({ page }) => {
  await page.goto('/favorites/');
  await expect(page.locator('#page-loader')).toBeHidden();

  const motion = await page.evaluate(async () => {
    const reel = document.querySelector<HTMLElement>('[data-favorites-reel]')!;
    const plate = document.querySelector<HTMLElement>('.favorites-reel__paddle-plate')!;
    const angle = () => {
      const matrix = new DOMMatrix(getComputedStyle(plate).transform);
      return Math.abs(Math.atan2(matrix.b, matrix.a));
    };
    const measure = async (activate: () => void) => {
      activate();
      let peak = 0;
      const end = performance.now() + 400;
      while (performance.now() < end) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        peak = Math.max(peak, angle());
      }
      return peak;
    };
    const keyboard = await measure(() => reel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })));
    const wheel = await measure(() => reel.dispatchEvent(new WheelEvent('wheel', { deltaY: 110, bubbles: true, cancelable: true })));
    return { keyboard, wheel, selectedIndex: Number(reel.querySelector<HTMLElement>('[data-favorites-item][data-selected="true"]')!.dataset.index) };
  });

  expect(motion.keyboard).toBeGreaterThan(.5);
  expect(motion.wheel / motion.keyboard).toBeGreaterThan(.5);
  expect(motion.wheel / motion.keyboard).toBeLessThan(.7);
  expect(motion.selectedIndex).toBe(2);
});
