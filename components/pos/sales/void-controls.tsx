"use client";

import * as React from "react";
import { Ban, Check, Printer, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { cancelVoidRequestAction, decideVoidRequestAction, requestVoidAction, voidSaleAction } from "@/app/pos/(app)/sales/actions";
import { PosButton } from "@/components/brand-pos/pos-button";
import { FormError } from "@/components/pos/form-fields";
import { newPrintJob, ReceiptPrintFrame, type PrintJob } from "@/components/pos/receipt/receipt-print-frame";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestErrorMessage } from "@/lib/actions/request-error";
import type { ActionResult } from "@/lib/actions/result";

// Runs a server action, shows a toast on success, and returns the error
// message (or null) so a dialog can keep its text on failure.
async function run(action: () => Promise<ActionResult>, success: string): Promise<string | null> {
  try {
    const result = await action();
    if (!result.ok) return result.error;
    toast.success(success);
    return null;
  } catch (error) {
    return requestErrorMessage(error);
  }
}

// A dialog with one text box (a reason or a note) and a confirm button.
function TextDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  required,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  label: string;
  required: boolean;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (text: string) => Promise<string | null>;
}) {
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (required && !text.trim()) return setError(`${label} is needed.`);
    setPending(true);
    setError(null);
    const failure = await onConfirm(text.trim());
    setPending(false);
    if (failure) setError(failure);
    else {
      setText("");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !pending && onOpenChange(value)}>
      <DialogContent className="rounded-[16px] sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="display-type text-3xl">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="void-text">{required ? label : `${label} (optional)`}</Label>
            <Textarea
              id="void-text"
              autoFocus
              value={text}
              maxLength={500}
              onChange={(event) => setText(event.target.value)}
              className="min-h-24 rounded-[10px] bg-pos-surface text-base md:text-sm"
            />
          </div>
          <FormError message={error} />
          <DialogFooter>
            <PosButton variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </PosButton>
            <PosButton type="submit" variant={danger ? "danger" : "primary"} disabled={pending}>
              {pending ? "Saving…" : confirmLabel}
            </PosButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Owner: void a sale directly (reason required).
export function VoidSaleButton({ saleId, receiptNo }: { saleId: string; receiptNo: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <PosButton variant="secondary" onClick={() => setOpen(true)} className="text-pos-down">
        <Ban /> Void sale
      </PosButton>
      <TextDialog
        open={open}
        onOpenChange={setOpen}
        title={`Void ${receiptNo}?`}
        description="The sale stays in the records, marked voided, and stops counting in every total and report. This cannot be undone."
        label="Reason"
        required
        confirmLabel="Void sale"
        danger
        onConfirm={(reason) => run(() => voidSaleAction(saleId, reason), `${receiptNo} voided`)}
      />
    </>
  );
}

// Counter: ask the owner to void (reason required).
export function RequestVoidButton({ saleId, receiptNo }: { saleId: string; receiptNo: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <PosButton variant="secondary" onClick={() => setOpen(true)}>
        <Ban /> Request void (the owner will approve)
      </PosButton>
      <TextDialog
        open={open}
        onOpenChange={setOpen}
        title={`Request a void of ${receiptNo}`}
        description="The owner is told and approves or rejects it. Until then the sale counts as normal."
        label="Reason"
        required
        confirmLabel="Send request"
        onConfirm={(reason) => run(() => requestVoidAction(saleId, reason), "Void requested. The owner will decide.")}
      />
    </>
  );
}

// Counter: withdraw your own pending request.
export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [pending, setPending] = React.useState(false);
  async function cancel() {
    setPending(true);
    const failure = await run(() => cancelVoidRequestAction(requestId), "Void request withdrawn");
    setPending(false);
    if (failure) toast.error(failure);
  }
  return (
    <PosButton variant="secondary" onClick={cancel} disabled={pending}>
      <Undo2 /> {pending ? "Withdrawing…" : "Withdraw request"}
    </PosButton>
  );
}

// Owner: approve (voids the sale with the request's reason) or reject (note required).
export function DecideRequestButtons({ requestId, receiptNo, reason }: { requestId: string; receiptNo: string; reason: string }) {
  const [dialog, setDialog] = React.useState<"approve" | "reject" | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <PosButton variant="danger" onClick={() => setDialog("approve")}>
        <Check /> Approve void
      </PosButton>
      <PosButton variant="secondary" onClick={() => setDialog("reject")}>
        <X /> Reject
      </PosButton>
      <TextDialog
        open={dialog === "approve"}
        onOpenChange={(open) => setDialog(open ? "approve" : null)}
        title={`Void ${receiptNo}?`}
        description={<>The sale is voided with the request&apos;s reason: &ldquo;{reason}&rdquo;. It stops counting in every total and report.</>}
        label="Note"
        required={false}
        confirmLabel="Approve and void"
        danger
        onConfirm={(note) => run(() => decideVoidRequestAction(requestId, true, note), `${receiptNo} voided`)}
      />
      <TextDialog
        open={dialog === "reject"}
        onOpenChange={(open) => setDialog(open ? "reject" : null)}
        title="Reject the request"
        description={`${receiptNo} stays paid. The note is kept with the request.`}
        label="Why it is rejected"
        required
        confirmLabel="Reject request"
        onConfirm={(note) => run(() => decideVoidRequestAction(requestId, false, note), "Request rejected")}
      />
    </div>
  );
}

// Both roles: print the receipt again (marked REPRINT) without leaving the page.
export function ReprintButton({ saleId }: { saleId: string }) {
  const [job, setJob] = React.useState<PrintJob | null>(null);
  return (
    <>
      <PosButton variant="secondary" onClick={() => setJob(newPrintJob(saleId))}>
        <Printer /> Reprint
      </PosButton>
      <ReceiptPrintFrame job={job} />
    </>
  );
}
