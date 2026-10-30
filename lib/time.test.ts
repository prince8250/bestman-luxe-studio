import { describe, expect, it } from "vitest";

import { accraDate, accraDayStart, formatAccraDayTime, formatAccraTime } from "@/lib/time";

describe("studio time (Africa/Accra)", () => {
  it("gives the business date in Accra", () => {
    expect(accraDate("2026-10-30T23:59:00Z")).toBe("2026-10-30");
    expect(accraDate("2026-10-31T00:01:00Z")).toBe("2026-10-31");
  });

  it("finds the UTC start of a business day", () => {
    expect(accraDayStart("2026-10-30").toISOString()).toBe("2026-10-30T00:00:00.000Z");
  });

  it("formats clock times with a 24-hour clock", () => {
    expect(formatAccraTime("2026-10-30T08:12:00Z")).toBe("08:12");
    expect(formatAccraTime("2026-10-30T20:41:00Z")).toBe("20:41");
    expect(formatAccraDayTime("2026-10-30T08:12:00Z")).toBe("Fri 30 Oct, 08:12");
  });
});
