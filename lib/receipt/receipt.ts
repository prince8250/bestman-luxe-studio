import { z } from "zod";

// The receipt (spec 09), parsed from public.receipt_data: the stored sale,
// never the screen that made it.

const lineSchema = z.object({
  line_no: z.number().int(),
  name: z.string(),
  custom: z.boolean(),
  quantity: z.number().int(),
  list_price: z.number().int(),
  unit_price: z.number().int(),
  line_total: z.number().int(),
  staff_id: z.string().nullable(),
  staff_name: z.string().nullable(),
});

const paymentSchema = z.object({
  kind: z.enum(["payment", "adjustment"]),
  method: z.enum(["cash", "momo", "card", "other"]),
  amount: z.number().int(),
  tendered: z.number().int().nullable(),
  reference: z.string().nullable(),
});

const receiptSchema = z.object({
  id: z.string(),
  receipt_no: z.string(),
  status: z.enum(["paid", "voided"]),
  paid_at: z.string(),
  recorded_at: z.string(),
  is_backdated: z.boolean(),
  customer_name: z.string().nullable(),
  subtotal: z.number().int(),
  discount_total: z.number().int(),
  total: z.number().int(),
  counter_name: z.string().nullable(),
  prints: z.number().int(),
  lines: z.array(lineSchema),
  payments: z.array(paymentSchema),
  studio: z.object({
    name: z.string(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    whatsapp: z.string().nullable(),
    header: z.string().nullable(),
    footer: z.string().nullable(),
    copies: z.number().int(),
    social_links: z.record(z.string(), z.string()).catch({}),
  }),
});

export type ReceiptData = z.infer<typeof receiptSchema>;
export type ReceiptLine = z.infer<typeof lineSchema>;
export type ReceiptPayment = z.infer<typeof paymentSchema>;

export function parseReceipt(value: unknown): ReceiptData {
  return receiptSchema.parse(value);
}

// One printed copy. The first is the customer's; the others are STAFF COPY
// slips the staff member keeps (shop rule: no receipt, no service). When
// staff copies are on (copies >= 2) and more than one staff member worked on
// the sale, each of them gets their own slip, so every staff member's slips
// match their count in the day report.
export type ReceiptCopy = { key: string; kind: "customer" } | { key: string; kind: "staff"; staffName: string | null };

export function receiptCopies(receipt: Pick<ReceiptData, "lines" | "studio">): ReceiptCopy[] {
  const copies: ReceiptCopy[] = [{ key: "customer", kind: "customer" }];
  const setting = Math.min(Math.max(receipt.studio.copies, 1), 3);
  if (setting === 1) return copies;

  const staff = new Map<string, string | null>();
  for (const line of receipt.lines) {
    if (line.staff_id && !staff.has(line.staff_id)) staff.set(line.staff_id, line.staff_name);
  }

  if (staff.size > 1) {
    for (const [id, name] of staff) copies.push({ key: `staff-${id}`, kind: "staff", staffName: name });
    return copies;
  }
  const onlyName = staff.size === 1 ? [...staff.values()][0] : null;
  for (let index = 1; index < setting; index += 1) copies.push({ key: `staff-${index}`, kind: "staff", staffName: onlyName });
  return copies;
}

export const PAYMENT_LABEL: Record<ReceiptPayment["method"], string> = {
  cash: "Cash",
  momo: "MoMo",
  card: "Card",
  other: "Other",
};

// "https://www.instagram.com/bestman_luxe_studio_?x=1" -> "@bestman_luxe_studio_"
export function socialHandle(url: string): string | null {
  try {
    const first = new URL(url).pathname.split("/").find(Boolean);
    if (!first) return null;
    return first.startsWith("@") ? first : `@${first}`;
  } catch {
    return null;
  }
}

export const SOCIAL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  x: "X",
};

// The paper the receipt is laid out for, chosen per device (a cookie):
// the counter PC prints on an 80mm roll, a laptop might print on A4.
export const PAPER_COOKIE = "pos_paper";
export type Paper = "80mm" | "a4";
export function parsePaper(value: string | undefined): Paper {
  return value === "a4" ? "a4" : "80mm";
}
