// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const editSaleItemAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/pos/(app)/sales/actions", () => ({ editSaleItemAction }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { EditLineButton, lineDifference } = await import("./edit-line");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const line = {
  id: "3f2a1c4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  name: "Haircut",
  custom: false,
  serviceId: "9b1c2d3e-4f5a-4b6c-8d7e-8f9a0b1c2d3e",
  staffId: "7c1c2d3e-4f5a-4b6c-8d7e-8f9a0b1c2d3e",
  quantity: 1,
  unitPrice: 5000,
  lineTotal: 5000,
};

const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("lineDifference", () => {
  it("is positive when the customer pays more and negative for a refund", () => {
    expect(lineDifference(line, 6000, 1)).toBe(1000);
    expect(lineDifference(line, 4000, 1)).toBe(-1000);
    expect(lineDifference(line, 2500, 2)).toBe(0);
  });
});

describe("EditLineButton", () => {
  it("sends the exact money difference with the change, and only the owner's reason", async () => {
    editSaleItemAction.mockResolvedValue({ ok: true, data: undefined });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<EditLineButton receiptNo="BLS-000001" saleTotal={8000} line={line} services={[]} />));

    await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Edit"))!.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    await type(dialog.querySelector<HTMLInputElement>("#edit-price")!, "40");
    expect(dialog.textContent).toContain("Refund GHS 10.00 to the customer");
    expect(dialog.textContent).toContain("GHS 80.00 → GHS 70.00");

    const save = () => [...dialog.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Save"))!;
    await act(async () => save().click());
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe("Give a reason for the change.");
    expect(editSaleItemAction).not.toHaveBeenCalled();

    await act(async () => [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Wrong price entered")!.click());
    await act(async () => save().click());
    expect(editSaleItemAction).toHaveBeenCalledWith({
      itemId: line.id,
      serviceId: null,
      unitPrice: 4000,
      quantity: 1,
      reason: "Wrong price entered",
      adjustment: { method: "cash", amount: -1000, reference: "" },
    });
    await act(async () => root.unmount());
    container.remove();
  });
});
