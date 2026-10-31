import { describe, expect, it } from "vitest";

import { changeLink, CHANGE_TYPES, describeChange, isChangeType, type ChangeRow } from "./changes";

const row = (overrides: Partial<ChangeRow>): ChangeRow => ({
  action: "x",
  entity: "sale",
  entity_id: null,
  actor_name: "Abena",
  actor_role: "counter",
  before: null,
  after: null,
  reason: null,
  created_at: "2026-10-30T10:00:00Z",
  ...overrides,
});

describe("describeChange", () => {
  it("names the receipt on sale-line changes", () => {
    const moved = row({
      action: "staff_reassigned",
      entity: "sale_item",
      before: { item_name: "Haircut", staff_name: "Kofi", sale_id: "s1", receipt_no: "BLS-000412" },
      after: { staff_name: "Kwame" },
    });
    expect(describeChange(moved)).toBe("Moved Haircut from Kofi to Kwame on BLS-000412");
    expect(changeLink(moved)).toBe("/pos/sales/s1");
  });

  it("writes catalog, settings, and account changes plainly", () => {
    expect(describeChange(row({ action: "service_price_changed", entity: "service", before: { name: "Facial", price: 15000 }, after: { name: "Facial", price: 16000 } }))).toBe(
      "Changed the price of Facial from GHS 150.00 to GHS 160.00",
    );
    expect(describeChange(row({ action: "settings_changed", entity: "settings", after: { receipt_footer: "x", phone: "y" } }))).toBe(
      "Changed settings: receipt_footer, phone",
    );
    expect(describeChange(row({ action: "account_deactivated", entity: "profile", after: { display_name: "Abena" } }))).toBe("Deactivated Abena");
    expect(changeLink(row({ action: "settings_changed", entity: "settings" }))).toBe("/pos/settings");
  });
});

describe("CHANGE_TYPES", () => {
  it("groups every filterable action once", () => {
    const actions = Object.values(CHANGE_TYPES).flatMap((type) => type.actions);
    expect(new Set(actions).size).toBe(actions.length);
    expect(isChangeType("voids")).toBe(true);
    expect(isChangeType("toString")).toBe(false);
  });
});
