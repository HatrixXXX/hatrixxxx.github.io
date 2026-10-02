import { describe, expect, it } from 'vitest';
import { projectPanel, projectRectOnPanelPlane } from '../../src/lib/home-projection';

describe('home panel perspective', () => {
  it('projects an arbitrary rectangle through the existing player plane', () => {
    const corners = projectRectOnPanelPlane(380, 195,
      [[12, 785], [387, 768], [392, 948], [15, 976]],
      { x: 0, y: -114, width: 625, height: 110 });
    const expected = [[10.26305, 674.41448], [603.50004, 657.45311], [606.88318, 754.48643], [11.93884, 781.10645]];
    corners.forEach((corner, index) => {
      corner.forEach((coordinate, axis) => {
        expect(Math.abs(coordinate - expected[index][axis])).toBeLessThan(0.05);
      });
    });
  });

  it.each([
    {
      width: 380, height: 195,
      plane: [[12, 785], [387, 768], [392, 948], [15, 976]],
      rect: { x: 0, y: 0, width: 380, height: 184 },
      expected: [[12, 785], [387, 768], [391.71641, 937.79070], [14.82979, 965.16324]]
    },
    {
      width: 208, height: 88,
      plane: [[399, 768], [606, 756], [607, 843], [401, 855]],
      rect: { x: 0, y: 92, width: 208, height: 80 },
      expected: [[401.09045, 858.93459], [607.04523, 846.93460], [607.94559, 925.26595], [402.89116, 937.26544]]
    }
  ] as const)('projects the lower-stack rectangle at $rect.height design pixels', ({ width, height, plane, rect, expected }) => {
    const corners = projectRectOnPanelPlane(width, height, plane, rect);
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
