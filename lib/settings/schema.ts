import { z } from "zod";

import { parseGhs } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";

// POS Settings (spec 07). The owner types GHS amounts and local phone numbers;
// the schema turns them into pesewas and E.164 for the database. Used by the
// form (browser) and the server actions.

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const SOCIAL_NETWORKS = ["instagram", "facebook", "tiktok", "snapchat", "x"] as const;

export const ALERT_KINDS = [
  { key: "void_requested", label: "A counter user asks to void a sale" },
  { key: "cash_difference", label: "The cash count is different at closing" },
  { key: "backdated_sale", label: "A past sale is recorded" },
  { key: "large_override", label: "A big price change on a sale" },
  { key: "after_close_sale", label: "A sale after the day was closed" },
  { key: "day_summary", label: "The day summary when the day is closed" },
  { key: "day_not_closed", label: "The day had sales but was not closed" },
  { key: "backup_stale", label: "The day had sales but no PC backup" },
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number]["key"];

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((value) => (value ? value : null));

const optionalPhone = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, context) => {
      if (!value) return null;
      const phone = normalizePhone(value);
      if (!phone) {
        context.addIssue({ code: "custom", message: `${label}: enter a valid number, for example 024 456 5866.` });
        return z.NEVER;
      }
      return phone;
    });

const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, context) => {
      if (!value) return null;
      const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      try {
        const url = new URL(withScheme);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
        url.protocol = "https:";
        return url.toString();
      } catch {
        context.addIssue({ code: "custom", message: `${label}: enter a web link, for example https://...` });
        return z.NEVER;
      }
    });

const ghs = (label: string) =>
  z.string().transform((value, context) => {
    const pesewas = parseGhs(value);
    if (pesewas === null) {
      context.addIssue({ code: "custom", message: `${label}: enter an amount in GHS, for example 200 or 0.50.` });
      return z.NEVER;
    }
    return pesewas;
  });

const wholeNumber = (label: string, min: number, max: number) =>
  z.coerce
    .number({ message: `${label}: enter a number.` })
    .int(`${label}: enter a whole number.`)
    .min(min, `${label}: use ${min} or more.`)
    .max(max, `${label}: use ${max} or less.`);

export const settingsInputSchema = z.object({
  studioName: z.string().trim().min(1, "Enter the studio name.").max(80),
  phone: optionalPhone("Phone"),
  whatsapp: optionalPhone("WhatsApp"),
  address: optionalText(200, "The address"),
  mapUrl: optionalUrl("Map link"),
  openingHours: z
    .array(z.object({ day: z.enum(WEEKDAYS), hours: z.string().trim().max(40) }))
    .length(7)
    .transform((rows) => rows.filter((row) => row.hours !== "")),
  socialLinks: z.object(Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, optionalUrl(network)]))),
  aboutText: optionalText(2000, "The about text"),
  receiptHeader: optionalText(200, "The receipt header"),
  receiptFooter: optionalText(300, "The receipt footer"),
  receiptCopies: wholeNumber("Receipt copies", 1, 3),
  bookingSound: z.boolean(),
  maxCounterDiscountPercent: wholeNumber("Maximum counter discount", 0, 100),
  counterBackdateDays: wholeNumber("Days back for past sales", 0, 14),
  defaultOpeningFloat: ghs("Opening float"),
  cashDifferenceTolerance: ghs("Cash difference tolerance"),
  overrideAlertThreshold: ghs("Big price change"),
  ownerAlertPhone: optionalPhone("Owner's phone"),
  alertSettings: z.object(Object.fromEntries(ALERT_KINDS.map((kind) => [kind.key, z.boolean()]))),
  dailySmsCap: wholeNumber("Daily SMS limit", 0, 200),
});

export type SettingsInput = z.input<typeof settingsInputSchema>;

export const counterAccountSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a name.").max(60, "A name can be at most 60 characters."),
  email: z.email("Enter a valid email address.").max(200),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Use at most 72 characters."),
});

export const resetPasswordSchema = z.object({
  id: z.uuid(),
  password: counterAccountSchema.shape.password,
});

export interface CounterAccountRow {
  id: string;
  displayName: string;
  email: string | null;
  active: boolean;
  lastSignInAt: string | null;
}
