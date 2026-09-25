export type Point = readonly [number, number];

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
