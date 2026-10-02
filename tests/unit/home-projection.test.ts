import { describe, expect, it } from 'vitest';
import { projectPanel, projectRectOnPanelPlane } from '../../src/lib/home-projection';

describe('home panel perspective', () => {
  it('projects an arbitrary rectangle through the existing player plane', () => {
    const corners = projectRectOnPanelPlane(380, 195,
      [[12, 785], [387, 768], [392, 948], [15, 976]],
      { x: 0, y: -126, width: 625, height: 110 });
    const expected = [[10.08, 662.82], [603.13, 646.90], [606.51, 743.87], [11.76, 769.43]];
    corners.forEach((corner, index) => {
      corner.forEach((coordinate, axis) => {
        expect(Math.abs(coordinate - expected[index][axis])).toBeLessThan(0.05);
      });
    });
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
