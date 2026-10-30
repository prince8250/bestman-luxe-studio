import type { Metadata } from "next";

import { PageHeader } from "@/components/brand-pos/page-header";
import { CatalogManager } from "@/components/pos/catalog/catalog-manager";
import { OwnerOnly } from "@/components/pos/owner-only";
import { pageAccess } from "@/lib/auth/require-pos-user";
import type { CategoryRow, ServiceRow, StaffOption } from "@/lib/catalog/schema";
import { publicImageUrl } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const { allowed } = await pageAccess("catalog.edit");
  if (!allowed) return <OwnerOnly />;

  const supabase = await createSupabaseServerClient();
  const [categoriesResult, servicesResult, assignmentsResult, staffResult] = await Promise.all([
    supabase.from("service_categories").select("id, name, tagline, image_path, sort_order, active").order("sort_order").order("name"),
    supabase
      .from("services")
      .select("id, category_id, name, description, image_path, price, duration_minutes, show_on_website, bookable_online, active, sort_order")
      .order("sort_order")
      .order("name"),
    supabase.from("service_staff").select("service_id, staff_id"),
    supabase.from("staff").select("id, name, title").eq("active", true).order("sort_order").order("name"),
  ]);
  if (categoriesResult.error || servicesResult.error || assignmentsResult.error || staffResult.error) {
    throw new Error("Could not load the catalog");
  }

  // Only removed services can be deleted, and only without history: check those few.
  const archivedIds = servicesResult.data.filter((service) => !service.active).map((service) => service.id);
  const withHistory = new Set<string>();
  await Promise.all(
    archivedIds.map(async (id) => {
      const [items, appointments] = await Promise.all([
        supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("service_id", id),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("service_id", id),
      ]);
      if ((items.count ?? 1) > 0 || (appointments.count ?? 1) > 0) withHistory.add(id);
    }),
  );

  const staffByService = new Map<string, string[]>();
  for (const row of assignmentsResult.data) {
    staffByService.set(row.service_id, [...(staffByService.get(row.service_id) ?? []), row.staff_id]);
  }

  const services: ServiceRow[] = servicesResult.data.map((service) => ({
    id: service.id,
    categoryId: service.category_id,
    name: service.name,
    description: service.description,
    imagePath: service.image_path,
    imageUrl: service.image_path ? publicImageUrl("catalog", service.image_path) : null,
    price: service.price,
    durationMinutes: service.duration_minutes,
    showOnWebsite: service.show_on_website,
    bookableOnline: service.bookable_online,
    active: service.active,
    sortOrder: service.sort_order,
    staffIds: staffByService.get(service.id) ?? [],
    hasHistory: withHistory.has(service.id),
  }));

  const categories: CategoryRow[] = categoriesResult.data.map((category) => ({
    id: category.id,
    name: category.name,
    tagline: category.tagline,
    imagePath: category.image_path,
    imageUrl: category.image_path ? publicImageUrl("catalog", category.image_path) : null,
    sortOrder: category.sort_order,
    active: category.active,
    serviceCount: services.filter((service) => service.categoryId === category.id).length,
  }));

  const staff: StaffOption[] = staffResult.data;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8">
      <PageHeader title="Services" description="Categories, services, prices, and who does what." />
      <CatalogManager services={services} categories={categories} staff={staff} />
    </main>
  );
}
