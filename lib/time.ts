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
