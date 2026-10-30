import { describe, expect, it } from "vitest";

import {
  exceedsCounterDiscount,
  newTicket,
  paymentRows,
  salePayload,
  ticketProblem,
  ticketTotals,
  type Ticket,
  type TicketLine,
} from "@/lib/sale/ticket";

const line = (overrides: Partial<TicketLine> = {}): TicketLine => ({
  key: "l1",
  serviceId: "s1",
  name: "Haircut",
  listPrice: 5000,
  unitPrice: 5000,
  quantity: 1,
  staffId: "kofi",
  reason: null,
  durationMinutes: 45,
  ...overrides,
});

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({ ...newTicket("req-1"), lines: [line()], ...overrides });

describe("ticketTotals", () => {
  it("matches the database rule for discounts and increases", () => {
    const totals = ticketTotals([
      line(),
      line({ key: "l2", unitPrice: 4000, reason: "Regular" }),
      line({ key: "l3", unitPrice: 6000, quantity: 2, reason: "Longer hair" }),
    ]);
    expect(totals).toEqual({ subtotal: 5000 + 5000 + 12000, discount: 1000, total: 5000 + 4000 + 12000 });
  });
});

describe("exceedsCounterDiscount", () => {
  it("allows exactly the limit and refuses more", () => {
    expect(exceedsCounterDiscount(5000, 4000, 20)).toBe(false);
    expect(exceedsCounterDiscount(5000, 3999, 20)).toBe(true);
    expect(exceedsCounterDiscount(5000, 6000, 20)).toBe(false);
  });
});

describe("ticketProblem", () => {
  it("needs a line, a staff member, and a reason for a changed price", () => {
    expect(ticketProblem(ticket({ lines: [] }), "counter", 20)).toMatch(/Add a service/);
    expect(ticketProblem(ticket({ lines: [line({ staffId: null })] }), "counter", 20)).toMatch(/Choose who did Haircut/);
    expect(ticketProblem(ticket({ lines: [line({ unitPrice: 4500 })] }), "owner", 20)).toMatch(/reason for the price/);
  });

  it("stops a counter discount over the limit but not the owner's", () => {
    const big = ticket({ lines: [line({ unitPrice: 2000, reason: "Friend" })] });
    expect(ticketProblem(big, "counter", 20)).toMatch(/need the owner/);
    expect(ticketProblem(big, "owner", 20)).toBeNull();
  });

  it("requires a reason on a counter's custom item", () => {
    const custom = ticket({ lines: [line({ serviceId: null, staffId: null, name: "Hair oil", listPrice: 3500, unitPrice: 3500 })] });
    expect(ticketProblem(custom, "counter", 20)).toMatch(/reason for Hair oil/);
    expect(ticketProblem(custom, "owner", 20)).toBeNull();
  });

  it("requires split payments to add up to the total exactly", () => {
    const split = (amounts: number[]) =>
      ticket({
        paymentMode: "split",
        split: amounts.map((amount, index) => ({ key: `p${index}`, method: index ? "momo" : "cash", amount, reference: "" })),
      });
    expect(ticketProblem(split([3000]), "counter", 20)).toMatch(/add up to the total/);
    expect(ticketProblem(split([3000, 2500]), "counter", 20)).toMatch(/more than the total/);
    expect(ticketProblem(split([3000, 2000]), "counter", 20)).toBeNull();
  });

  it("refuses cash given that is less than the total", () => {
    expect(ticketProblem(ticket({ tendered: 4000 }), "counter", 20)).toMatch(/less than the total/);
    expect(ticketProblem(ticket({ tendered: 10000 }), "counter", 20)).toBeNull();
  });
});

describe("payments and payload", () => {
  it("sends one cash payment with the cash given", () => {
    expect(paymentRows(ticket({ tendered: 10000 }), 5000)).toEqual([{ method: "cash", amount: 5000, tendered: 10000, reference: null }]);
  });

  it("sends MoMo with its reference and no tendered", () => {
    expect(paymentRows(ticket({ paymentMode: "momo", reference: " MP123 " }), 5000)).toEqual([
      { method: "momo", amount: 5000, tendered: null, reference: "MP123" },
    ]);
  });

  it("sends no payments for a free sale", () => {
    expect(paymentRows(ticket(), 0)).toEqual([]);
  });

  it("marks custom items by name and keeps the request id", () => {
    const payload = salePayload(
      ticket({ lines: [line(), line({ key: "x", serviceId: null, name: "Hair oil", staffId: null, listPrice: 3500, unitPrice: 3500, reason: "Product" })] }),
    );
    expect(payload.clientRequestId).toBe("req-1");
    expect(payload.lines[1]).toMatchObject({ serviceId: null, itemName: "Hair oil", staffId: null, reason: "Product" });
    expect(payload.payments[0].amount).toBe(8500);
  });
});
