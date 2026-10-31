import { describe, expect, it } from "vitest";

import { customPeriod, dailyPeriod, endOfMonth, monthlyPeriod, weeklyPeriod } from "./periods";

const today = "2026-10-30"; // a Friday

describe("report periods", () => {
  it("moves day by day, never past today", () => {
    const day = dailyPeriod("2026-10-29", today);
    expect(day.range).toEqual({ from: "2026-10-29", to: "2026-10-29" });
    expect(day.previous).toBe("date=2026-10-28");
    expect(day.next).toBe("date=2026-10-30");
    expect(dailyPeriod("", today).next).toBeNull();
    expect(dailyPeriod("2026-02-31", today).range.from).toBe(today);
  });

  it("opens the Monday-to-Sunday week of any date", () => {
    const week = weeklyPeriod("2026-10-28", today);
    expect(week.range).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(week.previous).toBe("week=2026-10-19");
    expect(week.next).toBeNull();
    expect(weeklyPeriod("2026-10-18", today).next).toBe("week=2026-10-19");
  });

  it("covers whole calendar months, including February in a leap year", () => {
    expect(monthlyPeriod("2028-02", today).range).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    const october = monthlyPeriod("", today);
    expect(october.range).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(october.label).toBe("October 2026");
    expect(october.previous).toBe("month=2026-09");
    expect(october.next).toBeNull();
    expect(monthlyPeriod("2026-01", today).previous).toBe("month=2025-12");
    expect(endOfMonth("2026-12-15")).toBe("2026-12-31");
  });

  it("orders a custom range", () => {
    expect(customPeriod("2026-10-20", "2026-10-01", today).range).toEqual({ from: "2026-10-01", to: "2026-10-20" });
  });
});
