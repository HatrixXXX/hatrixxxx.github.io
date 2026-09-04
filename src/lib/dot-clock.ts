export interface ClockPoint {
  x: number;
  y: number;
  characterIndex: number;
}

const glyphs: Record<string, readonly string[]> = {
  '0': ['11111', '10001', '10001', '10001', '10001', '10001', '11111'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['11110', '00001', '00001', '11110', '10000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['10010', '10010', '10010', '11111', '00010', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01111', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '11110'],
  ':': ['0', '0', '1', '0', '1', '0', '0']
};

export function formatClockTime(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function changedDigitIndexes(previous: string, next: string): number[] {
  return [...previous].flatMap((value, index) =>
    value !== ':' && value !== next[index] ? [index] : []
  );
}

export function dotRadiusForSpacing(spacing: number): number {
  return Math.max(1.25, spacing * 0.34);
}

export function pointsForClock(value: string): ClockPoint[] {
  if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new RangeError('clock value must use HH:mm:ss');
  }
  const points: ClockPoint[] = [];
  let offset = 0;
  for (const [characterIndex, character] of [...value].entries()) {
    const rows = glyphs[character];
    for (const [y, row] of rows.entries()) {
      for (const [x, cell] of [...row].entries()) {
        if (cell === '1') points.push({ x: offset + x, y, characterIndex });
      }
    }
    offset += rows[0].length + 1;
  }
  return points;
}
