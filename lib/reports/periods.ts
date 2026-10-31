import { addDays, formatBusinessDate, startOfMonth, startOfWeek } from "@/lib/time";
import { isCalendarDate, type DateRange } from "@/lib/reports/range";

// The periods of the Reports pages (spec 16): a day, a Monday-to-Sunday week,
// a calendar month, or a custom range, with the previous and next period for
// the arrows. All business dates in Africa/Accra.

export type PeriodKind = "daily" | "weekly" | "monthly" | "custom";

export interface Period {
  kind: PeriodKind;
  range: DateRange;
  label: string;
  /** The URL query that opens this period on its page (without the "?"). */
  query: string;
  previous: string | null;
  next: string | null;
}

const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

export function endOfMonth(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function monthOf(value: string, today: string): string {
  return /^\d{4}-\d{2}$/.test(value) && isCalendarDate(`${value}-01`) ? `${value}-01` : startOfMonth(today);
}

// A future period has nothing to show yet, so "next" stops at today's period.
function nextIfStarted(start: string, today: string, query: string): string | null {
  return start <= today ? query : null;
}

export function dailyPeriod(value: string, today: string): Period {
  const date = isCalendarDate(value) ? value : today;
  const next = addDays(date, 1);
  return {
    kind: "daily",
    range: { from: date, to: date },
    label: formatBusinessDate(date),
    query: `date=${date}`,
    previous: `date=${addDays(date, -1)}`,
    next: nextIfStarted(next, today, `date=${next}`),
  };
}

// Any date in the week opens that Monday-to-Sunday week.
export function weeklyPeriod(value: string, today: string): Period {
  const monday = startOfWeek(isCalendarDate(value) ? value : today);
  const sunday = addDays(monday, 6);
  const nextMonday = addDays(monday, 7);
  return {
    kind: "weekly",
    range: { from: monday, to: sunday },
    label: `Week of ${formatBusinessDate(monday)} to ${formatBusinessDate(sunday)}`,
    query: `week=${monday}`,
    previous: `week=${addDays(monday, -7)}`,
    next: nextIfStarted(nextMonday, today, `week=${nextMonday}`),
  };
}

// value: YYYY-MM
export function monthlyPeriod(value: string, today: string): Period {
  const first = monthOf(value, today);
  const last = endOfMonth(first);
  const previousFirst = startOfMonth(addDays(first, -1));
  const nextFirst = addDays(last, 1);
  return {
    kind: "monthly",
    range: { from: first, to: last },
    label: monthName.format(new Date(`${first}T00:00:00Z`)),
    query: `month=${first.slice(0, 7)}`,
    previous: `month=${previousFirst.slice(0, 7)}`,
    next: nextIfStarted(nextFirst, today, `month=${nextFirst.slice(0, 7)}`),
  };
}

export function customPeriod(from: string, to: string, today: string): Period {
  const start = isCalendarDate(from) ? from : today;
  const end = isCalendarDate(to) ? to : start;
  const range = start <= end ? { from: start, to: end } : { from: end, to: start };
  return {
    kind: "custom",
    range,
    label: range.from === range.to ? formatBusinessDate(range.from) : `${formatBusinessDate(range.from)} to ${formatBusinessDate(range.to)}`,
    query: `from=${range.from}&to=${range.to}`,
    previous: null,
    next: null,
  };
}
