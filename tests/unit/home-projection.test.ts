import { describe, expect, it } from 'vitest';
import { projectPanel, projectRectOnPanelPlane } from '../../src/lib/home-projection';

describe('home panel perspective', () => {
  it.each([
    {
      name: 'quote', rect: { x: -392, y: -114, width: 600, height: 110 },
      expected: [[3.03235, 676.69026], [604.69004, 642.03334], [605.95432, 752.02541], [7.95288, 786.68447]]
    },
    {
      name: 'music', rect: { x: -392, y: 0, width: 380, height: 172 },
      expected: [[8.13068, 790.65909], [387.04924, 768.69280], [391.05280, 937.95820], [15.70261, 959.92314]]
    },
    {
      name: 'friends', rect: { x: 0, y: 0, width: 208, height: 88 },
      expected: [[399, 768], [606, 756], [607, 843], [401, 855]]
    },
    {
      name: 'guestbook', rect: { x: 0, y: 92, width: 208, height: 80 },
      expected: [[401.09045, 858.93459], [607.04523, 846.93460], [607.94559, 925.26595], [402.89116, 937.26544]]
    }
  ] as const)('projects $name through the unchanged friends plane', ({ rect, expected }) => {
    const corners = projectRectOnPanelPlane(208, 88,
      [[399, 768], [606, 756], [607, 843], [401, 855]], rect);
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
