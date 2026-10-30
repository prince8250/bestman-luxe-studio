import { describe, expect, it } from "vitest";

import { formatGhs, parseGhs, pesewasToInput } from "@/lib/money";

describe("formatGhs", () => {
  it("shows pesewas as cedis with two decimals and thousands separators", () => {
    expect(formatGhs(0)).toBe("GHS 0.00");
    expect(formatGhs(5)).toBe("GHS 0.05");
    expect(formatGhs(5000)).toBe("GHS 50.00");
    expect(formatGhs(123450)).toBe("GHS 1,234.50");
    expect(formatGhs(-2000)).toBe("-GHS 20.00");
  });
});

describe("parseGhs", () => {
  it.each([
    ["50", 5000],
    ["50.5", 5050],
    ["50.05", 5005],
    ["1,200.00", 120000],
    ["GHS 45", 4500],
    ["₵45.99", 4599],
    ["0.1", 10],
  ])("reads %s as %i pesewas", (input, expected) => {
    expect(parseGhs(input)).toBe(expected);
  });

  it.each(["", "abc", "12.345", "-5", "1e3", "12.", ".5"])("rejects %j", (input) => {
    expect(parseGhs(input)).toBeNull();
  });

  it("never loses a pesewa to floating point (0.29 is 29)", () => {
    expect(parseGhs("0.29")).toBe(29);
    expect(parseGhs("1.15")).toBe(115);
  });
});

describe("pesewasToInput", () => {
  it("formats for an input field", () => {
    expect(pesewasToInput(5050)).toBe("50.50");
    expect(pesewasToInput(7)).toBe("0.07");
  });
});
