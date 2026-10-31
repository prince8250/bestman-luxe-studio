import Link from "next/link";
import {
  ArrowRightLeft,
  Ban,
  CalendarX,
  CircleX,
  DatabaseBackup,
  Lock,
  LockOpen,
  LogIn,
  Pencil,
  Receipt,
  Tag,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/pos/sales/sale-badges";
import { describeFeedEvent, type FeedEvent } from "@/lib/activity/feed";
import { accraDate, addDays, formatAccraTime, formatBusinessDate } from "@/lib/time";
import { cn } from "@/lib/utils";

// The activity feed (spec 19, ui-context.md "Activity Feed"): newest first,
// grouped by day; an icon, one plain sentence, who and when, a link to the
// item, and an amber marker on what needs a look.

const ICONS: Record<string, LucideIcon> = {
  sale: Receipt,
  item_price_overridden: Tag,
  staff_reassigned: ArrowRightLeft,
  item_price_changed: Pencil,
  item_service_changed: Pencil,
  void_requested: Ban,
  void_request_approved: Ban,
  void_request_rejected: Ban,
  void_request_cancelled: Ban,
  sale_voided: CircleX,
  appointment_cancelled: CalendarX,
  appointment_no_show: CalendarX,
  day_closed: Lock,
  day_reopened: LockOpen,
  sign_in: LogIn,
  backup_failed: DatabaseBackup,
};

const ROLE: Record<string, string> = { owner: "Owner", counter: "Counter", system: "System" };

function dayHeading(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatBusinessDate(date);
}

export function FeedList({ events, empty }: { events: FeedEvent[]; empty: string }) {
  if (events.length === 0) return <p className="py-6 text-center text-sm text-pos-text-muted">{empty}</p>;

  const today = accraDate();
  const groups: { date: string; events: FeedEvent[] }[] = [];
  for (const event of events) {
    const date = accraDate(event.at);
    const last = groups.at(-1);
    if (last && last.date === date) last.events.push(event);
    else groups.push({ date, events: [event] });
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.date} aria-label={dayHeading(group.date, today)}>
          <h3 className="mb-2 text-xs font-medium tracking-wide text-pos-text-muted uppercase">{dayHeading(group.date, today)}</h3>
          <ol className="divide-y divide-pos-border rounded-[16px] border border-pos-border bg-pos-surface">
            {group.events.map((event) => {
              const described = describeFeedEvent(event);
              const Icon = ICONS[event.type] ?? Receipt;
              return (
                <li key={event.key} className={cn("flex gap-3 p-3 sm:p-4", event.unusual && "bg-pos-warning-soft/60")}>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      event.unusual ? "bg-pos-warning-soft text-pos-warning" : "bg-pos-subtle text-pos-text-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm break-words">
                      {event.unusual && <span className="sr-only">Needs a look: </span>}
                      {described.sentence}
                    </p>
                    {described.reason && <p className="mt-0.5 text-sm break-words text-pos-text-muted">&ldquo;{described.reason}&rdquo;</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-pos-text-muted">
                      <span>{formatAccraTime(event.at)}</span>
                      {ROLE[event.actor_role] && <span>· {ROLE[event.actor_role]}</span>}
                      {event.tags.includes("backdated") && <Badge tone="warning">Past sale</Badge>}
                      {event.tags.includes("after_close") && <Badge tone="warning">After close</Badge>}
                      {event.tags.includes("custom") && <Badge tone="muted">Custom item</Badge>}
                      {event.data.status === "voided" && <Badge tone="down">Voided</Badge>}
                    </p>
                  </div>
                  {described.href && (
                    <Link
                      href={described.href}
                      className="inline-flex min-h-11 shrink-0 items-center self-center px-1 text-sm font-medium text-pos-accent underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
