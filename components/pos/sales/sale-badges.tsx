import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "down" | "warning" | "muted";

const TONE: Record<Tone, string> = {
  down: "bg-pos-down-soft text-pos-down",
  warning: "bg-pos-warning-soft text-pos-warning",
  muted: "bg-pos-subtle text-pos-text-muted",
};

export function Badge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE[tone], className)}>
      {children}
    </span>
  );
}

interface SaleBadgesProps {
  status: "paid" | "voided";
  voidRequested: boolean;
  isBackdated?: boolean;
  afterClose?: boolean;
}

// Marks shown next to a receipt number wherever a sale appears: Voided, the
// amber "Void requested" (ui-context.md), and the past-sale / after-close flags.
export function SaleBadges({ status, voidRequested, isBackdated, afterClose }: SaleBadgesProps) {
  return (
    <>
      {status === "voided" && <Badge tone="down">Voided</Badge>}
      {status === "paid" && voidRequested && <Badge tone="warning">Void requested</Badge>}
      {isBackdated && <Badge tone="muted">Past sale</Badge>}
      {afterClose && <Badge tone="muted">After close</Badge>}
    </>
  );
}
