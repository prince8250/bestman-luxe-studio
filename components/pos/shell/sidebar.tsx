"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";

import { homePathFor, type PosRole } from "@/lib/auth/types";
import { isActivePath, NEW_SALE_HREF, sidebarItems } from "@/lib/pos/navigation";
import { cn } from "@/lib/utils";

import { UnreadBadge, useActivityUnread } from "./activity-unread";

interface SidebarProps {
  role: PosRole;
  initialCollapsed: boolean;
  statusCard: React.ReactNode;
}

// Labels show on desktop unless the sidebar is collapsed; tablets always get
// the icon rail (ui-context.md, "POS Shape And Layout").
const labelClass = "hidden lg:inline lg:group-data-[collapsed=true]/sidebar:hidden";

export function Sidebar({ role, initialCollapsed, statusCard }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const unread = useActivityUnread();

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // A cookie (not localStorage) so the server renders the right width on the next load.
    document.cookie = `pos_sidebar=${next ? "collapsed" : "open"}; path=/pos; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      data-collapsed={collapsed}
      className="group/sidebar sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-pos-border bg-pos-surface md:flex md:w-[76px] lg:w-60 lg:data-[collapsed=true]:w-[76px] print:hidden"
    >
      <div className="flex h-16 items-center justify-center gap-2 px-4 lg:justify-between lg:group-data-[collapsed=true]/sidebar:justify-center">
        <Link
          href={homePathFor(role)}
          className="flex items-center gap-2 rounded-[10px] focus-visible:outline-2 focus-visible:outline-pos-accent lg:group-data-[collapsed=true]/sidebar:hidden"
        >
          <Image src="/brand/logo-receipt.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
          <span className={cn("display-type text-xl whitespace-nowrap", labelClass)}>Bestman POS</span>
        </Link>
        {/* Desktop only: tablets always show the icon rail. */}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand the menu" : "Collapse the menu"}
          title={collapsed ? "Expand the menu" : "Collapse the menu"}
          className="hidden h-11 w-11 items-center justify-center rounded-[10px] text-pos-text-muted hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent lg:inline-flex"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      <div className="px-3 pb-3">
        <Link
          href={NEW_SALE_HREF}
          aria-current={isActivePath(pathname, NEW_SALE_HREF) ? "page" : undefined}
          title="New sale"
          className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-pos-accent px-3 font-medium text-pos-on-accent transition-colors duration-150 hover:bg-pos-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pos-accent"
        >
          <Plus className="h-5 w-5 shrink-0" />
          <span className={labelClass}>New sale</span>
        </Link>
      </div>

      <nav aria-label="POS" className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {sidebarItems(role).map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors duration-150",
                    "focus-visible:outline-2 focus-visible:outline-pos-accent md:justify-center lg:justify-start lg:group-data-[collapsed=true]/sidebar:justify-center",
                    active ? "bg-pos-accent-soft text-pos-accent" : "text-pos-text hover:bg-pos-subtle",
                  )}
                >
                  <span className="relative shrink-0">
                    <Icon className="h-5 w-5" />
                    {item.key === "activity" && <UnreadBadge count={unread} />}
                  </span>
                  <span className={labelClass}>{item.label}</span>
                </Link>
                {item.children && active && (
                  <ul className={cn("mt-1 mb-2 ml-11 space-y-0.5", "hidden lg:block lg:group-data-[collapsed=true]/sidebar:hidden")}>
                    {item.children.map((child) => {
                      const childActive = pathname === child.href;
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            aria-current={childActive ? "page" : undefined}
                            className={cn(
                              "flex min-h-11 items-center rounded-[10px] px-3 text-sm",
                              childActive ? "font-medium text-pos-accent" : "text-pos-text-muted hover:bg-pos-subtle",
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hidden p-3 lg:block lg:group-data-[collapsed=true]/sidebar:hidden">{statusCard}</div>
    </aside>
  );
}
