export function latestPostLimit(headingCount: number): number {
  if (headingCount >= 20) return 2;
  if (headingCount >= 16) return 3;
  if (headingCount >= 12) return 4;
  if (headingCount >= 8) return 5;
  return 6;
}
