export const TRAIL_SETTINGS = {
  trails: 20,
  size: 50,
  friction: 0.5,
  dampening: 0.25,
  tension: 0.98,
  hueOffset: 285,
  hueAmplitude: 85,
  hueFrequency: 0.0015,
} as const;

export const TRAIL_FRAME_INTERVAL_MS = 1000 / 60;

export type TrailFrameClockResult = {
  lastFrame: number;
  shouldRender: boolean;
};

export function advanceTrailFrameClock(
  lastFrame: number | undefined,
  time: number,
): TrailFrameClockResult {
  if (lastFrame === undefined) return { lastFrame: time, shouldRender: true };
  const elapsed = time - lastFrame;
  if (elapsed < TRAIL_FRAME_INTERVAL_MS) return { lastFrame, shouldRender: false };
  return {
    lastFrame: time - (elapsed % TRAIL_FRAME_INTERVAL_MS),
    shouldRender: true,
  };
}

export type TrailNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type Tendril = {
  spring: number;
  friction: number;
  nodes: TrailNode[];
};

export type TrailState = {
  target: { x: number; y: number };
  phase: number;
  tendrils: Tendril[];
};

export function createTrailState(x: number, y: number, random: () => number = Math.random): TrailState {
  const tendrils: Tendril[] = [];

  for (let index = 0; index < TRAIL_SETTINGS.trails; index += 1) {
    const nodes = Array.from({ length: TRAIL_SETTINGS.size }, () => ({ x, y, vx: 0, vy: 0 }));
    tendrils.push({
      spring: 0.45 + 0.025 * (index / TRAIL_SETTINGS.trails) + random() * 0.1 - 0.05,
      friction: TRAIL_SETTINGS.friction + random() * 0.01 - 0.005,
      nodes,
    });
  }

  return { target: { x, y }, phase: 0, tendrils };
}

export function setTrailTarget(state: TrailState, x: number, y: number): void {
  state.target.x = x;
  state.target.y = y;
}

export function updateTrailState(state: TrailState): void {
  for (const tendril of state.tendrils) {
    const [lead, ...rest] = tendril.nodes;
    let spring = tendril.spring;

    lead.vx += (state.target.x - lead.x) * spring;
    lead.vy += (state.target.y - lead.y) * spring;
    lead.vx *= tendril.friction;
    lead.vy *= tendril.friction;
    lead.x += lead.vx;
    lead.y += lead.vy;

    spring *= TRAIL_SETTINGS.tension;
    let previous = lead;
    for (const node of rest) {
      node.vx += (previous.x - node.x) * spring + previous.vx * TRAIL_SETTINGS.dampening;
      node.vy += (previous.y - node.y) * spring + previous.vy * TRAIL_SETTINGS.dampening;
      node.vx *= tendril.friction;
      node.vy *= tendril.friction;
      node.x += node.vx;
      node.y += node.vy;
      spring *= TRAIL_SETTINGS.tension;
      previous = node;
    }
  }
}

export function advanceTrailHue(state: TrailState): number {
  state.phase += TRAIL_SETTINGS.hueFrequency;
  return TRAIL_SETTINGS.hueOffset + Math.sin(state.phase) * TRAIL_SETTINGS.hueAmplitude;
}

export type TrailRegion = 'left' | 'right' | null;

export type TrailRegionBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function classifyTrailRegion(
  clientX: number,
  clientY: number,
  bounds: TrailRegionBounds,
): TrailRegion {
  if (clientY < bounds.top || clientY > bounds.bottom) return null;
  if (clientX < bounds.left) return 'left';
  if (clientX > bounds.right) return 'right';
  return null;
}

export function isPointerInGutter(clientX: number, bounds: { left: number; right: number }): boolean {
  return clientX < bounds.left || clientX > bounds.right;
}
