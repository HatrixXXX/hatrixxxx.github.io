export function latestPostLimit(headingCount: number): number {
  if (headingCount >= 20) return 0;
  if (headingCount >= 16) return 1;
  if (headingCount >= 12) return 2;
  if (headingCount >= 8) return 3;
  return 4;
}
