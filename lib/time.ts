// The one place that turns timestamps into studio days and clock times.
// Timestamps are stored in UTC; "which day is it" and every displayed time
// use the studio's time zone, Africa/Accra (code-standards.md).

export const STUDIO_TIME_ZONE = "Africa/Accra";

const isoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: STUDIO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: STUDIO_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dayAndTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: STUDIO_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const fullDateAndTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: STUDIO_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const zoneParts = new Intl.DateTimeFormat("en-US", {
  timeZone: STUDIO_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

// The studio's business date (YYYY-MM-DD) for a moment, today by default.
export function accraDate(value: Date | string = new Date()): string {
  return isoDate.format(toDate(value));
}

// Minutes the studio's clock is ahead of UTC at that moment (0 for Accra,
// computed rather than assumed so the helper stays correct anywhere).
function zoneOffsetMinutes(date: Date): number {
  const parts = Object.fromEntries(zoneParts.formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

// The UTC instant when a studio business date begins (local midnight).
export function accraDayStart(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day));
  return new Date(guess.getTime() - zoneOffsetMinutes(guess) * 60000);
}

// Calendar arithmetic on business dates (YYYY-MM-DD), independent of any zone.
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// The Monday of that date's week (weeks start on Monday).
export function startOfWeek(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

// "Fri 30 Oct 2026" for a business date.
export function formatBusinessDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const dayAndMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  return `${dayAndMonth.format(new Date(Date.UTC(year, month - 1, day)))} ${year}`;
}

// "08:12"
export function formatAccraTime(value: Date | string): string {
  return clock.format(toDate(value));
}

// "Fri 30 Oct, 08:12"
export function formatAccraDayTime(value: Date | string): string {
  return dayAndTime.format(toDate(value));
}

// "Fri 30 Oct 2026, 08:12" (receipts)
export function formatAccraDateTime(value: Date | string): string {
  return fullDateAndTime.format(toDate(value));
}
