"use client";

import * as React from "react";
import { toast } from "sonner";

import { PosButton } from "@/components/brand-pos/pos-button";
import { FormError } from "@/components/pos/form-fields";
import type { CategoryRow, ServiceRow } from "@/lib/catalog/schema";
import { formatGhs, parseGhs, pesewasToInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requestErrorMessage } from "@/lib/actions/request-error";

import { updatePricesAction } from "@/app/pos/(app)/services/actions";

// Change many prices at once. Each changed price is logged (old and new) by
// the database; past sales keep the price they were sold at.
export function QuickPrices({ services, categories }: { services: ServiceRow[]; categories: CategoryRow[] }) {
  const active = services.filter((service) => service.active);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(active.map((service) => [service.id, pesewasToInput(service.price)])),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const original = new Map(active.map((service) => [service.id, service.price]));
  const rows = active.map((service) => {
    // A service added after this table opened starts at its saved price.
    const text = values[service.id] ?? pesewasToInput(service.price);
    const parsed = parseGhs(text);
    return { service, text, parsed, invalid: parsed === null, changed: parsed !== null && parsed !== original.get(service.id) };
  });
  const changes = rows.filter((row) => row.changed);
  const invalid = rows.filter((row) => row.invalid);

  async function save() {
    setError(null);
    if (invalid.length > 0) {
      setError(`Fix the ${invalid.length === 1 ? "price" : "prices"} marked in red first.`);
      return;
    }
    setPending(true);
    try {
      const result = await updatePricesAction(changes.map((row) => ({ id: row.service.id, price: row.parsed as number })));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`${result.data.changed} ${result.data.changed === 1 ? "price" : "prices"} saved`);
    } catch (error) {
      setError(requestErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (active.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-pos-border bg-pos-surface p-8 text-center">
        <p className="font-medium">No services yet</p>
        <p className="mt-1 text-sm text-pos-text-muted">Add services first, then change their prices here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-pos-border bg-pos-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pos-border p-4">
        <p className="text-sm text-pos-text-muted">
          Changing a price never changes past sales. Every change is logged with the old and new price.
        </p>
        <PosButton onClick={save} disabled={pending || changes.length === 0}>
          {pending
            ? "Saving…"
            : changes.length === 0
              ? "No changes"
              : `Save ${changes.length} ${changes.length === 1 ? "change" : "changes"}`}
        </PosButton>
      </div>
      {error && (
        <div className="px-4 pt-4">
          <FormError message={error} />
        </div>
      )}
      {categories.map((category) => {
        const inCategory = rows.filter((row) => row.service.categoryId === category.id);
        if (inCategory.length === 0) return null;
        return (
          <section key={category.id} className="border-b border-pos-border last:border-b-0">
            <h3 className="display-type bg-pos-bg px-4 py-2 text-xl">{category.name}</h3>
            <ul>
              {inCategory.map((row) => (
                <li
                  key={row.service.id}
                  className={cn(
                    "flex items-center justify-between gap-3 border-t border-pos-border px-4 py-2 first:border-t-0",
                    row.changed && "bg-pos-accent-soft/60",
                  )}
                >
                  <label htmlFor={`price-${row.service.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.service.name}</span>
                    <span className="block text-xs text-pos-text-muted tabular-nums">
                      {row.changed ? `Was ${formatGhs(original.get(row.service.id) ?? 0)}` : `${row.service.durationMinutes} min`}
                    </span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-pos-text-muted">GHS</span>
                    <input
                      id={`price-${row.service.id}`}
                      inputMode="decimal"
                      value={row.text}
                      aria-invalid={row.invalid}
                      onChange={(event) => setValues((current) => ({ ...current, [row.service.id]: event.target.value }))}
                      className={cn(
                        "h-11 w-28 rounded-[10px] border bg-pos-surface px-3 text-right text-base tabular-nums md:text-sm",
                        "focus-visible:border-pos-accent focus-visible:outline-2 focus-visible:outline-pos-accent/30",
                        row.invalid ? "border-pos-down text-pos-down" : "border-pos-border",
                      )}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
