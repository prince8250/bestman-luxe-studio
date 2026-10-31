// How many SMS a text costs. Text made only of GSM-7 characters fits 160
// characters in one SMS (153 per part when longer). One character outside it
// (an emoji, a curly quote) sends the whole text as UCS-2: 70 characters in
// one SMS, 67 per part. Providers bill per part.

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
// Each of these takes two characters (an escape and the character).
const GSM_EXTENDED = "^{}\\[~]|€\f";

export interface SmsLength {
  encoding: "gsm7" | "ucs2";
  /** Characters as the network counts them. */
  units: number;
  /** SMS parts the text is sent as. */
  segments: number;
}

export function smsLength(text: string): SmsLength {
  let units = 0;
  for (const char of text) {
    if (GSM_BASIC.includes(char)) units += 1;
    else if (GSM_EXTENDED.includes(char)) units += 2;
    else {
      const ucs2 = text.length; // UTF-16 code units: an emoji counts as two.
      return { encoding: "ucs2", units: ucs2, segments: ucs2 <= 70 ? 1 : Math.ceil(ucs2 / 67) };
    }
  }
  return { encoding: "gsm7", units, segments: units <= 160 ? 1 : Math.ceil(units / 153) };
}

// Built from code points so the source shows which characters they are.
const anyOf = (...codes: number[]) => new RegExp(`[${String.fromCharCode(...codes)}]`, "g");
const SINGLE_QUOTES = anyOf(0x2018, 0x2019, 0x201a, 0x2032); // curly single quotes, prime
const DOUBLE_QUOTES = anyOf(0x201c, 0x201d, 0x201e, 0x2033); // curly double quotes, double prime
const DASHES = anyOf(0x2013, 0x2014, 0x2212); // en dash, em dash, minus sign
const ELLIPSIS = anyOf(0x2026);
const ODD_SPACES = anyOf(0x00a0, 0x2007, 0x2009, 0x202f); // no-break and thin spaces

// Swaps typographic characters that names and settings often contain for
// their plain forms, so a message stays in GSM-7 (and one SMS).
export function plainSmsText(text: string): string {
  return text
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, "-")
    .replace(ELLIPSIS, "...")
    .replace(ODD_SPACES, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}
