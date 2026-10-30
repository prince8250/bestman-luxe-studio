import { describe, expect, it } from "vitest";

import { parsePaper, parseReceipt, receiptCopies, socialHandle, type ReceiptData } from "./receipt";

function line(staffId: string | null, staffName: string | null): ReceiptData["lines"][number] {
  return {
    line_no: 1,
    name: "Haircut",
    custom: false,
    quantity: 1,
    list_price: 5000,
    unit_price: 5000,
    line_total: 5000,
    staff_id: staffId,
    staff_name: staffName,
  };
}

function receipt(copies: number, lines: ReceiptData["lines"]) {
  return {
    lines,
    studio: { name: "Bestman", address: null, phone: null, whatsapp: null, header: null, footer: null, copies, social_links: {} },
  };
}

describe("receiptCopies", () => {
  it("prints the customer copy and one STAFF COPY by default", () => {
    expect(receiptCopies(receipt(2, [line("a", "Ama")]))).toEqual([
      { key: "customer", kind: "customer" },
      { key: "staff-1", kind: "staff", staffName: "Ama" },
    ]);
  });

  it("prints only the customer copy when copies is 1", () => {
    expect(receiptCopies(receipt(1, [line("a", "Ama"), line("b", "Kofi")]))).toHaveLength(1);
  });

  it("gives every staff member on the sale their own STAFF COPY", () => {
    const copies = receiptCopies(receipt(2, [line("a", "Ama"), line("b", "Kofi"), line("a", "Ama")]));
    expect(copies.map((copy) => (copy.kind === "staff" ? copy.staffName : "customer"))).toEqual(["customer", "Ama", "Kofi"]);
  });

  it("prints the extra copies from settings for a one-person sale", () => {
    expect(receiptCopies(receipt(3, [line("a", "Ama")]))).toHaveLength(3);
  });

  it("prints unnamed staff copies when no staff is on the sale (a custom item only)", () => {
    expect(receiptCopies(receipt(2, [line(null, null)]))[1]).toEqual({ key: "staff-1", kind: "staff", staffName: null });
  });
});

describe("parseReceipt", () => {
  it("accepts receipt_data and rejects anything else", () => {
    const data = {
      id: "x",
      receipt_no: "BLS-000001",
      status: "paid",
      paid_at: "2026-10-30T09:45:06Z",
      recorded_at: "2026-10-30T09:45:06Z",
      is_backdated: false,
      after_close: false,
      customer_name: null,
      subtotal: 5000,
      discount_total: 0,
      total: 5000,
      counter_name: "Abena",
      prints: 0,
      lines: [line("a", "Ama")],
      payments: [{ kind: "payment", method: "cash", amount: 5000, tendered: 10000, reference: null }],
      studio: { ...receipt(2, []).studio, social_links: { instagram: "https://www.instagram.com/x" } },
    };
    expect(parseReceipt(data).receipt_no).toBe("BLS-000001");
    expect(() => parseReceipt({ ...data, total: "50" })).toThrow();
  });
});

describe("socialHandle", () => {
  it("turns a profile link into a handle", () => {
    expect(socialHandle("https://www.instagram.com/bestman_luxe_studio_?dlrf=abc")).toBe("@bestman_luxe_studio_");
    expect(socialHandle("https://www.tiktok.com/@bestman")).toBe("@bestman");
    expect(socialHandle("not a url")).toBeNull();
  });
});

describe("parsePaper", () => {
  it("defaults to the 80mm roll", () => {
    expect(parsePaper(undefined)).toBe("80mm");
    expect(parsePaper("a4")).toBe("a4");
    expect(parsePaper("letter")).toBe("80mm");
  });
});
