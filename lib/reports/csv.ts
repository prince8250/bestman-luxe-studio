import { accraDate, formatAccraTime } from "@/lib/time";

// CSV files for the owner (spec 15 Export; spec 16 reports). Money is written
// as plain GHS numbers ("1250.00") so a spreadsheet can add them up.

export type CsvValue = string | number | null | undefined;

// One field. Quotes when needed, and stops a spreadsheet from running a name
// that starts with =, +, -, or @ as a formula (CSV injection): such text gets
// a leading apostrophe. Negative numbers ("-5.00", a cash shortfall; "-12%",
// a fall on the period before) are written as they are, so the spreadsheet
// still reads them as numbers. "-1+1" or "-cmd" still get the apostrophe.
export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let text = value;
  if (/^[=+\-@\t\r]/.test(text) && !/^-\d+(\.\d+)?%?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: CsvValue[][]): string {
  // CRLF line endings and a byte-order mark, so Excel reads it as UTF-8.
  return `\uFEFF${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
}

// A moment as an ISO date and 24-hour time in Accra: "2026-10-30 14:30".
export function csvDateTime(value: string): string {
  return `${accraDate(value)} ${formatAccraTime(value)}`;
}

// Pesewas as a GHS number with two decimals, for a CSV cell.
export function csvMoney(pesewas: number): string {
  const sign = pesewas < 0 ? "-" : "";
  const abs = Math.abs(pesewas);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
