// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { SaleCatalog } from "@/lib/sale/catalog";
import type { TicketLine as Line } from "@/lib/sale/ticket";

import { TicketLine } from "./ticket-line";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const catalog: SaleCatalog = {
  categories: [{ id: "c1", name: "Haircuts" }],
  services: [{ id: "s1", categoryId: "c1", name: "Boy Child Fringe", price: 3000, durationMinutes: 30 }],
  staff: [
    { id: "kofi", name: "Kofi", title: null, photoUrl: null },
    { id: "kwame", name: "Kwame", title: null, photoUrl: null },
    { id: "ama", name: "Ama", title: null, photoUrl: null },
  ],
  serviceStaff: { s1: ["kofi", "kwame"] },
};

const line: Line = {
  key: "l1",
  serviceId: "s1",
  name: "Boy Child Fringe",
  listPrice: 3000,
  unitPrice: 3000,
  quantity: 1,
  staffId: null,
  reason: null,
  durationMinutes: 30,
};

function render(current: Line, onChange: (next: Line) => void) {
  const container = document.createElement("ul");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<TicketLine line={current} catalog={catalog} onChange={onChange} onRemove={() => {}} onEditPrice={() => {}} />));
  // A staff chip reads "K" (the avatar initial) + "Kofi".
  const button = (name: string) =>
    [...container.querySelectorAll("button")].find((b) => [name, name.charAt(0) + name].includes(b.textContent?.trim() ?? ""))!;
  return { container, root, button };
}

describe("TicketLine staff chips", () => {
  it("records exactly the staff member that was tapped", () => {
    const onChange = vi.fn();
    const { button, root } = render(line, onChange);
    expect(button("Other staff")).toBeDefined();
    act(() => button("Kofi").click());
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ staffId: "kofi" }));
    act(() => button("Kwame").click());
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ staffId: "kwame" }));
    act(() => root.unmount());
  });

  it("shows the chosen staff as pressed and keeps a service line from being left without staff", () => {
    const onChange = vi.fn();
    const { button, root } = render({ ...line, staffId: "kofi" }, onChange);
    expect(button("Kofi").getAttribute("aria-pressed")).toBe("true");
    expect(button("Kwame").getAttribute("aria-pressed")).toBe("false");
    act(() => button("Kofi").click());
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ staffId: "kofi" }));
    act(() => root.unmount());
  });

  it("offers the other staff after the assigned ones", () => {
    const onChange = vi.fn();
    const { button, root } = render(line, onChange);
    act(() => button("Other staff").click());
    act(() => button("Ama").click());
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ staffId: "ama" }));
    act(() => root.unmount());
  });
});
