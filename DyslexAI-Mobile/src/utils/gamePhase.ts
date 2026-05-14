export function phaseForDay(dayNumber: number): number {
  const d = Math.max(1, Math.min(90, Math.floor(dayNumber || 1)));
  if (d <= 7) return 1;
  if (d <= 21) return 2;
  if (d <= 35) return 3;
  if (d <= 49) return 4;
  if (d <= 63) return 5;
  return 6;
}

export function phaseDayRange(phase: number): [number, number] {
  const p = Math.max(1, Math.min(6, Math.floor(phase || 1)));
  const ranges: Record<number, [number, number]> = {
    1: [1, 7],
    2: [8, 21],
    3: [22, 35],
    4: [36, 49],
    5: [50, 63],
    6: [64, 90],
  };
  return ranges[p] ?? [1, 7];
}

