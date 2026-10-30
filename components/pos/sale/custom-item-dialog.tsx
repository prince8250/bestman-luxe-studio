"use client";

import * as React from "react";

import { PosButton } from "@/components/brand-pos/pos-button";
import { Field, FormError, posInputClass } from "@/components/pos/form-fields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseGhs } from "@/lib/money";

interface CustomItemDialogProps {
  open: boolean;
  role: "owner" | "counter";
  onCancel: () => void;
  onAdd: (item: { name: string; price: number; reason: string | null }) => void;
}

// A free-text line for an occasional product or extra (for example hair oil).
// It counts as revenue but is reported apart from services. Counter users
// give a reason.
export function CustomItemDialog({ open, role, onCancel, onAdd }: CustomItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="rounded-[16px] sm:max-w-md">{open && <CustomItemForm role={role} onCancel={onCancel} onAdd={onAdd} />}</DialogContent>
    </Dialog>
  );
}

function CustomItemForm({ role, onCancel, onAdd }: Omit<CustomItemDialogProps, "open">) {
  const [name, setName] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [reason, setReason] = React.useState("Product sold at the counter");
  const [error, setError] = React.useState<string | null>(null);

  function add(event: React.FormEvent) {
    event.preventDefault();
    const pesewas = parseGhs(price);
    if (!name.trim()) return setError("Enter what is being sold.");
    if (pesewas === null) return setError("Enter a price in GHS, for example 35.");
    if (role === "counter" && !reason.trim()) return setError("Give a reason.");
    onAdd({ name: name.trim().slice(0, 80), price: pesewas, reason: reason.trim() || null });
  }

  return (
    <form onSubmit={add} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="display-type text-3xl">Custom item</DialogTitle>
        <DialogDescription>For a product or an extra that is not in the service list.</DialogDescription>
      </DialogHeader>
      <Field id="custom-name" label="What is it?">
        <Input id="custom-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Hair oil" className={posInputClass} />
      </Field>
      <Field id="custom-price" label="Price (GHS)">
        <Input id="custom-price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} className={posInputClass} />
      </Field>
      <Field id="custom-reason" label={role === "counter" ? "Reason" : "Reason (optional)"}>
        <Input id="custom-reason" value={reason} onChange={(event) => setReason(event.target.value)} className={posInputClass} />
      </Field>
      <FormError message={error} />
      <DialogFooter>
        <PosButton variant="secondary" onClick={onCancel}>
          Cancel
        </PosButton>
        <PosButton type="submit">Add to sale</PosButton>
      </DialogFooter>
    </form>
  );
}
