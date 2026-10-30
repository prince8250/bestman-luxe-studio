// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { clearAllDrafts, clearDraft, loadDraft, saveDraft } from "@/lib/sale/draft";
import { newTicket } from "@/lib/sale/ticket";

beforeEach(() => sessionStorage.clear());

describe("ticket drafts", () => {
  it("brings back the signed-in user's own ticket after a refresh", () => {
    const ticket = { ...newTicket("req-a"), customerName: "Ama" };
    saveDraft("user-a", ticket);
    expect(loadDraft("user-a")).toEqual(ticket);
  });

  it("never shows one account's ticket to another, and deletes it unread", () => {
    saveDraft("user-a", { ...newTicket("req-a"), customerPhone: "+233241234567" });
    expect(loadDraft("user-b")).toBeNull();
    expect(loadDraft("user-a")).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("ignores a stored value whose user does not match its key", () => {
    sessionStorage.setItem("pos.ticket.v1.user-b", JSON.stringify({ userId: "user-a", ticket: newTicket("x") }));
    expect(loadDraft("user-b")).toBeNull();
  });

  it("clears after a sale and on sign-out", () => {
    saveDraft("user-a", newTicket("req-a"));
    clearDraft("user-a");
    expect(loadDraft("user-a")).toBeNull();
    saveDraft("user-a", newTicket("req-a"));
    sessionStorage.setItem("other.app", "keep");
    clearAllDrafts();
    expect(loadDraft("user-a")).toBeNull();
    expect(sessionStorage.getItem("other.app")).toBe("keep");
  });
});
