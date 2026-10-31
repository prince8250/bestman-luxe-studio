"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { activityUnreadAction, markActivitySeenAction } from "@/app/pos/(app)/activity/actions";
import { cn } from "@/lib/utils";

// How many things happened since the owner last opened Activity (spec 19),
// shared by the sidebar and the phone bottom bar. Checked once a minute while
// the POS is on screen; on the Activity page itself the feed is marked read
// instead.

const ACTIVITY_PATH = "/pos/activity";
const UnreadContext = React.createContext(0);

export function ActivityUnreadProvider({ initial, enabled, children }: { initial: number; enabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const onFeed = pathname === ACTIVITY_PATH;
  const [count, setCount] = React.useState(initial);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        if (onFeed) {
          await markActivitySeenAction();
          if (!cancelled) setCount(0);
        } else {
          const result = await activityUnreadAction();
          if (!cancelled && result.ok) setCount(result.data);
        }
      } catch {
        // Offline for a moment: keep the last count.
      }
    }
    void check();
    const timer = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled, onFeed]);

  return <UnreadContext.Provider value={enabled && !onFeed ? count : 0}>{children}</UnreadContext.Provider>;
}

export function useActivityUnread(): number {
  return React.useContext(UnreadContext);
}

// A small red count on the Activity icon ("99+" above 99).
export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "pointer-events-none absolute -top-1.5 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pos-down px-1 text-[11px] leading-none font-semibold text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
      <span className="sr-only"> new</span>
    </span>
  );
}
