import { describe, expect, it } from 'vitest';
import {
  TRAIL_SETTINGS,
  advanceTrailHue,
  createTrailState,
  isPointerInGutter,
  setTrailTarget,
  updateTrailState,
} from '../../src/lib/cursor-trail';

describe('cursor trail physics', () => {
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

    expect(state.tendrils).toHaveLength(TRAIL_SETTINGS.trails);
    expect(state.tendrils.every((tendril) => tendril.nodes)).toBe(true);
    expect(state.tendrils.every((tendril) => tendril.nodes.length === TRAIL_SETTINGS.size)).toBe(true);
    expect(state.tendrils.flatMap((tendril) => tendril.nodes).every((node) =>
      node.x === 24 && node.y === 180 && node.vx === 0 && node.vy === 0,
    )).toBe(true);
    expect(state.tendrils[0].spring).toBe(0.45);
    expect(state.tendrils[0].friction).toBe(0.5);
  });

  it('moves the lead node toward the target and advances hue', () => {
    const state = createTrailState(0, 0, () => 0.5);
    setTrailTarget(state, 10, 0);

    updateTrailState(state);

    expect(state.tendrils[0].nodes[0].x).toBeCloseTo(2.25);
    expect(state.tendrils[0].nodes[0].y).toBe(0);
    expect(state.tendrils[0].nodes[1].x).toBeCloseTo(0.777375);
    expect(advanceTrailHue(state)).toBeCloseTo(285 + Math.sin(0.0015) * 85);
  });
});
