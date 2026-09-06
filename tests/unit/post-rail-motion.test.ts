import { describe, expect, it } from 'vitest';
import {
  clampRailPosition,
  createMotionState,
  stepDampedMotion,
  stepInertialMotion
} from '../../src/lib/post-rail-motion';

describe('post rail motion', () => {
  it('clamps positions to the scrollable range', () => {
    expect(clampRailPosition(-10, 500)).toBe(0);
    expect(clampRailPosition(700, 500)).toBe(500);
    expect(clampRailPosition(120, 500)).toBe(120);
  });

  it('moves toward a wheel target without jumping directly to it', () => {
    const next = stepDampedMotion(createMotionState(0, 300), 16, 600);
    expect(next.position).toBeGreaterThan(0);
    expect(next.position).toBeLessThan(300);
    expect(next.target).toBe(300);
  });

  it('settles close to the target after repeated damped frames', () => {
    let state = createMotionState(0, 300);
    for (let index = 0; index < 120; index += 1) {
      state = stepDampedMotion(state, 16, 600);
    }
    expect(state.position).toBeCloseTo(300, 1);
    expect(state.target).toBe(300);
    expect(state.velocity).toBe(0);
  });

  it('decays release velocity and stops at the rail edge', () => {
    let state = { ...createMotionState(500, 500, 1.2), velocity: 1.2 };
    for (let index = 0; index < 240; index += 1) {
      state = stepInertialMotion(state, 16, 600);
    }
    expect(state.position).toBeLessThanOrEqual(600);
    expect(Math.abs(state.velocity)).toBe(0);
  });

  it('stops inertial motion when it hits either edge', () => {
    const next = stepInertialMotion({ ...createMotionState(590, 590, 20), velocity: 20 }, 16, 600);
    expect(next.position).toBe(600);
    expect(next.velocity).toBe(0);
  });
});
