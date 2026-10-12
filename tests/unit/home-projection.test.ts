import { describe, expect, it } from 'vitest';
import { createPanelView, projectPanel, projectRectOnPanelPlane } from '../../src/lib/home-projection';

describe('home panel perspective', () => {
  it.each([
    {
      name: 'quote', rect: { x: -392, y: -78, width: 600, height: 70 },
      expected: [[8.88462, 652.61538], [606, 618], [606, 688], [8.88462, 722.61538]]
    },
    {
      name: 'music', rect: { x: -392, y: 0, width: 376, height: 289 },
      expected: [[8.88462, 730.61538], [383.07692, 708.92308], [383.07692, 997.92308], [8.88462, 1019.61538]]
    },
    {
      name: 'friends', rect: { x: -8, y: 0, width: 216, height: 91 },
      expected: [[391.03846, 708.46154], [606, 696], [606, 787], [391.03846, 799.46154]]
    },
    {
      name: 'guestbook', rect: { x: -8, y: 99, width: 216, height: 91 },
      expected: [[391.03846, 807.46154], [606, 795], [606, 886], [391.03846, 898.46154]]
    },
    {
      name: 'lab-shortcut', rect: { x: -8, y: 198, width: 216, height: 91 },
      expected: [[391.03846, 906.46154], [606, 894], [606, 985], [391.03846, 997.46154]]
    }
  ] as const)('projects $name through the shared affine lower-left plane', ({ rect, expected }) => {
    const corners = projectRectOnPanelPlane(208, 88,
      [[399, 708], [606, 696], [606, 784], [399, 796]], rect);
    corners.forEach((corner, index) => {
      corner.forEach((coordinate, axis) => {
        expect(Math.abs(coordinate - expected[index][axis])).toBeLessThan(0.05);
      });
    });
    expect(corners[0][0]).toBeCloseTo(corners[3][0], 5);
    expect(corners[1][0]).toBeCloseTo(corners[2][0], 5);
  });

  it.each([
    [[1072, 171], [1910, 98], [1910, 400], [1070, 417]],
    [[31, 693], [641, 649], [646, 801], [33, 829]]
  ] as const)('maps every corner to the reference drawing', (...corners) => {
    const matrix = projectPanel(600, 200, corners);
    [[0, 0], [600, 0], [600, 200], [0, 200]].forEach(([x, y], index) => {
      const divisor = matrix[3] * x + matrix[7] * y + 1;
      expect((matrix[0] * x + matrix[4] * y + matrix[12]) / divisor).toBeCloseTo(corners[index][0], 5);
      expect((matrix[1] * x + matrix[5] * y + matrix[13]) / divisor).toBeCloseTo(corners[index][1], 5);
    });
    expect(Math.abs(matrix[3]) + Math.abs(matrix[7])).toBeGreaterThan(0);
  });

  it('reprojects the existing plane through a yaw and pitch camera view', () => {
    const corners = [[970, 120], [1910, 8], [1910, 1068], [970, 958]] as const;
    const base = projectPanel(930, 952, corners);
    const view = createPanelView(930, 952, corners, 1000);
    const position = (matrix: number[]) => {
      const x = 465;
      const y = 476;
      const w = matrix[3] * x + matrix[7] * y + 1;
      return [(matrix[0] * x + matrix[4] * y + matrix[12]) / w,
        (matrix[1] * x + matrix[5] * y + matrix[13]) / w];
    };
    const original = position(base);
    const neutral = position(view(0, 0, [960, 540]));
    expect(neutral[0]).toBeCloseTo(original[0], 6);
    expect(neutral[1]).toBeCloseTo(original[1], 6);
    expect(position(view(1, 0, [960, 540]))[0]).toBeLessThan(original[0] - 10);
    expect(position(view(0, 1, [960, 540]))[1]).toBeLessThan(original[1] - 10);
  });
});
