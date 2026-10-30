import type { Ticket } from "@/lib/sale/ticket";

// Keeps the in-progress ticket through an accidental page refresh. The key
// includes the signed-in user's id and the stored value repeats it, so a
// ticket saved by one POS account is never shown to another account signing
// in on the same PC: other accounts' drafts are deleted unread, and signing
// out deletes them all.

const PREFIX = "pos.ticket.v1.";

interface StoredDraft {
  userId: string;
  ticket: Ticket;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function keysWithPrefix(store: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

export function loadDraft(userId: string): Ticket | null {
  const store = storage();
  if (!store) return null;
  // Another account's draft is deleted without being read.
  for (const key of keysWithPrefix(store)) {
    if (key !== PREFIX + userId) store.removeItem(key);
  }
  const raw = store.getItem(PREFIX + userId);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredDraft;
    if (stored.userId !== userId || !stored.ticket?.requestId || !Array.isArray(stored.ticket.lines)) return null;
    // Drafts saved before "Record a past sale" existed have no past field.
    return { ...stored.ticket, past: stored.ticket.past ?? null };
  } catch {
    store.removeItem(PREFIX + userId);
    return null;
  }
}

export function saveDraft(userId: string, ticket: Ticket): void {
  const store = storage();
  if (!store) return;
  const stored: StoredDraft = { userId, ticket };
  try {
    store.setItem(PREFIX + userId, JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the ticket still works, it just will not survive a refresh.
  }
}

export function clearDraft(userId: string): void {
  storage()?.removeItem(PREFIX + userId);
}

// Called when anyone signs out.
export function clearAllDrafts(): void {
  const store = storage();
  if (!store) return;
  for (const key of keysWithPrefix(store)) store.removeItem(key);
}
