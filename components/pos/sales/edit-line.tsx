"use client";

import * as React from "react";
import { Minus, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { editSaleItemAction } from "@/app/pos/(app)/sales/actions";
import { PosButton } from "@/components/brand-pos/pos-button";
import { Field, FormError, posInputClass } from "@/components/pos/form-fields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { requestErrorMessage } from "@/lib/actions/request-error";
import { formatGhs, parseGhs, pesewasToInput } from "@/lib/money";
import { METHOD_LABEL, METHODS } from "@/lib/sales/history";
import { cn } from "@/lib/utils";

const QUICK_REASONS = ["Wrong service entered", "Wrong price entered", "Extra work done", "Customer changed the service"];

export interface EditableLine {
  id: string;
  name: string;
  custom: boolean;
  serviceId: string | null;
  staffId: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface EditServiceOption {
  id: string;
  name: string;
  price: number;
  categoryName: string;
}

interface EditLineButtonProps {
  receiptNo: string;
  saleTotal: number;
  line: EditableLine;
  services: EditServiceOption[];
}

// The money difference an edit makes: positive is collected from the
// customer, negative is refunded. edit_sale_item requires exactly this amount.
export function lineDifference(line: Pick<EditableLine, "lineTotal">, unitPrice: number, quantity: number): number {
  return unitPrice * quantity - line.lineTotal;
}

// Owner only (spec 11): change a paid line's service, price, or quantity, with
// a reason. If the total changes, the money collected or refunded is recorded
// in the same step, so the payments still equal the total.
export function EditLineButton(props: EditLineButtonProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <PosButton variant="ghost" onClick={() => setOpen(true)} className="min-h-11 px-3 text-sm">
        <Pencil /> Edit
      </PosButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[16px] sm:max-w-lg">
          {open && <EditLineForm {...props} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditLineForm({ receiptNo, saleTotal, line, services, onDone }: EditLineButtonProps & { onDone: () => void }) {
  const [serviceId, setServiceId] = React.useState(line.serviceId ?? "");
  const [price, setPrice] = React.useState(pesewasToInput(line.unitPrice));
  const [quantity, setQuantity] = React.useState(line.quantity);
  const [method, setMethod] = React.useState<(typeof METHODS)[number]>("cash");
  const [reference, setReference] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const unitPrice = parseGhs(price);
  const difference = unitPrice === null ? 0 : lineDifference(line, unitPrice, quantity);
  const serviceChanged = serviceId !== (line.serviceId ?? "");
  const changed = serviceChanged || unitPrice !== line.unitPrice || quantity !== line.quantity;
  const categories = [...new Set(services.map((service) => service.categoryName))];

  function chooseService(next: string) {
    setServiceId(next);
    // A new service starts at its own price (it can still be changed).
    const service = services.find((candidate) => candidate.id === next);
    if (service) setPrice(pesewasToInput(service.price));
    else if (next === (line.serviceId ?? "")) setPrice(pesewasToInput(line.unitPrice));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (unitPrice === null) return setError("Enter the price in GHS, for example 45 or 45.50.");
    if (!changed) return setError("Nothing was changed.");
    if (serviceChanged && !line.staffId) return setError("Choose who did the work (Change staff) before changing the service.");
    if (!reason.trim()) return setError("Give a reason for the change.");
    setPending(true);
    setError(null);
    try {
      const result = await editSaleItemAction({
        itemId: line.id,
        serviceId: serviceChanged ? serviceId : null,
        unitPrice,
        quantity,
        reason: reason.trim(),
        adjustment: difference === 0 ? null : { method, amount: difference, reference: reference.trim() },
      });
      if (!result.ok) return setError(result.error);
      toast.success(`${receiptNo} updated`);
      onDone();
    } catch (failure) {
      setError(requestErrorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="display-type text-3xl">Edit {line.name}</DialogTitle>
        <DialogDescription>{receiptNo}: the change is recorded with your reason. If the total changes, record the money in the same step.</DialogDescription>
      </DialogHeader>

      <Field id="edit-service" label="Service">
        <select
          id="edit-service"
          value={serviceId}
          onChange={(event) => chooseService(event.target.value)}
          className="h-11 w-full rounded-[10px] border border-pos-border bg-pos-surface px-3 text-base md:text-sm"
        >
          <option value={line.serviceId ?? ""}>
            Keep: {line.name}
            {line.custom ? " (custom item)" : ""}
          </option>
          {categories.map((category) => (
            <optgroup key={category} label={category}>
              {services
                .filter((service) => service.categoryName === category && service.id !== line.serviceId)
                .map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {formatGhs(service.price)}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="edit-price" label="Price each (GHS)">
          <Input id="edit-price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} className={posInputClass} />
        </Field>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Quantity</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="One fewer"
              disabled={quantity <= 1}
              onClick={() => setQuantity(quantity - 1)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-pos-border disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-pos-accent"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="One more"
              disabled={quantity >= 20}
              onClick={() => setQuantity(quantity + 1)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-pos-border disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-pos-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <dl className="space-y-1 rounded-[10px] bg-pos-subtle px-3 py-2.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-pos-text-muted">Line total</dt>
          <dd className="tabular-nums">
            {formatGhs(line.lineTotal)} → {unitPrice === null ? "?" : formatGhs(unitPrice * quantity)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-pos-text-muted">Sale total</dt>
          <dd className="tabular-nums">
            {formatGhs(saleTotal)} → {formatGhs(saleTotal + difference)}
          </dd>
        </div>
      </dl>

      {difference !== 0 && (
        <fieldset className={cn("space-y-2 rounded-[10px] border p-3", difference > 0 ? "border-pos-up/40" : "border-pos-down/40")}>
          <legend className="px-1 text-sm font-medium">
            {difference > 0 ? `Collect ${formatGhs(difference)} from the customer` : `Refund ${formatGhs(-difference)} to the customer`}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="edit-method" className="text-xs font-medium text-pos-text-muted">
                {difference > 0 ? "Paid by" : "Refunded by"}
              </label>
              <select
                id="edit-method"
                value={method}
                onChange={(event) => setMethod(event.target.value as (typeof METHODS)[number])}
                className="h-11 w-full rounded-[10px] border border-pos-border bg-pos-surface px-3 text-base md:text-sm"
              >
                {METHODS.map((option) => (
                  <option key={option} value={option}>
                    {METHOD_LABEL[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-reference" className="text-xs font-medium text-pos-text-muted">
                Reference (optional)
              </label>
              <Input id="edit-reference" value={reference} maxLength={60} onChange={(event) => setReference(event.target.value)} className={posInputClass} />
            </div>
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Reason</legend>
        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setReason(quick)}
              className={cn(
                "min-h-11 rounded-[10px] border px-3 text-sm focus-visible:outline-2 focus-visible:outline-pos-accent",
                reason === quick ? "border-pos-accent bg-pos-accent-soft text-pos-accent" : "border-pos-border",
              )}
            >
              {quick}
            </button>
          ))}
        </div>
        <Input aria-label="Reason" placeholder="Or type the reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} className={posInputClass} />
      </fieldset>

      <FormError message={error} />
      <DialogFooter>
        <PosButton variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </PosButton>
        <PosButton type="submit" disabled={pending}>
          {pending ? "Saving…" : difference === 0 ? "Save change" : difference > 0 ? `Save and record ${formatGhs(difference)} collected` : `Save and record ${formatGhs(-difference)} refunded`}
        </PosButton>
      </DialogFooter>
    </form>
  );
}
