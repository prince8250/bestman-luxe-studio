import { describe, expect, it } from "vitest";

import { formatPhone, normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["024 123 4567", "+233241234567"],
    ["0241234567", "+233241234567"],
    ["24 123 4567", "+233241234567"],
    ["233241234567", "+233241234567"],
    ["+233 24 123 4567", "+233241234567"],
    ["00233 24 123 4567", "+233241234567"],
    ["(055) 123-4567", "+233551234567"],
    ["0302 123 456", "+233302123456"],
    ["+44 7700 900123", "+447700900123"],
  ])("turns %s into %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "024123456", "02412345678", "+233 14 123 4567", "0841234567", "phone", "+0123456789"])(
    "rejects %j",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe("formatPhone", () => {
  it("shows Ghana numbers the local way", () => {
    expect(formatPhone("+233241234567")).toBe("024 123 4567");
  });

  it("leaves other countries as stored", () => {
    expect(formatPhone("+447700900123")).toBe("+447700900123");
  });
});
