import { describe, expect, it } from "vitest";

import { can, PERMISSIONS, type PosAction } from "@/lib/auth/permissions";

// Mirrors the Permissions table in context/architecture-context.md. If the
// table changes, this test and permissions.ts change together.
const counterAllowed: PosAction[] = [
  "sale.create",
  "sale.reprint",
  "sale.overridePrice",
  "sale.customItem",
  "sale.reassignToday",
  "sale.requestVoid",
  "sale.recordPast",
  "sales.viewToday",
  "day.close",
  "day.closeReport",
  "today.view",
  "appointments.manage",
  "customers.view",
  "customers.edit",
];

const ownerOnly: PosAction[] = [
  "sale.reassignAny",
  "sale.editPaid",
  "sale.void",
  "sale.decideVoid",
  "sales.viewAll",
  "day.reopen",
  "day.viewHistory",
  "customers.block",
  "dashboard.view",
  "reports.view",
  "activity.view",
  "catalog.edit",
  "settings.edit",
  "accounts.manage",
  "backups.view",
];

describe("permissions", () => {
  it("lets the counter run the counter", () => {
    for (const action of counterAllowed) expect(can("counter", action), action).toBe(true);
  });

  it("keeps money removal, finances, the catalog, and settings owner-only", () => {
    for (const action of ownerOnly) {
      expect(can("owner", action), action).toBe(true);
      expect(can("counter", action), action).toBe(false);
    }
  });

  it("asks the counter to request a void instead of voiding", () => {
    expect(can("counter", "sale.requestVoid")).toBe(true);
    expect(can("counter", "sale.void")).toBe(false);
    expect(can("owner", "sale.requestVoid")).toBe(false);
  });

  it("covers every action exactly once in this test", () => {
    const tested = new Set<string>([...counterAllowed, ...ownerOnly, "sale.requestVoid"]);
    expect([...tested].sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });
});
