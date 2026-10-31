import { describe, expect, it } from "vitest";

import { csvField, csvMoney, toCsv } from "./csv";

describe("csv", () => {
  it("quotes fields with commas, quotes, or line breaks", () => {
    expect(csvField("Haircut")).toBe("Haircut");
    expect(csvField("Cut, wash")).toBe('"Cut, wash"');
    expect(csvField('The "big" one')).toBe('"The ""big"" one"');
    expect(csvField(null)).toBe("");
    expect(csvField(12)).toBe("12");
  });

  it("stops text from running as a spreadsheet formula", () => {
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvField("+233 24 456")).toBe("'+233 24 456");
    expect(csvField("@cmd")).toBe("'@cmd");
    expect(csvField("-1+1")).toBe("'-1+1");
    expect(csvField("-cmd")).toBe("'-cmd");
    expect(csvField("-5%%")).toBe("'-5%%");
  });

  it("keeps negative amounts and percentages as numbers", () => {
    expect(csvField("-5.00")).toBe("-5.00");
    expect(csvField(csvMoney(-50))).toBe("-0.50");
    expect(csvField("-12%")).toBe("-12%");
    expect(csvField("-2.5%")).toBe("-2.5%");
  });

  it("writes money as GHS with two decimals", () => {
    expect(csvMoney(125000)).toBe("1250.00");
    expect(csvMoney(5)).toBe("0.05");
    expect(csvMoney(-1050)).toBe("-10.50");
  });

  it("builds a UTF-8 file Excel can open", () => {
    expect(toCsv([["Name", "Revenue (GHS)"], ["Ama", "120.00"]])).toBe("\uFEFFName,Revenue (GHS)\r\nAma,120.00\r\n");
  });
});
