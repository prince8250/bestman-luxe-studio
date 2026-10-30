import { z } from "zod";

import { parseGhs } from "@/lib/money";
import { isSafeImagePath } from "@/lib/storage";

// Shared by the catalog forms (browser) and the catalog server actions.

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : null));

const imagePath = z
  .string()
  .nullable()
  .refine((path) => path === null || isSafeImagePath(path), "The image upload was not valid. Try again.");

const sortOrder = z.coerce
  .number({ message: "Enter a number." })
  .int("Enter a whole number.")
  .min(0, "Use 0 or more.")
  .max(9999, "Use 9999 or less.");

// The price is typed in GHS ("50", "45.50") and stored as pesewas.
export const priceInput = z.string().transform((value, context) => {
  const pesewas = parseGhs(value);
  if (pesewas === null) {
    context.addIssue({ code: "custom", message: "Enter a price in GHS, for example 50 or 45.50." });
    return z.NEVER;
  }
  return pesewas;
});

export const serviceInputSchema = z.object({
  id: z.uuid().optional(),
  categoryId: z.uuid({ message: "Choose a category." }),
  name: z.string().trim().min(1, "Enter a name.").max(80, "A name can be at most 80 characters."),
  description: optionalText(500, "The description"),
  imagePath,
  price: priceInput,
  durationMinutes: z.coerce
    .number({ message: "Enter the time in minutes." })
    .int("Enter whole minutes.")
    .min(5, "At least 5 minutes.")
    .max(600, "At most 600 minutes (10 hours)."),
  showOnWebsite: z.boolean(),
  bookableOnline: z.boolean(),
  sortOrder,
  staffIds: z.array(z.uuid()).max(50),
});

export const categoryInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Enter a name.").max(60, "A name can be at most 60 characters."),
  tagline: optionalText(120, "The tagline"),
  imagePath,
  sortOrder,
});

export const priceChangesSchema = z
  .array(z.object({ id: z.uuid(), price: z.number().int().min(0).max(100_000_000) }))
  .min(1, "There are no price changes to save.")
  .max(500);

export interface CategoryRow {
  id: string;
  name: string;
  tagline: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
  serviceCount: number;
}

export interface ServiceRow {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  price: number;
  durationMinutes: number;
  showOnWebsite: boolean;
  bookableOnline: boolean;
  active: boolean;
  sortOrder: number;
  staffIds: string[];
  /** Archived services only: true when sales or bookings refer to it (cannot be deleted). */
  hasHistory: boolean;
}

export interface StaffOption {
  id: string;
  name: string;
  title: string | null;
}
