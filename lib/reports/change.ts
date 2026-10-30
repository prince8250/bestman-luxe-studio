// Percent change from the previous period, rounded to one decimal; null when
// there is nothing to compare with (the previous period was zero).
export function percentChangeOf(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
