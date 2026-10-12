export type Point = readonly [number, number];

export interface PlaneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Map the rectangle to TL, TR, BR, BL reference corners, including perspective. */
export function projectPanel(width: number, height: number, corners: readonly Point[]): number[] {
  const [a, b, c, d] = corners;
  const dx1 = b[0] - c[0];
  const dx2 = d[0] - c[0];
  const dy1 = b[1] - c[1];
  const dy2 = d[1] - c[1];
  const sx = a[0] - b[0] + c[0] - d[0];
  const sy = a[1] - b[1] + c[1] - d[1];
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / denominator;
  const h = (dx1 * sy - sx * dy1) / denominator;
  return [
    (b[0] - a[0] + g * b[0]) / width, (b[1] - a[1] + g * b[1]) / width, 0, g / width,
    (d[0] - a[0] + h * d[0]) / height, (d[1] - a[1] + h * d[1]) / height, 0, h / height,
    0, 0, 1, 0,
    a[0], a[1], 0, 1
  ];
}

function transformPoint(matrix: readonly number[], [x, y]: Point): Point {
  const projectedX = matrix[0] * x + matrix[4] * y + matrix[12];
  const projectedY = matrix[1] * x + matrix[5] * y + matrix[13];
  const projectedW = matrix[3] * x + matrix[7] * y + matrix[15];
  return [projectedX / projectedW, projectedY / projectedW];
}

export function projectRectOnPanelPlane(
  panelWidth: number,
  panelHeight: number,
  panelCorners: readonly Point[],
  rect: PlaneRect,
): [Point, Point, Point, Point] {
  const matrix = projectPanel(panelWidth, panelHeight, panelCorners);
  return [
    transformPoint(matrix, [rect.x, rect.y]),
    transformPoint(matrix, [rect.x + rect.width, rect.y]),
    transformPoint(matrix, [rect.x + rect.width, rect.y + rect.height]),
    transformPoint(matrix, [rect.x, rect.y + rect.height]),
  ];
}

/** Reproject a fixed panel plane as the viewer turns their head around the camera eye. */
export function createPanelView(
  width: number,
  height: number,
  corners: readonly Point[],
  focalLength: number,
): (yawDegrees: number, pitchDegrees: number, center: Point) => number[] {
  const base = projectPanel(width, height, corners);
  const localCorners: Point[] = [[0, 0], [width, 0], [width, height], [0, height]];

  return (yawDegrees, pitchDegrees, [centerX, centerY]) => {
    const yaw = yawDegrees * Math.PI / 180;
    const pitch = pitchDegrees * Math.PI / 180;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const viewedCorners = localCorners.map(([x, y]): Point => {
      const w = base[3] * x + base[7] * y + 1;
      const worldX = base[0] * x + base[4] * y + base[12] - centerX * w;
      const worldY = base[1] * x + base[5] * y + base[13] - centerY * w;
      const worldZ = -focalLength * w;
      const turnedX = cosYaw * worldX + sinYaw * worldZ;
      const turnedZ = -sinYaw * worldX + cosYaw * worldZ;
      const turnedY = cosPitch * worldY + sinPitch * turnedZ;
      const depth = sinPitch * worldY - cosPitch * turnedZ;
      return [centerX + focalLength * turnedX / depth, centerY + focalLength * turnedY / depth];
    });
    return projectPanel(width, height, viewedCorners);
  };
}
