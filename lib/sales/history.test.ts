import { describe, expect, it } from "vitest";

import { describeHistory } from "./describe";
import { parseSalesQuery, parseSalesSearch, salesHref } from "./history";

const today = "2026-10-30"; // a Friday

describe("parseSalesSearch", () => {
  it("reads receipt numbers in any common form", () => {
    expect(parseSalesSearch("BLS-000213")).toEqual({ receipt_no: "BLS-000213" });
    expect(parseSalesSearch("bls213")).toEqual({ receipt_no: "BLS-000213" });
    expect(parseSalesSearch("213")).toEqual({ receipt_no: "BLS-000213" });
  });

  it("reads Ghana phone numbers", () => {
    expect(parseSalesSearch("024 456 5866")).toEqual({ phone: "+233244565866" });
  });

  it("explains anything else", () => {
    expect(parseSalesSearch("Ama")).toHaveProperty("error");
  });
});

describe("parseSalesQuery", () => {
  it("defaults to today, page 1", () => {
    const query = parseSalesQuery({}, today);
    expect(query.filters).toEqual({ limit: 50, offset: 0, from: today, to: today });
    expect(query.page).toBe(1);
  });

  it("keeps only valid filters", () => {
    const query = parseSalesQuery(
      { range: "week", method: "momo", channel: "nope", staff: "not-a-uuid", status: "voided", page: "3" },
      today,
    );
    expect(query.filters).toEqual({ limit: 50, offset: 100, method: "momo", status: "voided", from: "2026-10-26", to: today });
  });

  it("searches all dates for a receipt number", () => {
    const query = parseSalesQuery({ q: "BLS-000005", range: "today" }, today);
    expect(query.filters).toEqual({ limit: 50, offset: 0, receipt_no: "BLS-000005" });
    expect(query.dates).toBeNull();
  });

  it("falls back to the date range when the search is not understood", () => {
    const query = parseSalesQuery({ q: "Ama" }, today);
    expect(query.searchError).not.toBeNull();
    expect(query.filters.from).toBe(today);
  });
});

describe("salesHref", () => {
  it("keeps filters, drops defaults, and sets the page", () => {
    const values = parseSalesQuery({ range: "custom", from: "2026-10-01", to: "2026-10-07", method: "cash" }, today).values;
    expect(salesHref(values, { page: 2 })).toBe("/pos/sales?range=custom&from=2026-10-01&to=2026-10-07&method=cash&page=2");
    expect(salesHref(values, { range: "today", from: "", to: "" })).toBe("/pos/sales?method=cash");
  });
});

describe("describeHistory", () => {
  const entry = { actor_name: "Abena", actor_role: "counter", reason: null, created_at: "2026-10-30T10:00:00Z" };
  it("writes one plain sentence per change", () => {
    expect(
      describeHistory({
        ...entry,
        action: "staff_reassigned",
        before: { item_name: "Haircut", staff_name: "Kofi" },
        after: { staff_name: "Kwame" },
      }),
    ).toBe("Moved Haircut from Kofi to Kwame");
    expect(
      describeHistory({
        ...entry,
        action: "item_price_overridden",
        before: { list_price: 5000 },
        after: { unit_price: 4000, item_name: "Haircut" },
      }),
    ).toBe("Charged GHS 40.00 for Haircut instead of GHS 50.00");
    expect(describeHistory({ ...entry, action: "void_requested", before: null, after: null })).toBe("Asked the owner to void the sale");
  });
});

describe("parseSalesQuery dates", () => {
  it("treats an impossible date in the link as empty, so the range falls back to today", () => {
    const query = parseSalesQuery({ range: "custom", from: "2026-02-31", to: "2026-13-40" }, today);
    expect(query.values.from).toBe("");
    expect(query.filters).toMatchObject({ from: today, to: today });
  });
});
