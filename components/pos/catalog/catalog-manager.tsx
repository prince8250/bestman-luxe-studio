"use client";

import * as React from "react";
import Image from "next/image";
import { Archive, ArrowDown, ArrowUp, Globe, Pencil, Plus, RotateCcw, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";

import { PosButton } from "@/components/brand-pos/pos-button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActionResult } from "@/lib/actions/result";
import type { CategoryRow, ServiceRow, StaffOption } from "@/lib/catalog/schema";
import { formatGhs } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requestErrorMessage } from "@/lib/actions/request-error";

import {
  deleteCategoryAction,
  deleteServiceAction,
  reorderAction,
  setCategoryActiveAction,
  setServiceActiveAction,
} from "@/app/pos/(app)/services/actions";

import { CategoryForm } from "./category-form";
import { QuickPrices } from "./quick-prices";
import { ServiceForm } from "./service-form";

type Editing =
  | { kind: "service"; service: ServiceRow | null; categoryId: string | null }
  | { kind: "category"; category: CategoryRow | null }
  | null;

type Confirm =
  | { kind: "archive-service" | "delete-service"; service: ServiceRow }
  | { kind: "archive-category" | "delete-category"; category: CategoryRow }
  | null;

interface CatalogManagerProps {
  services: ServiceRow[];
  categories: CategoryRow[];
  staff: StaffOption[];
}

