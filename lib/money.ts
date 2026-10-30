// Money is integer pesewas everywhere (1 GHS = 100 pesewas). These helpers are
// the only place amounts become text and text becomes amounts. Parsing works on
// the digits as text, so no floating-point rounding can ever creep in.

const cedis = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// 123450 -> "GHS 1,234.50";  -2000 -> "-GHS 20.00"
export function formatGhs(pesewas: number): string {
  const sign = pesewas < 0 ? "-" : "";
  const absolute = Math.abs(Math.trunc(pesewas));
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}GHS ${cedis.format(whole)}.${fraction}`;
}

// 5000 -> "50.00" (for form fields)
export function pesewasToInput(pesewas: number): string {
  const whole = Math.floor(Math.abs(pesewas) / 100);
  const fraction = String(Math.abs(pesewas) % 100).padStart(2, "0");
  return `${pesewas < 0 ? "-" : ""}${whole}.${fraction}`;
}

// "50", "50.5", "1,200.00", "GHS 45", "₵45" -> pesewas; anything else -> null.
export function parseGhs(input: string): number | null {
  const text = input.trim().replace(/^(GHS|GH₵|GHC|₵)\s*/i, "").replace(/,/g, "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return whole * 100 + fraction;
}
