import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { z } from "zod";

import { PageHeader } from "@/components/brand-pos/page-header";
import { PosCard } from "@/components/brand-pos/pos-card";
import { AlertsCard } from "@/components/pos/activity/alerts-card";
import { FeedList } from "@/components/pos/activity/feed-list";
import { AutoRefresh } from "@/components/pos/auto-refresh";
import { OwnerOnly } from "@/components/pos/owner-only";
import { AutoSelect } from "@/components/pos/reports/auto-select";
import { DecideRequestButtons } from "@/components/pos/sales/void-controls";
import { loadActivity, loadRecentAlerts } from "@/lib/activity/data";
import { FEED_TYPES, isFeedType, type FeedType } from "@/lib/activity/feed";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { formatGhs } from "@/lib/money";
import { firstParam } from "@/lib/params";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAccraDayTime } from "@/lib/time";

export const metadata: Metadata = { title: "Activity" };

// The owner's activity feed (spec 19): what happens at the counter, newest
// first, with void requests waiting at the top to approve or reject (also from
// a phone). ?type= and ?by= filter it; ?before= shows older events. It
// refreshes itself every 30 seconds (polling, see AutoRefresh): simpler than
// a live database subscription and quick enough for "within a minute".
export default async function ActivityPage({ searchParams }: PageProps<"/pos/activity">) {
  const { allowed } = await pageAccess("activity.view");
  if (!allowed) return <OwnerOnly />;

  const params = await searchParams;
  const type = isFeedType(firstParam(params.type)) ? (firstParam(params.type) as FeedType) : null;
  const by = z.uuid().safeParse(firstParam(params.by)).success ? firstParam(params.by) : null;
  const beforeParam = firstParam(params.before);
  const before = beforeParam && !Number.isNaN(Date.parse(beforeParam)) ? new Date(beforeParam).toISOString() : null;

  const supabase = await createSupabaseServerClient();
  const [feed, accounts, alerts, settings] = await Promise.all([
    loadActivity(supabase, { before, type, actorId: by }),
    supabase.from("profiles").select("id, display_name, active").eq("role", "counter").order("display_name"),
    loadRecentAlerts(supabase),
    supabase.from("studio_settings").select("owner_alert_phone").eq("id", true).maybeSingle(),
  ]);

  const query = (extra: Record<string, string>) =>
    new URLSearchParams({ ...(type ? { type } : {}), ...(by ? { by } : {}), ...extra }).toString();
  const lastAt = feed.events.at(-1)?.at;
  const filtered = Boolean(type || by);

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 p-4 md:p-8">
      {!before && <AutoRefresh seconds={30} />}
      <PageHeader
        title="Activity"
        description="What happens at the counter, as it happens."
        actions={
          <Form action="/pos/activity" className="flex flex-wrap items-center gap-2">
            <AutoSelect
              name="type"
              label="Type of event"
              value={type ?? ""}
              options={[{ value: "", label: "Everything" }, ...Object.entries(FEED_TYPES).map(([value, label]) => ({ value, label }))]}
            />
            <AutoSelect
              name="by"
              label="Counter account"
              value={by ?? ""}
              options={[
                { value: "", label: "All accounts" },
                ...(accounts.data ?? []).map((account) => ({
                  value: account.id,
                  label: account.active ? account.display_name : `${account.display_name} (inactive)`,
                })),
              ]}
            />
          </Form>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {feed.pending_requests.length > 0 && (
            <PosCard title="Waiting for you" className="border-pos-warning/40">
              <ul className="divide-y divide-pos-border">
                {feed.pending_requests.map((request) => (
                  <li key={request.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm">
                      <strong className="font-medium">{request.requested_by ?? "The counter"}</strong> asks to void{" "}
                      <Link href={`/pos/sales/${request.sale_id}`} className="font-medium text-pos-accent underline-offset-4 hover:underline">
                        {request.receipt_no}
                      </Link>{" "}
                      ({formatGhs(request.total)})
                    </p>
                    <p className="mt-0.5 text-sm break-words text-pos-text-muted">&ldquo;{request.reason}&rdquo;</p>
                    <p className="mt-0.5 mb-2 text-xs text-pos-text-muted">{formatAccraDayTime(request.requested_at)}</p>
                    <DecideRequestButtons requestId={request.id} receiptNo={request.receipt_no} reason={request.reason} />
                  </li>
                ))}
              </ul>
            </PosCard>
          )}

          {before && (
            <p className="text-sm">
              Showing older events.{" "}
              <Link href={`/pos/activity?${query({})}`} className="font-medium text-pos-accent underline-offset-4 hover:underline">
                Back to the newest
              </Link>
            </p>
          )}
          <FeedList events={feed.events} empty={filtered ? "Nothing matches these filters yet." : "Nothing has happened yet."} />
          {feed.has_more && lastAt && (
            <Link
              href={`/pos/activity?${query({ before: lastAt })}`}
              className="flex min-h-11 items-center justify-center rounded-[10px] border border-pos-border bg-pos-surface text-sm font-medium hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
            >
              Show older events
            </Link>
          )}
        </div>

        <div className="min-w-0">
          <AlertsCard alerts={alerts} hasPhone={Boolean(settings.data?.owner_alert_phone)} />
        </div>
      </div>
    </main>
  );
}
