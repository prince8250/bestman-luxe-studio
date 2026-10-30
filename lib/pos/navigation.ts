import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  DatabaseBackup,
  Images,
  LayoutDashboard,
  Lock,
  Receipt,
  Scissors,
  Settings,
  Tag,
  UserRound,
  Users,
} from "lucide-react";

import type { PosAction } from "@/lib/auth/permissions";
import type { PosRole } from "@/lib/auth/types";

// POS navigation per role (ui-context.md, "Mapping The Reference" and "Role
// Home Pages"). Items a role cannot use are not listed at all. This decides
// what is shown, not what is allowed: every page checks its permission on the
// server (lib/auth/require-pos-user.ts).

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission: PosAction;
  children?: { label: string; href: string }[];
}

const items = {
  dashboard: { key: "dashboard", label: "Dashboard", href: "/pos", icon: LayoutDashboard, permission: "dashboard.view" },
  activity: { key: "activity", label: "Activity", href: "/pos/activity", icon: Activity, permission: "activity.view" },
  today: { key: "today", label: "Today", href: "/pos/today", icon: CalendarCheck, permission: "today.view" },
  sales: { key: "sales", label: "Sales", href: "/pos/sales", icon: Receipt, permission: "sales.viewToday" },
  salesToday: { key: "sales", label: "Sales (today)", href: "/pos/sales", icon: Receipt, permission: "sales.viewToday" },
  appointments: { key: "appointments", label: "Appointments", href: "/pos/appointments", icon: CalendarDays, permission: "appointments.manage" },
  customers: { key: "customers", label: "Customers", href: "/pos/customers", icon: Users, permission: "customers.view" },
  staff: { key: "staff", label: "Staff", href: "/pos/staff", icon: UserRound, permission: "catalog.edit" },
  services: { key: "services", label: "Services", href: "/pos/services", icon: Scissors, permission: "catalog.edit" },
  gallery: { key: "gallery", label: "Gallery", href: "/pos/gallery", icon: Images, permission: "catalog.edit" },
  offers: { key: "offers", label: "Offers", href: "/pos/offers", icon: Tag, permission: "catalog.edit" },
  reports: {
    key: "reports",
    label: "Reports",
    href: "/pos/reports/daily",
    icon: ChartColumn,
    permission: "reports.view",
    children: [
      { label: "Daily", href: "/pos/reports/daily" },
      { label: "Weekly", href: "/pos/reports/weekly" },
      { label: "Monthly", href: "/pos/reports/monthly" },
      { label: "Staff", href: "/pos/reports/staff" },
      { label: "Changes", href: "/pos/reports/changes" },
    ],
  },
  backups: { key: "backups", label: "Backups", href: "/pos/backups", icon: DatabaseBackup, permission: "backups.view" },
  settings: { key: "settings", label: "Settings", href: "/pos/settings", icon: Settings, permission: "settings.edit" },
  closeDay: { key: "close-day", label: "Close day", href: "/pos/close-day", icon: Lock, permission: "day.close" },
} satisfies Record<string, NavItem>;

const sidebarByRole: Record<PosRole, NavItem[]> = {
  owner: [
    items.dashboard,
    items.activity,
    items.sales,
    items.appointments,
    items.customers,
    items.staff,
    items.services,
    items.gallery,
    items.offers,
    items.reports,
    items.backups,
    items.settings,
  ],
  counter: [items.today, items.salesToday, items.appointments, items.customers, items.closeDay],
};

// Phone bottom bar: four items plus "More" (which lists the rest).
const bottomBarByRole: Record<PosRole, string[]> = {
  owner: ["dashboard", "activity", "appointments", "sales"],
  counter: ["new-sale", "today", "appointments", "sales"],
};

export const NEW_SALE_HREF = "/pos/sale/new";

export function sidebarItems(role: PosRole): NavItem[] {
  return sidebarByRole[role];
}

export function bottomBarKeys(role: PosRole): string[] {
  return bottomBarByRole[role];
}

// True when `pathname` is inside the item's section.
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/pos") return pathname === "/pos";
  const section = href.startsWith("/pos/reports/") ? "/pos/reports" : href;
  return pathname === section || pathname.startsWith(`${section}/`);
}
