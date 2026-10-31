import { describe, expect, it } from "vitest";

import { describeFeedEvent, isFeedType, type FeedEvent } from "./feed";

const base: Omit<FeedEvent, "type" | "data"> = {
  key: "k",
  at: "2026-10-30T14:32:00Z",
  tags: [],
  actor_id: "a",
  actor_name: "Abena (counter)",
  actor_role: "counter",
  unusual: false,
};

describe("describeFeedEvent", () => {
  it("describes a sale with its lines, staff, total, and payment, and links to it", () => {
    const event = {
      ...base,
      type: "sale",
      data: {
        sale_id: "s1",
        total: 15000,
        status: "paid",
        items: [
          { name: "Haircut", quantity: 1, staff: "Kofi" },
          { name: "Wash", quantity: 2, staff: "Ama" },
        ],
        methods: ["cash", "momo"],
      },
    };
    expect(describeFeedEvent(event)).toEqual({
      sentence: "Abena (counter) sold Haircut (Kofi), Wash x2 (Ama) for GHS 150.00 by cash + MoMo",
      reason: null,
      href: "/pos/sales/s1",
    });
  });

  it("puts the person in front of the change log's sentence, with the reason", () => {
    const event = {
      ...base,
      type: "staff_reassigned",
      data: {
        entity: "sale_item",
        entity_id: "i1",
        before: { item_name: "Haircut", staff_name: "Kofi" },
        after: { staff_name: "Kwame", sale_id: "s1", receipt_no: "BLS-000412" },
        reason: "Staff was busy",
      },
    };
    expect(describeFeedEvent(event)).toEqual({
      sentence: "Abena (counter) moved Haircut from Kofi to Kwame on BLS-000412",
      reason: "Staff was busy",
      href: "/pos/sales/s1",
    });
  });

  it("describes a close with the count and the difference", () => {
    const event = {
      ...base,
      type: "day_closed",
      data: { after: { business_date: "2026-10-30", counted_cash: 142500, expected_cash: 143000, cash_difference: -500 } },
    };
    expect(describeFeedEvent(event)).toMatchObject({
      sentence: "Abena (counter) closed Fri 30 Oct: counted GHS 1,425.00, expected GHS 1,430.00, short by GHS 5.00",
      href: "/pos/close-day?date=2026-10-30",
    });
  });

  it("describes sign-ins and failed backups", () => {
    expect(describeFeedEvent({ ...base, type: "sign_in", data: {} }).sentence).toBe("Abena (counter) signed in");
    expect(
      describeFeedEvent({ ...base, type: "backup_failed", actor_name: null, actor_role: "system", data: { kind: "daily_pc", message: "Disk full" } }),
    ).toEqual({ sentence: "The PC backup failed", reason: "Disk full", href: "/pos/backups" });
  });
});

describe("isFeedType", () => {
  it("accepts only the feed's filter values", () => {
    expect(isFeedType("void_requests")).toBe(true);
    expect(isFeedType("toString")).toBe(false);
  });
});
