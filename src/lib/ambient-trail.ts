export function ambientTrailCount(gutterWidth: number): number {
  if (gutterWidth < 64) return 0;
  return Math.min(4, Math.max(1, Math.ceil(gutterWidth / 180)));
}
