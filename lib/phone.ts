// Phone numbers are stored in one format, E.164 (+233241234567), and every
// comparison uses that format (architecture invariant 14). This turns the ways
// people type Ghana numbers into E.164, and back into a readable form.
//
// Accepted: 024 123 4567, 0241234567, 24 123 4567, 233241234567,
// +233 24 123 4567, 00233 24..., and other countries' numbers written with a
// leading + (for example a visitor's +44 number).

// Ghana national numbers are 9 digits after the 0: mobiles start with 2 or 5,
// landlines with 3 (for example 0302 123 456).
const GHANA_NATIONAL = /^[235]\d{8}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(input: string): string | null {
  let digits = input.trim().replace(/[\s().-]/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;

  if (digits.startsWith("+")) {
    if (!E164.test(digits)) return null;
    if (digits.startsWith("+233")) return GHANA_NATIONAL.test(digits.slice(4)) ? digits : null;
    return digits;
  }

  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("233") && digits.length === 12) {
    return GHANA_NATIONAL.test(digits.slice(3)) ? `+${digits}` : null;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return GHANA_NATIONAL.test(digits.slice(1)) ? `+233${digits.slice(1)}` : null;
  }
  if (digits.length === 9 && GHANA_NATIONAL.test(digits)) return `+233${digits}`;
  return null;
}

// "+233241234567" -> "024 123 4567" (other countries are shown as stored).
export function formatPhone(e164: string): string {
  if (e164.startsWith("+233") && e164.length === 13) {
    const national = `0${e164.slice(4)}`;
    return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  return e164;
}
