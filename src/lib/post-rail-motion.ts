export interface DampedMotionState {
  position: number;
  target: number;
  velocity: number;
}

export interface InertialMotionState extends DampedMotionState {
  velocity: number;
}

const DAMPING_PER_FRAME = 0.2;
const INERTIA_DECAY_PER_FRAME = 0.9;
const MIN_VELOCITY = 0.01;

export function clampRailPosition(value: number, maximum: number): number {
  return Math.min(Math.max(value, 0), Math.max(0, maximum));
}

export function createMotionState(
  position: number,
  target = position,
  velocity = 0
): DampedMotionState {
  return { position, target, velocity };
}

export function stepDampedMotion(
  state: DampedMotionState,
  deltaMs: number,
  maximum: number
): DampedMotionState {
  const frameScale = Math.min(Math.max(deltaMs, 0), 32) / 16;
  const target = clampRailPosition(state.target, maximum);
  const position = state.position + (target - state.position) * (1 - Math.pow(DAMPING_PER_FRAME, frameScale));
  const settled = Math.abs(target - position) < 0.1;

  return {
    position: settled ? target : clampRailPosition(position, maximum),
    target,
    velocity: settled ? 0 : target - position
  };
}

export function stepInertialMotion(
  state: InertialMotionState,
  deltaMs: number,
  maximum: number
): InertialMotionState {
  const frameScale = Math.min(Math.max(deltaMs, 0), 32) / 16;
  const velocity = state.velocity * Math.pow(INERTIA_DECAY_PER_FRAME, frameScale);
  const position = clampRailPosition(state.position + velocity * frameScale, maximum);
  const hitEdge = position === 0 || position === Math.max(0, maximum);

  return {
    position,
    target: position,
    velocity: hitEdge || Math.abs(velocity) < MIN_VELOCITY ? 0 : velocity
  };
}
