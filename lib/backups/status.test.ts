import { describe, expect, it } from "vitest";

import { isBackupStale } from "@/lib/backups/status";

const now = new Date("2026-10-30T12:00:00Z");

describe("isBackupStale", () => {
  it("treats a missing backup as stale", () => {
    expect(isBackupStale("daily_pc", null, now)).toBe(true);
  });

  it("allows a PC backup up to 36 hours old", () => {
    expect(isBackupStale("daily_pc", "2026-10-29T01:00:00Z", now)).toBe(false);
    expect(isBackupStale("daily_pc", "2026-10-28T23:00:00Z", now)).toBe(true);
  });

  it("allows a weekly backup up to 8 days old", () => {
    expect(isBackupStale("weekly_cloud", "2026-10-23T12:00:00Z", now)).toBe(false);
    expect(isBackupStale("weekly_cloud", "2026-10-21T12:00:00Z", now)).toBe(true);
  });
});
