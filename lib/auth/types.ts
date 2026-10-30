// The two POS roles. Staff are never users (they are rows in public.staff).
export const POS_ROLES = ["owner", "counter"] as const;
export type PosRole = (typeof POS_ROLES)[number];

export function isPosRole(value: unknown): value is PosRole {
  return typeof value === "string" && (POS_ROLES as readonly string[]).includes(value);
}

// The signed-in POS user, as the server knows them.
export interface PosUser {
  id: string;
  role: PosRole;
  displayName: string;
}

// Where each role lands after signing in (ui-context.md, "Role Home Pages").
export function homePathFor(role: PosRole): string {
  return role === "owner" ? "/pos" : "/pos/sale/new";
}
