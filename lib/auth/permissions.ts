import type { PosRole } from "@/lib/auth/types";

// The single source of truth for who may do what in the POS, copied from the
// Permissions table in context/architecture-context.md (one entry per row,
// split where a row has a different rule per role). Server actions and pages
// check it with requirePermission / pageAccess; the Postgres functions check
// the same rules again, and enforce the limits (discount %, backdate days,
// same-day reassignment) that this map only names.
//
// Never decide permissions in a client component, and never treat a hidden
// button as access control.
export const PERMISSIONS = {
  // New sale, receipt, reprint
  "sale.create": ["owner", "counter"],
  "sale.reprint": ["owner", "counter"],
  // Price override on a line (counter: discount up to the limit, increases with a reason)
  "sale.overridePrice": ["owner", "counter"],
  // Custom item line (counter: reason required)
  "sale.customItem": ["owner", "counter"],
  // Reassign staff on a line: counter same business day only, owner any time
  "sale.reassignToday": ["owner", "counter"],
  "sale.reassignAny": ["owner"],
  // Edit a paid line's service or price
  "sale.editPaid": ["owner"],
  // Void a sale: the counter requests, the owner voids or decides requests
  "sale.requestVoid": ["counter"],
  "sale.void": ["owner"],
  "sale.decideVoid": ["owner"],
  // Record a past sale (counter up to counter_backdate_days, owner up to 14)
  "sale.recordPast": ["owner", "counter"],
  // Sales list: the counter sees today's sales only, without totals
  "sales.viewToday": ["owner", "counter"],
  "sales.viewAll": ["owner"],
  // Close day (blind count); after closing, that day's report only
  "day.close": ["owner", "counter"],
  "day.closeReport": ["owner", "counter"],
  "day.reopen": ["owner"],
  "day.viewHistory": ["owner"],
  // Today page (today's sales and appointments, no money totals)
  "today.view": ["owner", "counter"],
  // Appointments: view, start sale, phone booking, cancel, no-show
  "appointments.manage": ["owner", "counter"],
  // Customers: search, view, edit name and notes; blocking is owner-only
  "customers.view": ["owner", "counter"],
  "customers.edit": ["owner", "counter"],
  "customers.block": ["owner"],
  // Dashboard, reports, staff reports, CSV exports
  "dashboard.view": ["owner"],
  "reports.view": ["owner"],
  // Activity feed and change log
  "activity.view": ["owner"],
  // Services, categories, prices, staff, hours, gallery, offers
  "catalog.edit": ["owner"],
  // Studio settings
  "settings.edit": ["owner"],
  // Counter accounts
  "accounts.manage": ["owner"],
  // Backups page and backup downloads
  "backups.view": ["owner"],
} as const satisfies Record<string, readonly PosRole[]>;

export type PosAction = keyof typeof PERMISSIONS;

export function can(role: PosRole, action: PosAction): boolean {
  return (PERMISSIONS[action] as readonly PosRole[]).includes(role);
}
