// The in-progress sale on the New sale screen ("the ticket"). It lives only in
// the browser until CONFIRM: there is no unpaid sale in the database. The
// server re-reads every price and re-checks every rule in create_sale; these
// helpers only give the counter fast, accurate feedback.

export type PaymentMethod = "cash" | "momo" | "card" | "other";
export type PaymentMode = "cash" | "momo" | "card" | "split";

export interface TicketLine {
  key: string;
  /** null for a custom item (a product or extra typed in by hand). */
  serviceId: string | null;
  name: string;
  /** The service price (custom item: its own price). */
  listPrice: number;
  /** What is charged per unit after any override. */
  unitPrice: number;
  quantity: number;
  staffId: string | null;
  /** Required whenever unitPrice differs from listPrice, and for a counter's custom item. */
  reason: string | null;
  durationMinutes: number;
}

export interface SplitPayment {
  key: string;
  method: PaymentMethod;
  /** Pesewas. */
  amount: number;
  reference: string;
}

export interface Ticket {
  /** Sent with CONFIRM; a repeated CONFIRM with the same id returns the first sale. */
  requestId: string;
  customerPhone: string;
  customerName: string;
  appointmentId: string | null;
  lines: TicketLine[];
  paymentMode: PaymentMode;
  /** Cash handed over, in pesewas (cash mode only). */
  tendered: number | null;
  /** MoMo or card reference (single-method mode). */
  reference: string;
  split: SplitPayment[];
}

export function newTicket(requestId: string): Ticket {
  return {
    requestId,
    customerPhone: "",
    customerName: "",
    appointmentId: null,
    lines: [],
    paymentMode: "cash",
    tendered: null,
    reference: "",
    split: [],
  };
}

// Same rule as the database (create_sale and recompute_sale_totals):
// subtotal = lines before discounts, discount = reductions below the service
// price, total = what is charged.
export function ticketTotals(lines: TicketLine[]): { subtotal: number; discount: number; total: number } {
  let subtotal = 0;
  let discount = 0;
  let total = 0;
  for (const line of lines) {
    total += line.unitPrice * line.quantity;
    discount += Math.max(line.listPrice - line.unitPrice, 0) * line.quantity;
    subtotal += Math.max(line.listPrice, line.unitPrice) * line.quantity;
  }
  return { subtotal, discount, total };
}

// True when a counter user's discount on this line is bigger than allowed.
export function exceedsCounterDiscount(listPrice: number, unitPrice: number, maxPercent: number): boolean {
  if (unitPrice >= listPrice) return false;
  return (listPrice - unitPrice) * 100 > listPrice * maxPercent;
}

export interface PaymentRow {
  method: PaymentMethod;
  amount: number;
  tendered: number | null;
  reference: string | null;
}

// The payments to send for the chosen mode.
export function paymentRows(ticket: Ticket, total: number): PaymentRow[] {
  if (total === 0) return [];
  if (ticket.paymentMode === "split") {
    return ticket.split
      .filter((row) => row.amount > 0)
      .map((row) => ({ method: row.method, amount: row.amount, tendered: null, reference: row.reference.trim() || null }));
  }
  const method = ticket.paymentMode;
  return [
    {
      method,
      amount: total,
      tendered: method === "cash" && ticket.tendered !== null && ticket.tendered >= total ? ticket.tendered : null,
      reference: method === "cash" ? null : ticket.reference.trim() || null,
    },
  ];
}

export function splitRemaining(ticket: Ticket, total: number): number {
  return total - ticket.split.reduce((sum, row) => sum + row.amount, 0);
}

// The first thing that stops CONFIRM, in plain words (null when ready).
export function ticketProblem(ticket: Ticket, role: "owner" | "counter", maxCounterDiscountPercent: number): string | null {
  if (ticket.lines.length === 0) return "Add a service to start.";
  for (const line of ticket.lines) {
    if (line.serviceId && !line.staffId) return `Choose who did ${line.name}.`;
    if (line.unitPrice !== line.listPrice && !line.reason?.trim()) return `Give a reason for the price of ${line.name}.`;
    if (!line.serviceId && role === "counter" && !line.reason?.trim()) return `Give a reason for ${line.name}.`;
    if (role === "counter" && exceedsCounterDiscount(line.listPrice, line.unitPrice, maxCounterDiscountPercent)) {
      return `The discount on ${line.name} is bigger than ${maxCounterDiscountPercent}%. Bigger discounts need the owner.`;
    }
  }
  const { total } = ticketTotals(ticket.lines);
  if (ticket.paymentMode === "cash" && ticket.tendered !== null && ticket.tendered < total) {
    return "The cash given is less than the total.";
  }
  if (ticket.paymentMode === "split" && total > 0) {
    const remaining = splitRemaining(ticket, total);
    if (remaining !== 0) return remaining > 0 ? "Split payments must add up to the total." : "Split payments add up to more than the total.";
    if (ticket.split.filter((row) => row.amount > 0).length > 4) return "Use at most 4 payments.";
  }
  return null;
}

// What CONFIRM sends to the server action.
export function salePayload(ticket: Ticket) {
  const { total } = ticketTotals(ticket.lines);
  return {
    clientRequestId: ticket.requestId,
    customerPhone: ticket.customerPhone.trim() || null,
    customerName: ticket.customerName.trim() || null,
    appointmentId: ticket.appointmentId,
    lines: ticket.lines.map((line) => ({
      serviceId: line.serviceId,
      itemName: line.serviceId ? null : line.name,
      staffId: line.staffId,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      reason: line.reason?.trim() || null,
    })),
    payments: paymentRows(ticket, total),
  };
}
