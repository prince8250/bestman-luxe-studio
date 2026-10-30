import { describe, expect, it } from "vitest";

import { isLoginLocked, loginDelayMs } from "@/lib/auth/login-throttle";

describe("login throttle", () => {
  it("does not slow down the first two failures", () => {
    expect(loginDelayMs(0)).toBe(0);
    expect(loginDelayMs(2)).toBe(0);
  });

  it("waits longer after each further failure, up to 5 seconds", () => {
    expect(loginDelayMs(3)).toBe(1000);
    expect(loginDelayMs(4)).toBe(2000);
    expect(loginDelayMs(9)).toBe(5000);
  });

  it("locks the window after 10 failures", () => {
    expect(isLoginLocked(9)).toBe(false);
    expect(isLoginLocked(10)).toBe(true);
  });
});
