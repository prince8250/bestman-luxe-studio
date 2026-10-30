import { z } from "zod";

import { normalizePhone } from "@/lib/phone";
import { isSafeImagePath } from "@/lib/storage";

// One schema for the staff form: the browser uses it to show field errors as
// the owner types, and the server action uses it again before saving (the
// browser is never trusted).

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : null));

export const staffInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Enter a name.").max(60, "A name can be at most 60 characters."),
  title: optionalText(60, "The title"),
  // Internal only: never shown on the website.
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value, context) => {
      if (!value) return null;
      const phone = normalizePhone(value);
      if (!phone) {
        context.addIssue({ code: "custom", message: "Enter a valid phone number, for example 024 123 4567." });
        return z.NEVER;
      }
      return phone;
    }),
  bio: optionalText(500, "The bio"),
  photoPath: z
    .string()
    .nullable()
    .refine((path) => path === null || isSafeImagePath(path), "The photo upload was not valid. Try again."),
  showOnWebsite: z.boolean(),
  bookableOnline: z.boolean(),
  sortOrder: z.coerce
    .number({ message: "Enter a number." })
    .int("Enter a whole number.")
    .min(0, "Use 0 or more.")
    .max(9999, "Use 9999 or less."),
});

export type StaffInput = z.input<typeof staffInputSchema>;
export type StaffValues = z.output<typeof staffInputSchema>;

// A staff member as the POS staff screen shows them.
export interface StaffRow {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  bio: string | null;
  photoPath: string | null;
  photoUrl: string | null;
  showOnWebsite: boolean;
  bookableOnline: boolean;
  active: boolean;
  archivedAt: string | null;
  sortOrder: number;
  /** Archived staff only: true when sales or bookings refer to them (cannot be deleted). */
  hasHistory: boolean;
}
