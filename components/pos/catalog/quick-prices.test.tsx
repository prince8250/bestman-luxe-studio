// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { CategoryRow, ServiceRow } from "@/lib/catalog/schema";

const updatePricesAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/pos/(app)/services/actions", () => ({ updatePricesAction }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { QuickPrices } = await import("./quick-prices");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const category: CategoryRow = {
  id: "c1",
  name: "Haircuts",
  tagline: null,
  imagePath: null,
  imageUrl: null,
  sortOrder: 1,
  active: true,
  serviceCount: 1,
};
const service: ServiceRow = {
  id: "3f2a1c4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  categoryId: "c1",
  name: "Haircut",
  description: null,
  imagePath: null,
  imageUrl: null,
  price: 5000,
  durationMinutes: 45,
  showOnWebsite: true,
  bookableOnline: true,
  active: true,
  sortOrder: 1,
  staffIds: [],
  hasHistory: false,
};

describe("QuickPrices", () => {
  it("shows a message and unlocks the button when the request itself fails", async () => {
    updatePricesAction.mockRejectedValueOnce(new Error("Failed to fetch"));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<QuickPrices services={[service]} categories={[category]} />));

    const input = container.querySelector<HTMLInputElement>(`#price-${service.id}`)!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(input, "55");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = [...container.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Save"))!;
    expect(save.textContent).toBe("Save 1 change");

    await act(async () => save.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/Could not reach the server/);
    expect(save.disabled).toBe(false);
    await act(async () => root.unmount());
    container.remove();
  });
});
