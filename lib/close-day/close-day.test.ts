import { describe, expect, it } from "vitest";

import { closeDaySchema, dayReportFileNames } from "./close-day";

const base = { date: "2026-10-31", counted: "1,250.50", momo: "", float: "200", floatReason: "", note: "" };

describe("closeDaySchema", () => {
  it("turns the typed amounts into pesewas", () => {
    expect(closeDaySchema(20000).parse({ ...base, momo: "185", note: "  All good " })).toEqual({
      date: "2026-10-31",
      countedCash: 125050,
      momoReported: 18500,
      openingFloat: 20000,
      openingFloatReason: null,
      note: "All good",
    });
  });

  it("leaves the MoMo total out when it is empty", () => {
    expect(closeDaySchema(20000).parse(base).momoReported).toBeNull();
  });

  it("needs a reason only when the opening float differs from Settings", () => {
    const changed = closeDaySchema(20000).safeParse({ ...base, float: "150" });
    expect(changed.success).toBe(false);
    expect(changed.error?.issues[0]).toMatchObject({ path: ["floatReason"], message: "Say why the opening float is different today." });
    expect(closeDaySchema(20000).parse({ ...base, float: "150", floatReason: "Change for the morning" })).toMatchObject({
      openingFloat: 15000,
      openingFloatReason: "Change for the morning",
    });
  });

  it("refuses a missing count, a bad amount, or an impossible date, naming the field", () => {
    // The default float matches base.float (200), so only the field under test is wrong.
    const failedFields = (input: Partial<typeof base>) => {
      const result = closeDaySchema(20000).safeParse({ ...base, ...input });
      return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
    };
    expect(failedFields({})).toEqual([]);
    expect(failedFields({ counted: "" })).toEqual(["counted"]);
    expect(failedFields({ counted: "-5" })).toEqual(["counted"]);
    expect(failedFields({ momo: "abc" })).toEqual(["momo"]);
    expect(failedFields({ date: "2026-02-31" })).toEqual(["date"]);
  });
});

describe("dayReportFileNames", () => {
  it("names the files by the business date", () => {
    expect(dayReportFileNames("2026-10-31")).toEqual({ csv: "bestman-day-report-2026-10-31.csv", html: "bestman-day-report-2026-10-31.html" });
  });
});
