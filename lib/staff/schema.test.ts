import { describe, expect, it } from "vitest";

import { staffInputSchema } from "@/lib/staff/schema";

const base = { name: "Kofi", photoPath: null, showOnWebsite: true, bookableOnline: true, sortOrder: 1 };

describe("staffInputSchema", () => {
  it("cleans up optional fields and normalises the phone", () => {
    const parsed = staffInputSchema.parse({ ...base, title: "  Barber ", phone: "024 123 4567", bio: "" });
    expect(parsed).toMatchObject({ name: "Kofi", title: "Barber", phone: "+233241234567", bio: null });
  });

  it("requires a name", () => {
    const result = staffInputSchema.safeParse({ ...base, name: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid phone with a helpful message", () => {
    const result = staffInputSchema.safeParse({ ...base, phone: "12345" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/valid phone/);
  });

  it("rejects a photo path that was not created by the app", () => {
    expect(staffInputSchema.safeParse({ ...base, photoPath: "../../x.webp" }).success).toBe(false);
  });
});
