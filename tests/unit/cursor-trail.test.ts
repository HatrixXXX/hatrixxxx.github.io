import { describe, expect, it } from 'vitest';
import {
  TRAIL_SETTINGS,
  advanceTrailFrameClock,
  advanceTrailHue,
  createTrailState,
  isPointerInGutter,
  setTrailTarget,
  updateTrailState,
} from '../../src/lib/cursor-trail';

describe('cursor trail physics', () => {
  it('keeps the visual tuning contract', () => {
    expect(TRAIL_SETTINGS).toEqual({
      trails: 20,
      size: 50,
      friction: 0.5,
      dampening: 0.25,
      tension: 0.98,
      hueOffset: 285,
      hueAmplitude: 85,
      hueFrequency: 0.0015,
    });
  });

  it('preserves fractional frame time at a 60 Hz cadence', () => {
    let lastFrame: number | undefined;
    let time = 0;
    let frames = 0;

    for (let callback = 0; callback < 60; callback += 1) {
      const result = advanceTrailFrameClock(lastFrame, time);
      lastFrame = result.lastFrame;
      if (result.shouldRender) frames += 1;
      time += callback % 2 === 0 ? 16.6 : 16.7;
    }

    expect(frames).toBeGreaterThanOrEqual(58);
  });

  it('renders immediately, retains skipped time, and does not catch up after a pause', () => {
    const first = advanceTrailFrameClock(undefined, 10);
    expect(first).toEqual({ lastFrame: 10, shouldRender: true });

    const skipped = advanceTrailFrameClock(first.lastFrame, 20);
    expect(skipped).toEqual({ lastFrame: 10, shouldRender: false });

    const next = advanceTrailFrameClock(skipped.lastFrame, 27);
    expect(next.shouldRender).toBe(true);
    expect(next.lastFrame).toBeCloseTo(10 + 1000 / 60);

    const resumed = advanceTrailFrameClock(next.lastFrame, 1_027);
    expect(resumed.shouldRender).toBe(true);
    expect(advanceTrailFrameClock(resumed.lastFrame, 1_027).shouldRender).toBe(false);
  });

  it('classifies only points outside the content bounds as gutter', () => {
    const bounds = { left: 130, right: 1310 };

    expect(isPointerInGutter(129, bounds)).toBe(true);
    expect(isPointerInGutter(1311, bounds)).toBe(true);
    expect(isPointerInGutter(130, bounds)).toBe(false);
    expect(isPointerInGutter(720, bounds)).toBe(false);
    expect(isPointerInGutter(1310, bounds)).toBe(false);
  });

  it('creates twenty tendrils of fifty stationary nodes', () => {
    const state = createTrailState(24, 180, () => 0.5);

    expect(state.tendrils).toHaveLength(20);
    expect(state.tendrils.every((tendril) => tendril.nodes)).toBe(true);
    expect(state.tendrils.every((tendril) => tendril.nodes.length === 50)).toBe(true);
    expect(state.tendrils.flatMap((tendril) => tendril.nodes).every((node) =>
      node.x === 24 && node.y === 180 && node.vx === 0 && node.vy === 0,
    )).toBe(true);
    expect(state.tendrils[0].spring).toBe(0.45);
    expect(state.tendrils[0].friction).toBe(0.5);
  });

  it('moves the lead node and subsequent followers toward the target', () => {
    const state = createTrailState(0, 0, () => 0.5);
    setTrailTarget(state, 10, 0);

    updateTrailState(state);

    expect(state.tendrils[0].nodes[0].x).toBeCloseTo(2.25);
    expect(state.tendrils[0].nodes[0].y).toBe(0);
    expect(state.tendrils[0].nodes[1].x).toBeCloseTo(0.777375);
    const secondFollowerSpring = 0.45 * 0.98 * 0.98;
    const previous = state.tendrils[0].nodes[1];
    const expectedSecondFollower = (
      previous.x * secondFollowerSpring + previous.vx * 0.25
    ) * 0.5;
    expect(state.tendrils[0].nodes[2].x).toBeCloseTo(expectedSecondFollower);
    expect(state.tendrils[0].nodes[2].vx).toBeCloseTo(expectedSecondFollower);
  });

  it('reaches both hue extrema and returns to its offset after a full period', () => {
    const state = createTrailState(0, 0, () => 0.5);

    state.phase = Math.PI / 2 - 0.0015;
    expect(advanceTrailHue(state)).toBe(370);
    state.phase = 3 * Math.PI / 2 - 0.0015;
    expect(advanceTrailHue(state)).toBe(200);
    state.phase = 2 * Math.PI - 0.0015;
    expect(advanceTrailHue(state)).toBe(285);
  });
});
