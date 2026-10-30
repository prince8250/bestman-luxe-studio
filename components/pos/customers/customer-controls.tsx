"use client";

import * as React from "react";
import { Ban, CircleCheck } from "lucide-react";
import { toast } from "sonner";

import { setCustomerBlockedAction, updateCustomerAction } from "@/app/pos/(app)/customers/actions";
import { PosButton } from "@/components/brand-pos/pos-button";
import { Field, FormError, posInputClass } from "@/components/pos/form-fields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestErrorMessage } from "@/lib/actions/request-error";

// Name and notes (both roles). The phone number is the customer's identity
// and is not editable.
export function CustomerEditForm({ customerId, fullName, notes }: { customerId: string; fullName: string | null; notes: string | null }) {
  const [name, setName] = React.useState(fullName ?? "");
  const [text, setText] = React.useState(notes ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const changed = name.trim() !== (fullName ?? "") || text.trim() !== (notes ?? "");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !changed) return;
    setPending(true);
    setError(null);
    try {
      const result = await updateCustomerAction(customerId, { fullName: name, notes: text });
      if (!result.ok) return setError(result.error);
      toast.success("Customer saved");
    } catch (failure) {
      setError(requestErrorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-3">
      <Field id="customer-name" label="Name">
        <Input id="customer-name" value={name} maxLength={80} placeholder="No name yet" onChange={(event) => setName(event.target.value)} className={posInputClass} />
      </Field>
      <Field id="customer-notes" label="Notes" hint="For example a preferred style or an allergy. Visible to the counter.">
        <Textarea
          id="customer-notes"
          value={text}
          maxLength={1000}
          onChange={(event) => setText(event.target.value)}
          className="min-h-24 rounded-[10px] bg-pos-surface text-base md:text-sm"
        />
      </Field>
      <FormError message={error} />
      <PosButton type="submit" disabled={pending || !changed}>
        {pending ? "Saving…" : "Save"}
      </PosButton>
    </form>
  );
}

// Owner only: block or unblock the number for online booking (reason required
// to block). Logged automatically; the counter can still sell to them.
export function CustomerBlockButton({ customerId, blocked }: { customerId: string; blocked: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (pending) return;
    if (!blocked && !reason.trim()) return setError("Give a reason for blocking the number.");
    setPending(true);
    setError(null);
    try {
      const result = await setCustomerBlockedAction(customerId, !blocked, reason);
      if (!result.ok) {
        if (blocked) toast.error(result.error);
        else setError(result.error);
        return;
      }
      toast.success(blocked ? "Number unblocked for online booking" : "Number blocked for online booking");
      setOpen(false);
      setReason("");
    } catch (failure) {
      const message = requestErrorMessage(failure);
      if (blocked) toast.error(message);
      else setError(message);
    } finally {
      setPending(false);
    }
  }

  if (blocked) {
    return (
      <PosButton variant="secondary" onClick={() => void submit()} disabled={pending}>
        <CircleCheck /> {pending ? "Saving…" : "Unblock online booking"}
      </PosButton>
    );
  }

  return (
    <>
      <PosButton variant="secondary" onClick={() => setOpen(true)} className="text-pos-down">
        <Ban /> Block online booking
      </PosButton>
      <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <form onSubmit={submit} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle className="display-type text-3xl">Block online booking</DialogTitle>
              <DialogDescription>This number can no longer book on the website. They can still be served and pay at the counter.</DialogDescription>
            </DialogHeader>
            <Field id="block-reason" label="Reason">
              <Input
                id="block-reason"
                autoFocus
                value={reason}
                maxLength={300}
                placeholder="For example: three no-shows"
                onChange={(event) => setReason(event.target.value)}
                className={posInputClass}
              />
            </Field>
            <FormError message={error} />
            <DialogFooter>
              <PosButton variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </PosButton>
              <PosButton type="submit" variant="danger" disabled={pending}>
                {pending ? "Saving…" : "Block"}
              </PosButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
