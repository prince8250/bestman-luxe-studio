import { describe, expect, it } from "vitest";

import { ALERT_KINDS, settingsInputSchema, SOCIAL_NETWORKS, WEEKDAYS } from "@/lib/settings/schema";

const base = {
  studioName: "Bestman Luxe Studio",
  phone: "024 456 5866",
  whatsapp: "",
  address: "",
  mapUrl: "",
  openingHours: WEEKDAYS.map((day) => ({ day, hours: day === "Sunday" ? "" : "08:00 – 20:00" })),
  socialLinks: Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, ""])),
  aboutText: "",
  receiptHeader: "",
  receiptFooter: "",
  receiptCopies: "2",
  bookingSound: true,
  maxCounterDiscountPercent: "20",
  counterBackdateDays: "3",
  defaultOpeningFloat: "200",
  cashDifferenceTolerance: "0",
  overrideAlertThreshold: "50",
  ownerAlertPhone: "",
  alertSettings: Object.fromEntries(ALERT_KINDS.map((kind) => [kind.key, true])),
  dailySmsCap: "20",
};

describe("settingsInputSchema", () => {
  it("converts GHS, phones, and links to what the database stores", () => {
    const parsed = settingsInputSchema.parse({
      ...base,
      socialLinks: { ...base.socialLinks, instagram: "instagram.com/bestman_luxe_studio_" },
    });
    expect(parsed.phone).toBe("+233244565866");
    expect(parsed.whatsapp).toBeNull();
    expect(parsed.defaultOpeningFloat).toBe(20000);
    expect(parsed.overrideAlertThreshold).toBe(5000);
    expect(parsed.socialLinks.instagram).toBe("https://instagram.com/bestman_luxe_studio_");
    expect(parsed.openingHours).toHaveLength(6);
  });

  it("names the field that is wrong", () => {
    const result = settingsInputSchema.safeParse({ ...base, maxCounterDiscountPercent: "150" });
    expect(result.error?.issues[0].message).toMatch(/Maximum counter discount/);
    const phone = settingsInputSchema.safeParse({ ...base, ownerAlertPhone: "12" });
    expect(phone.error?.issues[0].message).toMatch(/Owner's phone/);
  });

  it("keeps the backdate limit within 14 days", () => {
    expect(settingsInputSchema.safeParse({ ...base, counterBackdateDays: "15" }).success).toBe(false);
  });

  it("refuses an empty number field instead of saving 0", () => {
    for (const blank of ["", "   "]) {
      const result = settingsInputSchema.safeParse({ ...base, maxCounterDiscountPercent: blank });
      expect(result.error?.issues[0].message).toBe("Maximum counter discount: enter a number.");
    }
    expect(settingsInputSchema.parse({ ...base, maxCounterDiscountPercent: " 15 " }).maxCounterDiscountPercent).toBe(15);
  });
});
