import { describe, expect, it } from "vitest";

import { can } from "@/lib/auth/permissions";
import { classifyFindQuery } from "@/lib/pos/find";
import { bottomBarKeys, isActivePath, sidebarItems } from "@/lib/pos/navigation";

describe("POS navigation", () => {
  it("shows each role only items it is allowed to use", () => {
    for (const role of ["owner", "counter"] as const) {
      for (const item of sidebarItems(role)) expect(can(role, item.permission), `${role}:${item.key}`).toBe(true);
    }
  });

  it("lists the counter's items from ui-context.md and nothing owner-only", () => {
    expect(sidebarItems("counter").map((item) => item.label)).toEqual([
      "Today",
      "Sales (today)",
      "Appointments",
      "Customers",
      "Close day",
    ]);
  });

  it("lists the owner's items from ui-context.md", () => {
    expect(sidebarItems("owner").map((item) => item.label)).toEqual([
      "Dashboard",
      "Activity",
      "Sales",
      "Appointments",
      "Customers",
      "Staff",
      "Services",
      "Gallery",
      "Offers",
      "Reports",
      "Backups",
      "Settings",
    ]);
  });

  it("uses the phone bottom bars from ui-context.md", () => {
    expect(bottomBarKeys("owner")).toEqual(["dashboard", "activity", "appointments", "sales"]);
    expect(bottomBarKeys("counter")).toEqual(["new-sale", "today", "appointments", "sales"]);
  });

  it("marks the active section", () => {
    expect(isActivePath("/pos", "/pos")).toBe(true);
    expect(isActivePath("/pos/sales", "/pos")).toBe(false);
    expect(isActivePath("/pos/sales/abc", "/pos/sales")).toBe(true);
    expect(isActivePath("/pos/reports/weekly", "/pos/reports/daily")).toBe(true);
  });
});

describe("classifyFindQuery", () => {
  it("recognises receipt numbers in any common form", () => {
    expect(classifyFindQuery("BLS-000123")).toEqual({ kind: "receipt", value: "BLS-000123" });
    expect(classifyFindQuery("bls 123")).toEqual({ kind: "receipt", value: "BLS-000123" });
  });

  it("recognises booking codes", () => {
    expect(classifyFindQuery("bk-7k4q")).toEqual({ kind: "booking", value: "BK-7K4Q" });
  });

  it("recognises phone numbers", () => {
    expect(classifyFindQuery("024 123 4567")).toEqual({ kind: "phone", value: "0241234567" });
    expect(classifyFindQuery("+233 24 123 4567")).toEqual({ kind: "phone", value: "+233241234567" });
  });

  it("leaves anything else as unknown", () => {
    expect(classifyFindQuery("Ama")).toEqual({ kind: "unknown", value: "Ama" });
  });
});
