import { describe, expect, it } from 'vitest';
import { projectPanel, projectRectOnPanelPlane } from '../../src/lib/home-projection';

describe('home panel perspective', () => {
  it.each([
    {
      name: 'quote', rect: { x: -392, y: -114, width: 600, height: 110 },
      expected: [[8.88462, 676.61538], [606, 642], [606, 752], [8.88462, 786.61538]]
    },
    {
      name: 'music', rect: { x: -392, y: 0, width: 380, height: 172 },
      expected: [[8.88462, 790.61538], [387.05769, 768.69231], [387.05769, 940.69231], [8.88462, 962.61538]]
    },
    {
      name: 'friends', rect: { x: 0, y: 0, width: 208, height: 88 },
      expected: [[399, 768], [606, 756], [606, 844], [399, 856]]
    },
    {
      name: 'guestbook', rect: { x: 0, y: 92, width: 208, height: 80 },
      expected: [[399, 860], [606, 848], [606, 928], [399, 940]]
    }
  ] as const)('projects $name through the shared affine lower-left plane', ({ rect, expected }) => {
    const corners = projectRectOnPanelPlane(208, 88,
      [[399, 768], [606, 756], [606, 844], [399, 856]], rect);
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
});
