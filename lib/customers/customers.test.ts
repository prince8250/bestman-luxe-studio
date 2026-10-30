import { describe, expect, it } from "vitest";

import { customerEditSchema, customerSearch } from "./customers";

describe("customerSearch", () => {
  it("matches a full number in any common Ghana format exactly", () => {
    for (const typed of ["024 456 5866", "0244565866", "+233 24 456 5866", "233244565866", "00233244565866"]) {
      expect(customerSearch(typed)).toEqual({ p_phone: "+233244565866" });
    }
  });

  it("searches part of a name or part of a number otherwise", () => {
    expect(customerSearch("  Ama ")).toEqual({ p_query: "Ama" });
    expect(customerSearch("4565866")).toEqual({ p_query: "4565866" });
    expect(customerSearch("")).toEqual({});
  });
});

describe("customerEditSchema", () => {
  it("trims the name and notes and limits their length", () => {
    expect(customerEditSchema.parse({ fullName: "  Kojo  ", notes: " Low fade " })).toEqual({ fullName: "Kojo", notes: "Low fade" });
    expect(customerEditSchema.safeParse({ fullName: "x".repeat(81), notes: "" }).success).toBe(false);
  });
});
