import { z } from "zod";

import { parseGhs } from "@/lib/money";
import { isCalendarDate } from "@/lib/reports/range";

// The Close day form (spec 17), checked the same way in the browser and in
// the server action. Amounts arrive as typed ("1,250.50") and leave as
// pesewas. close_day checks everything again in the database.

export interface CloseDayInput {
  date: string;
  counted: string;
  momo: string;
  float: string;
  floatReason: string;
  note: string;
}

export interface CloseDayValues {
  date: string;
  countedCash: number;
  momoReported: number | null;
  openingFloat: number;
  openingFloatReason: string | null;
  note: string | null;
}

const money = (message: string) =>
  z.string().transform((value, ctx) => {
    const pesewas = parseGhs(value);
    if (pesewas === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return pesewas;
  });

// defaultFloat: the opening float in Settings; a different one needs a reason.
export function closeDaySchema(defaultFloat: number) {
  return z
    .object({
      date: z.string().refine(isCalendarDate, "Choose the day to close."),
      counted: money("Enter the cash you counted, for example 1250 or 1,250.50."),
      momo: z.string().transform((value, ctx) => {
        if (!value.trim()) return null;
        const pesewas = parseGhs(value);
        if (pesewas === null) {
          ctx.addIssue({ code: "custom", message: "Enter the MoMo total as an amount, or leave it empty." });
          return z.NEVER;
        }
        return pesewas;
      }),
      float: money("Enter the opening float as an amount."),
      floatReason: z.string().trim().max(300, "Keep the reason under 300 characters."),
      note: z.string().trim().max(500, "Keep the note under 500 characters."),
    })
    .superRefine((value, ctx) => {
      if (value.float !== defaultFloat && !value.floatReason) {
        ctx.addIssue({ code: "custom", path: ["floatReason"], message: "Say why the opening float is different today." });
      }
    })
    .transform(
      (value): CloseDayValues => ({
        date: value.date,
        countedCash: value.counted,
        momoReported: value.momo,
        openingFloat: value.float,
        openingFloatReason: value.float !== defaultFloat ? value.floatReason : null,
        note: value.note || null,
      }),
    );
}

// The two files saved on the PC after a close (also the backup's day report).
export interface DayReportFiles {
  date: string;
  csv: string;
  html: string;
}

export function dayReportFileNames(date: string) {
  return { csv: `bestman-day-report-${date}.csv`, html: `bestman-day-report-${date}.html` };
}
