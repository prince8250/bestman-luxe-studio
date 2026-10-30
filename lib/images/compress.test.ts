import { describe, expect, it } from "vitest";

import { fitWithin } from "@/lib/images/compress";
import { isSafeImagePath } from "@/lib/storage";

describe("fitWithin", () => {
  it("shrinks the longest edge to the limit and keeps the shape", () => {
    expect(fitWithin(3000, 4000, 800)).toEqual({ width: 600, height: 800 });
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(500, 400, 800)).toEqual({ width: 500, height: 400 });
  });
});

describe("isSafeImagePath", () => {
  it("accepts paths the app creates", () => {
    expect(isSafeImagePath("3f2a-staff/1730250000-ab12.webp")).toBe(true);
  });

  it("rejects anything that could escape the folder", () => {
    expect(isSafeImagePath("../secret.webp")).toBe(false);
    expect(isSafeImagePath("/abs/x.webp")).toBe(false);
    expect(isSafeImagePath("a/b/c.webp")).toBe(false);
    expect(isSafeImagePath("a/b.exe")).toBe(false);
  });
});
