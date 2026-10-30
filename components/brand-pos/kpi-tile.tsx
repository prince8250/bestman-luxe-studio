import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

interface KpiTileProps {
  label: string;
  /** Already formatted for display, for example "GHS 4,230.00" or "38". */
  value: React.ReactNode;
  /** Percent change against the previous period. null when there is nothing to compare. */
  change?: number | null;
  /** Small line under the value, for example "vs. GHS 3,900.00 last period". */
  caption?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

// Dashboard KPI tile (ui-context.md, "Mapping The Reference"): label, big
// Bebas Neue number, and a green-up / red-down change pill.
export function KpiTile({ label, value, change = null, caption, icon, className }: KpiTileProps) {
  return (
    <div className={cn("rounded-[16px] border border-pos-border bg-pos-surface p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-pos-text">{label}</p>
        {icon && <span className="text-pos-accent [&_svg]:h-5 [&_svg]:w-5">{icon}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="display-type text-4xl tabular-nums">{value}</p>
        <ChangePill change={change} />
      </div>
      {caption && <p className="mt-1 text-xs text-pos-text-muted">{caption}</p>}
    </div>
  );
}

function ChangePill({ change }: { change: number | null }) {
  if (change === null || !Number.isFinite(change)) return null;
  const up = change > 0;
  const flat = change === 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        flat && "bg-pos-subtle text-pos-text-muted",
        !flat && up && "bg-pos-up-soft text-pos-up",
        !flat && !up && "bg-pos-down-soft text-pos-down",
      )}
    >
      {!flat && <Icon aria-hidden className="h-3 w-3" />}
      <span>
        <span className="sr-only">{up ? "Up " : flat ? "No change " : "Down "}</span>
        {Math.abs(change).toFixed(1)}%
      </span>
    </span>
  );
}

// Loading placeholder with the same footprint as a tile, so nothing jumps.
export function KpiTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("rounded-[16px] border border-pos-border bg-pos-surface p-5", className)}
    >
      <div className="h-4 w-24 animate-pulse rounded bg-pos-subtle" />
      <div className="mt-4 h-9 w-32 animate-pulse rounded bg-pos-subtle" />
      <div className="mt-2 h-3 w-40 animate-pulse rounded bg-pos-subtle" />
    </div>
  );
}