// The owner's catalog: services by category, categories, and quick prices.
export function CatalogManager({ services, categories, staff }: CatalogManagerProps) {
  const [editing, setEditing] = React.useState<Editing>(null);
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [showRemoved, setShowRemoved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const staffNames = new Map(staff.map((member) => [member.id, member.name]));
  const nextServiceOrder = (categoryId: string | null) =>
    Math.max(0, ...services.filter((s) => s.categoryId === categoryId).map((s) => s.sortOrder)) + 10;
  const nextCategoryOrder = Math.max(0, ...categories.map((c) => c.sortOrder)) + 10;
  const visibleCategories = categories.filter((category) => category.active || showRemoved);

  async function run(action: () => Promise<ActionResult>, success: string) {
    setBusy(true);
    try {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
      return result.ok;
    } catch (error) {
      // The request itself failed (for example the internet dropped).
      toast.error(requestErrorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Moves one row up or down and saves the whole list's order.
  function move<T extends { id: string }>(list: T[], index: number, direction: -1 | 1, table: "services" | "service_categories") {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((row) => row.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => reorderAction({ table, ids }), "Order saved");
  }

  return (
    <>
      <Tabs defaultValue="services" className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-auto rounded-[10px] bg-pos-subtle p-1">
            <TabsTrigger value="services" className="min-h-11 rounded-[8px] px-4">Services</TabsTrigger>
            <TabsTrigger value="categories" className="min-h-11 rounded-[8px] px-4">Categories</TabsTrigger>
            <TabsTrigger value="prices" className="min-h-11 rounded-[8px] px-4">Quick prices</TabsTrigger>
          </TabsList>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showRemoved}
              onChange={(event) => setShowRemoved(event.target.checked)}
              className="h-5 w-5 accent-pos-accent"
            />
            Show removed
          </label>
        </div>

        <TabsContent value="services" className="space-y-6">
          {categories.length === 0 ? (
            <Empty title="No categories yet" text="Add a category first (Categories tab), then its services." />
          ) : (
            visibleCategories.map((category) => {
              const list = services
                .filter((service) => service.categoryId === category.id && (service.active || showRemoved))
                .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
              const activeList = list.filter((service) => service.active);
              return (
                <section key={category.id} className="rounded-[16px] border border-pos-border bg-pos-surface">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-pos-border px-4 py-3">
                    <h2 className="display-type text-2xl">
                      {category.name}
                      {!category.active && <span className="ml-2 font-text text-xs text-pos-text-muted">(removed)</span>}
                    </h2>
                    <PosButton
                      variant="secondary"
                      onClick={() => setEditing({ kind: "service", service: null, categoryId: category.id })}
                    >
                      <Plus /> Add service
                    </PosButton>
                  </header>
                  {list.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-pos-text-muted">No services in this category yet.</p>
                  ) : (
                    <ul>
                      {list.map((service) => {
                        const activeIndex = activeList.indexOf(service);
                        const assigned = service.staffIds.map((id) => staffNames.get(id)).filter(Boolean);
                        return (
                          <li
                            key={service.id}
                            className={cn(
                              "flex flex-wrap items-center gap-3 border-t border-pos-border px-4 py-3 first:border-t-0",
                              !service.active && "bg-pos-bg",
                            )}
                          >
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-pos-subtle">
                              {service.imageUrl ? (
                                <Image src={service.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                              ) : (
                                <span className="display-type flex h-full w-full items-center justify-center text-xl text-pos-text-muted">
                                  {service.name.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 basis-48">
                              <p className="font-medium">{service.name}</p>
                              <p className="text-xs text-pos-text-muted">
                                {service.durationMinutes} min · {assigned.length > 0 ? assigned.join(", ") : "No staff assigned"}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                                {service.active ? (
                                  <>
                                    <Flag on={service.showOnWebsite} icon={<Globe className="h-3.5 w-3.5" />} label="Website" />
                                    <Flag on={service.bookableOnline} icon={<Wifi className="h-3.5 w-3.5" />} label="Online booking" />
                                  </>
                                ) : (
                                  <span className="rounded-md bg-pos-subtle px-2 py-0.5 text-pos-text-muted">Removed, history kept</span>
                                )}
                              </div>
                            </div>
                            <p className="display-type text-2xl tabular-nums">{formatGhs(service.price)}</p>
                            <div className="flex flex-wrap items-center gap-1">
                              {service.active ? (
                                <>
                                  <IconButton label={`Move ${service.name} up`} disabled={busy || activeIndex <= 0} onClick={() => move(activeList, activeIndex, -1, "services")}>
                                    <ArrowUp />
                                  </IconButton>
                                  <IconButton
                                    label={`Move ${service.name} down`}
                                    disabled={busy || activeIndex === activeList.length - 1}
                                    onClick={() => move(activeList, activeIndex, 1, "services")}
                                  >
                                    <ArrowDown />
                                  </IconButton>
                                  <PosButton variant="secondary" onClick={() => setEditing({ kind: "service", service, categoryId: service.categoryId })}>
                                    <Pencil /> Edit
                                  </PosButton>
                                  <PosButton variant="ghost" onClick={() => setConfirm({ kind: "archive-service", service })}>
                                    <Archive /> Remove
                                  </PosButton>
                                </>
                              ) : (
                                <>
                                  <PosButton
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => run(() => setServiceActiveAction(service.id, true), `${service.name} restored`)}
                                  >
                                    <RotateCcw /> Restore
                                  </PosButton>
                                  {!service.hasHistory && (
                                    <PosButton variant="ghost" onClick={() => setConfirm({ kind: "delete-service", service })}>
                                      <Trash2 /> Delete
                                    </PosButton>
                                  )}
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="categories">
          <div className="mb-3 flex justify-end">
            <PosButton onClick={() => setEditing({ kind: "category", category: null })}>
              <Plus /> Add category
            </PosButton>
          </div>
          {visibleCategories.length === 0 ? (
            <Empty title="No categories yet" text="Categories group services on the website and in New sale." />
          ) : (
            <ul className="rounded-[16px] border border-pos-border bg-pos-surface">
              {visibleCategories.map((category) => {
                const activeCategories = categories.filter((c) => c.active);
                const index = activeCategories.indexOf(category);
                return (
                  <li
                    key={category.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 border-t border-pos-border px-4 py-3 first:border-t-0",
                      !category.active && "bg-pos-bg",
                    )}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-pos-subtle">
                      {category.imageUrl ? (
                        <Image src={category.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                      ) : (
                        <span className="display-type flex h-full w-full items-center justify-center text-xl text-pos-text-muted">
                          {category.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="font-medium">
                        {category.name}
                        {!category.active && <span className="ml-2 text-xs text-pos-text-muted">(removed)</span>}
                      </p>
                      <p className="text-xs text-pos-text-muted">
                        {category.tagline ?? "No tagline"} · {category.serviceCount} {category.serviceCount === 1 ? "service" : "services"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {category.active ? (
                        <>
                          <IconButton label={`Move ${category.name} up`} disabled={busy || index <= 0} onClick={() => move(activeCategories, index, -1, "service_categories")}>
                            <ArrowUp />
                          </IconButton>
                          <IconButton
                            label={`Move ${category.name} down`}
                            disabled={busy || index === activeCategories.length - 1}
                            onClick={() => move(activeCategories, index, 1, "service_categories")}
                          >
                            <ArrowDown />
                          </IconButton>
                          <PosButton variant="secondary" onClick={() => setEditing({ kind: "category", category })}>
                            <Pencil /> Edit
                          </PosButton>
                          <PosButton variant="ghost" onClick={() => setConfirm({ kind: "archive-category", category })}>
                            <Archive /> Remove
                          </PosButton>
                        </>
                      ) : (
                        <>
                          <PosButton
                            variant="secondary"
                            disabled={busy}
                            onClick={() => run(() => setCategoryActiveAction(category.id, true), `${category.name} restored`)}
                          >
                            <RotateCcw /> Restore
                          </PosButton>
                          {category.serviceCount === 0 && (
                            <PosButton variant="ghost" onClick={() => setConfirm({ kind: "delete-category", category })}>
                              <Trash2 /> Delete
                            </PosButton>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="prices">
          <QuickPrices services={services} categories={categories.filter((category) => category.active)} />
        </TabsContent>
      </Tabs>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="right" className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="display-type text-3xl">
              {editing?.kind === "category"
                ? editing.category
                  ? "Edit category"
                  : "Add category"
                : editing?.service
                  ? "Edit service"
                  : "Add service"}
            </SheetTitle>
            <SheetDescription>
              {editing?.kind === "category"
                ? "Categories group services on the website and in New sale."
                : "Prices are in GHS. Past sales keep the price they were sold at."}
            </SheetDescription>
          </SheetHeader>
          {editing?.kind === "service" && (
            <ServiceForm
              key={editing.service?.id ?? `new-${editing.categoryId}`}
              service={editing.service}
              categories={categories}
              staff={staff}
              defaultCategoryId={editing.categoryId}
              nextSortOrder={nextServiceOrder(editing.categoryId)}
              onDone={() => setEditing(null)}
            />
          )}
          {editing?.kind === "category" && (
            <CategoryForm
              key={editing.category?.id ?? "new"}
              category={editing.category}
              nextSortOrder={nextCategoryOrder}
              onDone={() => setEditing(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          {confirm && <ConfirmBody confirm={confirm} busy={busy} onCancel={() => setConfirm(null)} run={run} onDone={() => setConfirm(null)} />}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ConfirmBody({
  confirm,
  busy,
  onCancel,
  onDone,
  run,
}: {
  confirm: NonNullable<Confirm>;
  busy: boolean;
  onCancel: () => void;
  onDone: () => void;
  run: (action: () => Promise<ActionResult>, success: string) => Promise<boolean>;
}) {
  const text = (() => {
    switch (confirm.kind) {
      case "archive-service":
        return {
          title: `Remove ${confirm.service.name}?`,
          body: "It will no longer appear in New sale or on the website. Past sales and reports keep it. You can restore it later.",
          button: "Remove",
          action: () => setServiceActiveAction(confirm.service.id, false),
          success: `${confirm.service.name} removed`,
        };
      case "delete-service":
        return {
          title: `Delete ${confirm.service.name} for good?`,
          body: "It was never sold or booked, so nothing is lost. This cannot be undone.",
          button: "Delete",
          action: () => deleteServiceAction(confirm.service.id),
          success: `${confirm.service.name} deleted`,
        };
      case "archive-category":
        return {
          title: `Remove ${confirm.category.name}?`,
          body: "Its panel disappears from the website and its tab from New sale. Its services keep their history. You can restore it later.",
          button: "Remove",
          action: () => setCategoryActiveAction(confirm.category.id, false),
          success: `${confirm.category.name} removed`,
        };
      case "delete-category":
        return {
          title: `Delete ${confirm.category.name} for good?`,
          body: "It has no services, so nothing is lost. This cannot be undone.",
          button: "Delete",
          action: () => deleteCategoryAction(confirm.category.id),
          success: `${confirm.category.name} deleted`,
        };
    }
  })();

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{text.title}</AlertDialogTitle>
        <AlertDialogDescription>{text.body}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <PosButton variant="secondary" onClick={onCancel}>
          Cancel
        </PosButton>
        <PosButton
          variant="danger"
          disabled={busy}
          onClick={async () => {
            if (await run(text.action, text.success)) onDone();
          }}
        >
          {text.button}
        </PosButton>
      </AlertDialogFooter>
    </>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <PosButton variant="ghost" size="icon" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </PosButton>
  );
}

function Flag({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5",
        on ? "bg-pos-accent-soft text-pos-accent" : "bg-pos-subtle text-pos-text-muted line-through",
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[16px] border border-dashed border-pos-border bg-pos-surface p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-pos-text-muted">{text}</p>
    </div>
  );
}
