"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/pos/reports/daily", label: "Daily" },
  { href: "/pos/reports/weekly", label: "Weekly" },
  { href: "/pos/reports/monthly", label: "Monthly" },
  { href: "/pos/reports/custom", label: "Custom dates" },
  { href: "/pos/reports/staff", label: "Staff" },
  { href: "/pos/reports/changes", label: "Changes" },
] as const;

// The Reports sections (ui-context.md: Daily, Weekly, Monthly, Staff, Changes).
export function ReportTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Reports" className="mx-auto w-full max-w-[1440px] px-4 pt-4 md:px-8 md:pt-6 print:hidden">
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-pos-accent",
                  active ? "bg-pos-text text-pos-surface" : "bg-pos-surface text-pos-text hover:bg-pos-subtle",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
