import { NextResponse } from "next/server";

import { PermissionError, requirePermission } from "@/lib/auth/require-pos-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// GET /pos/backups/weekly?name=bestman-YYYY-MM-DD.dump (spec 22): the owner
// downloads a weekly cloud dump. The private bucket gives a signed link that
// works for one minute, and the browser is sent straight to it, so the link
// is never shown or kept anywhere.

const DUMP_NAME = /^bestman-\d{4}-\d{2}-\d{2}\.dump$/;

export async function GET(request: Request) {
  try {
    await requirePermission("backups.view");
  } catch (error) {
    if (error instanceof PermissionError) return new Response("This is for the owner.", { status: 403 });
    throw error;
  }

  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!DUMP_NAME.test(name)) return new Response("Choose a weekly backup from the list.", { status: 400 });

  const { data, error } = await createSupabaseAdminClient()
    .storage.from("backups")
    .createSignedUrl(`weekly/${name}`, 60, { download: name });
  if (error || !data) {
    console.error(`weekly backup link for ${name} failed`, error?.message);
    return new Response("That backup could not be found.", { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl, 303);
}
