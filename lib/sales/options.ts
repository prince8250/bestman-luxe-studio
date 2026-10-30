import "server-only";

import { publicImageUrl } from "@/lib/storage";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// The choices offered when fixing a paid sale (spec 11): staff who can be
// credited with a line, and services a line can be changed to.

export interface StaffOption {
  id: string;
  name: string;
  photoUrl: string | null;
}

export interface ServiceOption {
  id: string;
  name: string;
  price: number;
  categoryName: string;
}

// Active staff only: reassign_sale_item_staff refuses archived staff.
export async function loadStaffOptions(supabase: Supabase): Promise<StaffOption[]> {
  const { data, error } = await supabase.from("staff").select("id, name, photo_path").eq("active", true).order("sort_order").order("name");
  if (error) throw new Error(`staff options failed: ${error.message}`);
  return data.map((member) => ({
    id: member.id,
    name: member.name,
    photoUrl: member.photo_path ? publicImageUrl("staff", member.photo_path) : null,
  }));
}

// Every service the owner may switch a line to, grouped by category name.
export async function loadServiceOptions(supabase: Supabase): Promise<ServiceOption[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, price, active, category:service_categories(name)")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`service options failed: ${error.message}`);
  return data.map((service) => ({
    id: service.id,
    name: service.name,
    price: service.price,
    categoryName: service.category?.name ?? "Other",
  }));
}
