import { describe, expect, it } from "vitest";

import { categoryInputSchema, priceChangesSchema, serviceInputSchema } from "@/lib/catalog/schema";

const service = {
  categoryId: "3f2a1c4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  name: "Haircut",
  imagePath: null,
  price: "50",
  durationMinutes: "45",
  showOnWebsite: true,
  bookableOnline: true,
  sortOrder: "1",
  staffIds: [],
};

describe("serviceInputSchema", () => {
  it("turns a GHS price into pesewas and minutes into a number", () => {
    const parsed = serviceInputSchema.parse({ ...service, price: "45.50", description: "" });
    expect(parsed).toMatchObject({ price: 4550, durationMinutes: 45, description: null, sortOrder: 1 });
  });

  it("explains a bad price", () => {
    const result = serviceInputSchema.safeParse({ ...service, price: "fifty" });
    expect(result.error?.issues[0].message).toMatch(/price in GHS/);
  });

  it("needs a category and a sensible duration", () => {
    expect(serviceInputSchema.safeParse({ ...service, categoryId: "" }).success).toBe(false);
    expect(serviceInputSchema.safeParse({ ...service, durationMinutes: "2" }).success).toBe(false);
  });
});

describe("categoryInputSchema", () => {
  it("accepts a category without a tagline or image", () => {
    expect(categoryInputSchema.parse({ name: "Nails", tagline: "", imagePath: null, sortOrder: 4 })).toMatchObject({
      name: "Nails",
      tagline: null,
    });
  });
});

describe("priceChangesSchema", () => {
  it("rejects an empty save and negative prices", () => {
    expect(priceChangesSchema.safeParse([]).success).toBe(false);
    expect(
      priceChangesSchema.safeParse([{ id: "3f2a1c4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b", price: -1 }]).success,
    ).toBe(false);
  });
});
