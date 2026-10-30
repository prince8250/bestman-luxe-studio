import "server-only";

import { unstable_rethrow } from "next/navigation";

import { PermissionError, requirePermission } from "@/lib/auth/require-pos-user";
import type { PosAction } from "@/lib/auth/permissions";
import type { PosUser } from "@/lib/auth/types";

// Every server action returns this shape, so the UI can show a saved or an
// error state without guessing (code-standards.md, "Forms and Server Actions").
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const NOT_ALLOWED_MESSAGE = "This needs the owner. Ask the owner to do it.";

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

// Runs a POS server action only for roles allowed to do `action`, checked on
// the server before anything else. A refused call returns a plain message;
// unexpected errors are logged and returned as a generic message.
export async function runPosAction<T>(
  action: PosAction,
  body: (user: PosUser) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const user = await requirePermission(action);
    return await body(user);
  } catch (error) {
    // Let Next.js redirects (for example to /pos/login) through.
    unstable_rethrow(error);
    if (error instanceof PermissionError) return fail(NOT_ALLOWED_MESSAGE);
    console.error(`POS action ${action} failed`, error);
    return fail("Something went wrong. Please try again.");
  }
}
