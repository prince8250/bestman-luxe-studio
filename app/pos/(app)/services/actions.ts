"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbErrorMessage } from "@/lib/actions/db-errors";
import { fail, ok, runPosAction, type ActionResult } from "@/lib/actions/result";
import { categoryInputSchema, priceChangesSchema, serviceInputSchema } from "@/lib/catalog/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Services, categories, and prices (spec 06), owner only. Multi-row saves go
// through Postgres functions (save_service, update_service_prices,
// reorder_rows); price changes are logged by a database trigger.

const idSchema = z.uuid();
const reorderSchema = z.object({
  table: z.enum(["service_categories", "services"]),
  ids: z.array(z.uuid()).min(1).max(500),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function refresh() {
  revalidatePath("/pos/services");
}

async function removeImage(path: string | null | undefined) {
  if (!path) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from("catalog").remove([path]);
  if (error) console.error("Could not remove an old catalog image", error.message);
}

export async function saveServiceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runPosAction("catalog.edit", async () => {
    const parsed = serviceInputSchema.safeParse(input);
    if (!parsed.success) return fail(firstIssue(parsed.error));
    const values = parsed.data;
    const supabase = await createSupabaseServerClient();

    let previousImage: string | null = null;
    if (values.id) {
      const { data } = await supabase.from("services").select("image_path").eq("id", values.id).maybeSingle();
      if (!data) return fail("That service was not found.");
      previousImage = data.image_path;
    }

    const { data, error } = await supabase.rpc("save_service", {
      payload: {
        id: values.id,
        category_id: values.categoryId,
        name: values.name,
        description: values.description,
        image_path: values.imagePath,
        price: values.price,
        duration_minutes: values.durationMinutes,
        show_on_website: values.showOnWebsite,
        bookable_online: values.bookableOnline,
        sort_order: values.sortOrder,
        staff_ids: values.staffIds,
      },
    });
    if (error || !data) return fail(dbErrorMessage(error ?? { message: "no_id" }, "save_service"));
    if (previousImage && previousImage !== values.imagePath) await removeImage(previousImage);
    refresh();
    return ok({ id: data });
  });
}

export async function setServiceActiveAction(id: unknown, active: unknown): Promise<ActionResult> {
  return runPosAction("catalog.edit", async () => {
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success || typeof active !== "boolean") return fail("That service was not found.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("services")
      .update({ active, archived_at: active ? null : new Date().toISOString() })
      .eq("id", parsedId.data)
      .eq("active", !active)
      .select("id");
    if (error) return fail(dbErrorMessage(error, "set service active"));
    if (!data?.length) return fail(active ? "That service is already active." : "That service was already removed.");
    refresh();
    return ok(undefined);
  });
}

// Permanent delete: only for a removed service that was never sold or booked.
export async function deleteServiceAction(id: unknown): Promise<ActionResult> {
  return runPosAction("catalog.edit", async () => {
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return fail("That service was not found.");
    const supabase = await createSupabaseServerClient();
    const { data: service } = await supabase.from("services").select("active, image_path").eq("id", parsed.data).maybeSingle();
    if (!service) return fail("That service was not found.");
    if (service.active) return fail("Remove this service first.");

    const [items, appointments] = await Promise.all([
      supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("service_id", parsed.data),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("service_id", parsed.data),
    ]);
    if ((items.count ?? 1) > 0 || (appointments.count ?? 1) > 0) {
      return fail("This service was sold or booked before, so it stays removed to keep the history.");
    }
    const { error } = await supabase.from("services").delete().eq("id", parsed.data);
    if (error) return fail(dbErrorMessage(error, "delete service"));
    await removeImage(service.image_path);
    refresh();
    return ok(undefined);
  });
}

export async function updatePricesAction(changes: unknown): Promise<ActionResult<{ changed: number }>> {
  return runPosAction("catalog.edit", async () => {
    const parsed = priceChangesSchema.safeParse(changes);
    if (!parsed.success) return fail(firstIssue(parsed.error));
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_service_prices", { changes: parsed.data });
    if (error) return fail(dbErrorMessage(error, "update_service_prices"));
    refresh();
    return ok({ changed: data ?? 0 });
  });
}

export async function saveCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runPosAction("catalog.edit", async () => {
    const parsed = categoryInputSchema.safeParse(input);
    if (!parsed.success) return fail(firstIssue(parsed.error));
    const values = parsed.data;
    const supabase = await createSupabaseServerClient();
    const row = { name: values.name, tagline: values.tagline, image_path: values.imagePath, sort_order: values.sortOrder };

    if (values.id) {
      const { data: previous } = await supabase
        .from("service_categories")
        .select("image_path")
        .eq("id", values.id)
        .maybeSingle();
      if (!previous) return fail("That category was not found.");
      const { error } = await supabase.from("service_categories").update(row).eq("id", values.id);
      if (error) return fail(dbErrorMessage(error, "update category"));
      if (previous.image_path && previous.image_path !== values.imagePath) await removeImage(previous.image_path);
      refresh();
      return ok({ id: values.id });
    }

    const { data, error } = await supabase.from("service_categories").insert(row).select("id").single();
    if (error || !data) return fail(dbErrorMessage(error ?? { message: "no_id" }, "insert category"));
    refresh();
    return ok({ id: data.id });
  });
}

// A removed category hides its panel on the website and its tab in New sale;
// its services keep their history.
export async function setCategoryActiveAction(id: unknown, active: unknown): Promise<ActionResult> {
  return runPosAction("catalog.edit", async () => {
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success || typeof active !== "boolean") return fail("That category was not found.");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("service_categories").update({ active }).eq("id", parsedId.data);
    if (error) return fail(dbErrorMessage(error, "set category active"));
    refresh();
    return ok(undefined);
  });
}

export async function deleteCategoryAction(id: unknown): Promise<ActionResult> {
  return runPosAction("catalog.edit", async () => {
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return fail("That category was not found.");
    const supabase = await createSupabaseServerClient();
    const { count } = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("category_id", parsed.data);
    if ((count ?? 1) > 0) return fail("This category still has services. Move or delete them first, or remove the category instead.");
    const { data: category } = await supabase.from("service_categories").select("image_path").eq("id", parsed.data).maybeSingle();
    const { error } = await supabase.from("service_categories").delete().eq("id", parsed.data);
    if (error) return fail(dbErrorMessage(error, "delete category"));
    await removeImage(category?.image_path);
    refresh();
    return ok(undefined);
  });
}

export async function reorderAction(input: unknown): Promise<ActionResult> {
  return runPosAction("catalog.edit", async () => {
    const parsed = reorderSchema.safeParse(input);
    if (!parsed.success) return fail("Could not save the new order.");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("reorder_rows", { p_table: parsed.data.table, p_ids: parsed.data.ids });
    if (error) return fail(dbErrorMessage(error, "reorder_rows"));
    refresh();
    return ok(undefined);
  });
}
