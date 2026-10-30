import type { Metadata } from "next";

import { OwnerOnly } from "@/components/pos/owner-only";
import { NewSaleScreen } from "@/components/pos/sale/new-sale-screen";
import { pageAccess } from "@/lib/auth/require-pos-user";
import type { SaleCatalog } from "@/lib/sale/catalog";
import { publicImageUrl } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate } from "@/lib/time";

export const metadata: Metadata = { title: "New sale" };

export default async function NewSalePage() {
  const { user, allowed } = await pageAccess("sale.create");
  if (!allowed) return <OwnerOnly />;

  const supabase = await createSupabaseServerClient();
  const [categories, services, staff, assignments, settings, todayClose] = await Promise.all([
    supabase.from("service_categories").select("id, name").eq("active", true).order("sort_order").order("name"),
    supabase
      .from("services")
      .select("id, category_id, name, price, duration_minutes")
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    supabase.from("staff").select("id, name, title, photo_path").eq("active", true).order("sort_order").order("name"),
    supabase.from("service_staff").select("service_id, staff_id"),
    supabase.from("studio_settings").select("max_counter_discount_percent").eq("id", true).single(),
    supabase.from("day_closes").select("id").eq("business_date", accraDate()).is("reopened_at", null).maybeSingle(),
  ]);
  if (categories.error || services.error || staff.error || assignments.error || settings.error) {
    throw new Error("Could not load the services");
  }

  const activeCategoryIds = new Set(categories.data.map((category) => category.id));
  const serviceStaff: Record<string, string[]> = {};
  for (const row of assignments.data) (serviceStaff[row.service_id] ??= []).push(row.staff_id);

  const catalog: SaleCatalog = {
    categories: categories.data,
    // A service in a removed category is not sold at the counter either.
    services: services.data
      .filter((service) => activeCategoryIds.has(service.category_id))
      .map((service) => ({
        id: service.id,
        categoryId: service.category_id,
        name: service.name,
        price: service.price,
        durationMinutes: service.duration_minutes,
      })),
    staff: staff.data.map((member) => ({
      id: member.id,
      name: member.name,
      title: member.title,
      photoUrl: member.photo_path ? publicImageUrl("staff", member.photo_path) : null,
    })),
    serviceStaff,
  };

  return (
    <NewSaleScreen
      catalog={catalog}
      userId={user.id}
      role={user.role}
      maxCounterDiscountPercent={settings.data.max_counter_discount_percent}
      dayClosed={Boolean(todayClose.data)}
    />
  );
}
