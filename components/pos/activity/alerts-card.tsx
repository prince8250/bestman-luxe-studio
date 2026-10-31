import Link from "next/link";

import { PosCard } from "@/components/brand-pos/pos-card";
import { Badge } from "@/components/pos/sales/sale-badges";
import { formatAccraDayTime } from "@/lib/time";

// The latest SMS alerts to the owner and what happened to each (spec 19), so
// the owner can see which were sent and which stayed in the feed only.

const KIND: Record<string, string> = {
  void_requested: "Void request",
  cash_difference: "Cash difference",
  backdated_sale: "Past sale",
  large_override: "Big price change",
  after_close_sale: "Sale after close",
  day_summary: "Day summary",
  day_not_closed: "Day not closed",
  backup_stale: "No PC backup",
};

const STATUS: Record<string, { label: string; tone: "up" | "down" | "muted" | "warning" | "accent" }> = {
  sent: { label: "Sent", tone: "up" },
  pending: { label: "Waiting", tone: "accent" },
  failed: { label: "Not sent", tone: "down" },
  throttled: { label: "Over the daily limit", tone: "warning" },
  disabled: { label: "Switched off", tone: "muted" },
  skipped: { label: "Not sent", tone: "muted" },
};

export interface AlertRow {
  id: string;
  kind: string;
  sms_status: string;
  sms_error: string | null;
  created_at: string;
}

export function AlertsCard({ alerts, hasPhone }: { alerts: AlertRow[]; hasPhone: boolean }) {
  return (
    <PosCard title="SMS to the owner">
      {!hasPhone && (
        <p className="mb-3 rounded-[10px] bg-pos-warning-soft px-3 py-2 text-sm text-pos-warning">
          No phone number for alerts yet. Add it in{" "}
          <Link href="/pos/settings" className="font-medium underline underline-offset-4">
            Settings
          </Link>
          ; until then alerts stay here only.
        </p>
      )}
      {alerts.length === 0 ? (
        <p className="text-sm text-pos-text-muted">No alerts yet.</p>
      ) : (
        <ul className="divide-y divide-pos-border">
          {alerts.map((alert) => {
            const status = STATUS[alert.sms_status] ?? { label: alert.sms_status, tone: "muted" as const };
            const note = alert.sms_error === "Sending" ? "Being sent" : alert.sms_error;
            return (
              <li key={alert.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{KIND[alert.kind] ?? alert.kind}</span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="text-xs text-pos-text-muted">
                  {formatAccraDayTime(alert.created_at)}
                  {note ? ` · ${note}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-pos-text-muted">
        Which alerts are sent, the phone number, and the daily limit are in{" "}
        <Link href="/pos/settings" className="font-medium text-pos-accent underline-offset-4 hover:underline">
          Settings
        </Link>
        .
      </p>
    </PosCard>
  );
}
