"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, Plus } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { PosRole } from "@/lib/auth/types";
import { bottomBarKeys, isActivePath, NEW_SALE_HREF, sidebarItems, type NavItem } from "@/lib/pos/navigation";
import { cn } from "@/lib/utils";

import { SignOutButton } from "./sign-out-button";

const newSaleItem: NavItem = { key: "new-sale", label: "New sale", href: NEW_SALE_HREF, icon: Plus, permission: "sale.create" };

const tabClass =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-xs font-medium focus-visible:outline-2 focus-visible:outline-pos-accent";

// Phone navigation: four role-specific tabs and "More" for everything else.
export function BottomBar({ role }: { role: PosRole }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const all = [newSaleItem, ...sidebarItems(role)];
  const tabKeys = bottomBarKeys(role);
  const tabs = tabKeys.map((key) => all.find((item) => item.key === key)).filter((item): item is NavItem => Boolean(item));
  const more = all.filter((item) => !tabKeys.includes(item.key));

  return (
    <nav
      aria-label="POS"
      className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-pos-border bg-pos-surface px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {tabs.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(tabClass, active ? "text-pos-accent" : "text-pos-text-muted")}
          >
            <Icon className="h-5 w-5" />
            {item.label.replace(" (today)", "")}
          </Link>
        );
      })}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger className={cn(tabClass, "text-pos-text-muted")}>
          <Ellipsis className="h-5 w-5" />
          More
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-[16px] pb-6">
          <SheetHeader>
            <SheetTitle className="display-type text-2xl">More</SheetTitle>
          </SheetHeader>
          <ul className="grid grid-cols-2 gap-2 px-4">
            {more.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-[10px] border border-pos-border px-3 text-sm font-medium",
                      active ? "bg-pos-accent-soft text-pos-accent" : "text-pos-text",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="px-4">
            <SignOutButton variant="full" />
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
