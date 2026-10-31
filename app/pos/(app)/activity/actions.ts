"use server";

import { fail, ok, runPosAction, type ActionResult } from "@/lib/actions/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The unread count beside Activity in the menu (spec 19), owner only.

export async function activityUnreadAction(): Promise<ActionResult<number>> {
  return runPosAction("activity.view", async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("activity_unread_count");
    if (error) return fail("Could not check the activity feed.");
    return ok(data);
  });
}

// The owner is looking at the feed: everything up to now counts as read.
export async function markActivitySeenAction(): Promise<ActionResult> {
  return runPosAction("activity.view", async (user) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("profiles").update({ activity_seen_at: new Date().toISOString() }).eq("id", user.id);
    if (error) return fail("Could not mark the feed as read.");
    return ok(undefined);
  });
}
