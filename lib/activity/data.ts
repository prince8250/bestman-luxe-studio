import "server-only";

import { z } from "zod";

import type { FeedEvent, FeedType } from "@/lib/activity/feed";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

// Reads the owner's activity feed (spec 19) through public.activity_feed,
// which checks that the caller is the owner.

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const record = z.record(z.string(), z.unknown());

const feedSchema = z.object({
  events: z.array(
    z.object({
      key: z.string(),
      at: z.string(),
      type: z.string(),
      tags: z.array(z.string()),
      actor_id: z.string().nullable(),
      actor_name: z.string().nullable(),
      actor_role: z.string(),
      unusual: z.boolean(),
      data: record,
    }),
  ),
  has_more: z.boolean(),
  pending_requests: z.array(
    z.object({
      id: z.string(),
      sale_id: z.string(),
      receipt_no: z.string(),
      total: z.number().int(),
      reason: z.string(),
      requested_by: z.string().nullable(),
      requested_at: z.string(),
    }),
  ),
});

export type ActivityFeed = z.infer<typeof feedSchema> & { events: FeedEvent[] };

export async function loadActivity(
  supabase: Supabase,
  filters: { before?: string | null; type?: FeedType | null; actorId?: string | null; limit?: number },
): Promise<ActivityFeed> {
  const { data, error } = await supabase.rpc("activity_feed", {
    p_before: filters.before ?? undefined,
    p_limit: filters.limit ?? 100,
    p_types: filters.type ? [filters.type] : undefined,
    p_actor: filters.actorId ?? undefined,
  });
  if (error) throw new Error(`activity_feed failed: ${error.message}`);
  return feedSchema.parse(data);
}

const alertsSchema = z.array(
  z.object({
    id: z.string(),
    kind: z.string(),
    sms_status: z.string(),
    sms_error: z.string().nullable(),
    created_at: z.string(),
    payload: z.unknown(),
  }),
);

// The latest SMS alerts and what happened to each (owner only, by RLS).
export async function loadRecentAlerts(supabase: Supabase, limit = 15) {
  const { data, error } = await supabase
    .from("owner_alerts")
    .select("id, kind, sms_status, sms_error, created_at, payload")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`owner_alerts failed: ${error.message}`);
  return alertsSchema.parse(data);
}
