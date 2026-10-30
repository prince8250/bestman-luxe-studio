"use client";

import * as React from "react";

import { PosButton } from "@/components/brand-pos/pos-button";
import { Field, FormError, posInputClass } from "@/components/pos/form-fields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatGhs, parseGhs, pesewasToInput } from "@/lib/money";
import { exceedsCounterDiscount, type TicketLine } from "@/lib/sale/ticket";
import { cn } from "@/lib/utils";

const QUICK_REASONS = ["Regular customer", "Offer", "Child", "Extra work", "Short hair", "Long hair"];

interface PriceDialogProps {
  line: TicketLine | null;
  role: "owner" | "counter";
  maxCounterDiscountPercent: number;
  onCancel: () => void;
  onApply: (unitPrice: number, reason: string | null) => void;
}

// Changing a line's price always needs a reason. A counter user can discount
// only up to the limit in Settings (the server checks again); raising a price
// is allowed with a reason.
export function PriceDialog({ line, role, maxCounterDiscountPercent, onCancel, onApply }: PriceDialogProps) {
  return (
    <Dialog open={line !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="rounded-[16px] sm:max-w-md">
        {line && (
          <PriceForm
            key={line.key}
            line={line}
            role={role}
            maxCounterDiscountPercent={maxCounterDiscountPercent}
            onCancel={onCancel}
            onApply={onApply}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PriceForm({ line, role, maxCounterDiscountPercent, onCancel, onApply }: Omit<PriceDialogProps, "line"> & { line: TicketLine }) {
  const [price, setPrice] = React.useState(pesewasToInput(line.unitPrice));
  const [reason, setReason] = React.useState(line.reason ?? "");
  const [error, setError] = React.useState<string | null>(null);

  const parsed = parseGhs(price);
  const changed = parsed !== null && parsed !== line.listPrice;
  const tooBig = parsed !== null && role === "counter" && exceedsCounterDiscount(line.listPrice, parsed, maxCounterDiscountPercent);
  const lowest = Math.ceil((line.listPrice * (100 - maxCounterDiscountPercent)) / 100);

  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (parsed === null) return setError("Enter a price in GHS, for example 45 or 45.50.");
    if (tooBig) return setError(`Bigger discounts need the owner. The lowest you can charge is ${formatGhs(lowest)}.`);
    if (changed && !reason.trim()) return setError("Give a reason for the new price.");
    onApply(parsed, changed ? reason.trim() : null);
  }

  return (
    <form onSubmit={apply} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="display-type text-3xl">Change price</DialogTitle>
        <DialogDescription>
          {line.name}: the usual price is {formatGhs(line.listPrice)}.
          {role === "counter" && ` Discounts up to ${maxCounterDiscountPercent}%; bigger discounts need the owner.`}
        </DialogDescription>
      </DialogHeader>
      <Field id="price-new" label="New price (GHS)">
        <Input
          id="price-new"
          inputMode="decimal"
          autoFocus
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className={cn(posInputClass, "display-type h-14 text-3xl")}
        />
      </Field>
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
        <Input
          aria-label="Reason"
          placeholder="Or type the reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={posInputClass}
        />
      </fieldset>
      {tooBig && (
        <p className="rounded-[10px] bg-pos-warning-soft px-3 py-2.5 text-sm text-pos-warning">
          Bigger discounts need the owner. The lowest you can charge is {formatGhs(lowest)}.
        </p>
      )}
      <FormError message={error} />
      <DialogFooter>
        <PosButton variant="secondary" onClick={onCancel}>
          Cancel
        </PosButton>
        {line.unitPrice !== line.listPrice && (
          <PosButton variant="ghost" onClick={() => onApply(line.listPrice, null)}>
            Back to {formatGhs(line.listPrice)}
          </PosButton>
        )}
        <PosButton type="submit">Use this price</PosButton>
      </DialogFooter>
    </form>
  );
}
