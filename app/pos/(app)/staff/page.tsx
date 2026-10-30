import type { Metadata } from "next";

import { PageHeader } from "@/components/brand-pos/page-header";
import { OwnerOnly } from "@/components/pos/owner-only";
import { StaffManager } from "@/components/pos/staff/staff-manager";
import { pageAccess } from "@/lib/auth/require-pos-user";
import type { StaffRow } from "@/lib/staff/schema";
import { publicImageUrl } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const { allowed } = await pageAccess("catalog.edit");
  if (!allowed) return <OwnerOnly />;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, title, phone, bio, photo_path, show_on_website, bookable_online, active, archived_at, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw new Error("Could not load staff");

  // Only archived staff can be deleted, and only without history: check those few.
  const archivedIds = data.filter((member) => !member.active).map((member) => member.id);
  const withHistory = new Set<string>();
  await Promise.all(
    archivedIds.map(async (id) => {
      const [items, appointments] = await Promise.all([
        supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("staff_id", id),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("staff_id", id),
      ]);
      if ((items.count ?? 1) > 0 || (appointments.count ?? 1) > 0) withHistory.add(id);
    }),
  );

  const staff: StaffRow[] = data.map((member) => ({
    id: member.id,
    name: member.name,
    title: member.title,
    phone: member.phone,
    bio: member.bio,
    photoPath: member.photo_path,
    photoUrl: member.photo_path ? publicImageUrl("staff", member.photo_path) : null,
    showOnWebsite: member.show_on_website,
    bookableOnline: member.bookable_online,
    active: member.active,
    archivedAt: member.archived_at,
    sortOrder: member.sort_order,
    hasHistory: withHistory.has(member.id),
  }));

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8">
      <PageHeader title="Staff" description="The people who do the work. Staff never sign in." />
      <StaffManager staff={staff} />
    </main>
  );
}
