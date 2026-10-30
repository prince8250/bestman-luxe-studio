import "server-only";

import { redirect } from "next/navigation";

import { can, type PosAction } from "@/lib/auth/permissions";
import { getPosUser } from "@/lib/auth/pos-user";
import type { PosUser } from "@/lib/auth/types";

// Spring Security analogy: proxy.ts and the POS layout are the filter chain
// (no session, no POS); requirePermission is the method-level @PreAuthorize
// on every page and server action. Both run on the server.

export class PermissionError extends Error {
  constructor(readonly action: PosAction) {
    super(`not_authorized:${action}`);
    this.name = "PermissionError";
  }
}

// Any active POS user (owner or counter). Everyone else is sent to sign in.
export async function requirePosUser(): Promise<PosUser> {
  const user = await getPosUser();
  if (!user) redirect("/pos/login");
  return user;
}

// For server actions: the user, or a PermissionError when their role may not
// do this. Call it first, before reading input or touching the database.
export async function requirePermission(action: PosAction): Promise<PosUser> {
  const user = await requirePosUser();
  if (!can(user.role, action)) throw new PermissionError(action);
  return user;
}

// For pages: the user and whether they may open this page. A page that is not
// allowed renders <OwnerOnly /> and loads no data.
export async function pageAccess(action: PosAction): Promise<{ user: PosUser; allowed: boolean }> {
  const user = await requirePosUser();
  return { user, allowed: can(user.role, action) };
}
