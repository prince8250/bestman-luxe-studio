import { describe, expect, it } from "vitest";

import { isCalendarDate, isRangeTooLong, previousRange, rangeDays, rangeFor } from "./range";

const today = "2026-10-30"; // a Friday

describe("rangeFor", () => {
  it("turns presets into business dates (weeks start on Monday)", () => {
    expect(rangeFor("today", today)).toEqual({ from: today, to: today });
    expect(rangeFor("yesterday", today)).toEqual({ from: "2026-10-29", to: "2026-10-29" });
    expect(rangeFor("week", today)).toEqual({ from: "2026-10-26", to: today });
    expect(rangeFor("week", "2026-11-01")).toEqual({ from: "2026-10-26", to: "2026-11-01" }); // a Sunday
    expect(rangeFor("month", today)).toEqual({ from: "2026-10-01", to: today });
    expect(rangeFor("30d", today)).toEqual({ from: "2026-10-01", to: today });
  });

  it("orders custom dates and fills a missing or impossible end", () => {
    expect(rangeFor("custom", today, "2026-10-20", "2026-10-10")).toEqual({ from: "2026-10-10", to: "2026-10-20" });
    expect(rangeFor("custom", today, "2026-10-20", "")).toEqual({ from: "2026-10-20", to: "2026-10-20" });
    expect(rangeFor("custom", today, "2026-02-31", "")).toEqual({ from: today, to: today });
  });
});

describe("previousRange", () => {
  it("is the period of the same length just before (as report_summary compares)", () => {
    expect(previousRange({ from: "2000-01-03", to: "2000-01-09" })).toEqual({ from: "1999-12-27", to: "2000-01-02" });
    expect(previousRange({ from: "2000-01-01", to: "2000-01-31" })).toEqual({ from: "1999-12-01", to: "1999-12-31" });
    expect(previousRange({ from: "2026-03-01", to: "2026-03-31" })).toEqual({ from: "2026-01-29", to: "2026-02-28" });
    expect(rangeDays({ from: "2026-10-30", to: "2026-10-30" })).toBe(1);
  });
});

describe("isRangeTooLong", () => {
  it("matches the report functions' two-year limit (to - from <= 731 days)", () => {
    expect(isRangeTooLong({ from: "2024-10-29", to: today })).toBe(false); // 731 days apart
    expect(isRangeTooLong({ from: "2024-10-28", to: today })).toBe(true); // 732 days apart
    expect(isRangeTooLong({ from: today, to: today })).toBe(false);
  });
});

describe("isCalendarDate", () => {
  it("accepts real dates only", () => {
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-02-31")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-1-01")).toBe(false);
  });
});
