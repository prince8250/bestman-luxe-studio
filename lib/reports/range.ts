import { addDays, startOfMonth, startOfWeek } from "@/lib/time";

// The one date-range helper for the POS (spec 14): Sales, the Dashboard, and
// Reports all turn "This week" into the same business dates. Dates are
// YYYY-MM-DD business dates in Africa/Accra; weeks start on Monday.

export interface DateRange {
  /** First business date, inclusive. */
  from: string;
  /** Last business date, inclusive. */
  to: string;
}

export const RANGE_PRESETS = ["today", "yesterday", "week", "month", "30d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const RANGE_LABEL: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  month: "This month",
  "30d": "Last 30 days",
  custom: "Custom dates",
};

// A real calendar date in YYYY-MM-DD form (2026-02-31 is refused, so a bad
// link falls back to today instead of failing in the database).
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// The business dates a preset covers on `today`. Custom dates are put in
// order; a missing or impossible end falls back to the start, and a missing
// start to today.
export function rangeFor(preset: RangePreset, today: string, from = "", to = ""): DateRange {
  switch (preset) {
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "week":
      return { from: startOfWeek(today), to: today };
    case "month":
      return { from: startOfMonth(today), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "custom": {
      const start = isCalendarDate(from) ? from : today;
      const end = isCalendarDate(to) ? to : start;
      return start <= end ? { from: start, to: end } : { from: end, to: start };
    }
    default:
      return { from: today, to: today };
  }
}

// How many days a range covers (both ends included).
export function rangeDays(range: DateRange): number {
  return Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000) + 1;
}

// The report functions refuse a period longer than two years
// (private.report_guard: to - from > 731 days), so a page checks first and
// says so instead of failing.
export const MAX_RANGE_SPAN_DAYS = 731;
export function isRangeTooLong(range: DateRange): boolean {
  return rangeDays(range) - 1 > MAX_RANGE_SPAN_DAYS;
}

// The previous period of the same length, as report_summary compares it
// (a week against the week before; 1-31 March against the 31 days before).
export function previousRange(range: DateRange): DateRange {
  const days = rangeDays(range);
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}
