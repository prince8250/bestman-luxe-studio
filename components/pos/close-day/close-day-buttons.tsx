"use client";

import * as React from "react";
import { Download, LockOpen, Printer } from "lucide-react";
import { toast } from "sonner";

import { dayReportFilesAction, reopenDayAction } from "@/app/pos/(app)/close-day/actions";
import { PosButton } from "@/components/brand-pos/pos-button";
import { saveDayReport } from "@/components/pos/close-day/close-day-form";
import { FormError } from "@/components/pos/form-fields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestErrorMessage } from "@/lib/actions/request-error";

const PAGE_STYLE_ID = "close-slip-page-size";

// The close slip prints on the 80mm roll as one page exactly as long as the
// slip, so the printer cuts once, at the end.
function setSlipPageSize() {
  let style = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = PAGE_STYLE_ID;
    document.head.appendChild(style);
  }
  const slip = document.querySelector<HTMLElement>(".close-slip");
  const heightMm = Math.ceil(((slip?.offsetHeight ?? 0) * 25.4) / 96) + 2;
  style.textContent = `@page { size: 80mm ${Math.max(heightMm, 60)}mm; margin: 0; }`;
}

export function PrintSlipButton() {
  React.useEffect(() => () => document.getElementById(PAGE_STYLE_ID)?.remove(), []);
  return (
    <PosButton
      onClick={async () => {
        await document.fonts?.ready;
        setSlipPageSize();
        window.print();
      }}
    >
      <Printer /> Print close slip
    </PosButton>
  );
}

export function DownloadDayReportButton({ date }: { date: string }) {
  const [pending, setPending] = React.useState(false);
  return (
    <PosButton
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await dayReportFilesAction(date);
          if (result.ok) saveDayReport(result.data);
          else toast.error(result.error);
        } catch (error) {
          toast.error(requestErrorMessage(error));
        } finally {
          setPending(false);
        }
      }}
    >
      <Download /> {pending ? "Preparing…" : "Download day report"}
    </PosButton>
  );
}

// Owner only: reopen the day with a reason; the close stays in the history
// and the day can be counted and closed again.
export function ReopenDayButton({ date, dayLabel }: { date: string; dayLabel: string }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!reason.trim()) return setError("Give a reason for reopening the day.");
    setPending(true);
    setError(null);
    try {
      const result = await reopenDayAction(date, reason);
      if (!result.ok) return setError(result.error);
      toast.success(`${dayLabel} reopened`);
      setReason("");
      setOpen(false);
    } catch (failure) {
      setError(requestErrorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PosButton variant="secondary" onClick={() => setOpen(true)}>
        <LockOpen /> Reopen day
      </PosButton>
      <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <form onSubmit={submit} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle className="display-type text-3xl">Reopen {dayLabel}?</DialogTitle>
              <DialogDescription>
                This close stays in the history. The day can then be counted and closed again, and the new close is the one the reports
                use.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="reopen-reason">Reason</Label>
              <Textarea
                id="reopen-reason"
                autoFocus
                value={reason}
                maxLength={300}
                onChange={(event) => {
                  setReason(event.target.value);
                  setError(null);
                }}
                className="min-h-24 rounded-[10px] bg-pos-surface text-base md:text-sm"
              />
            </div>
            <FormError message={error} />
            <DialogFooter>
              <PosButton variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </PosButton>
              <PosButton type="submit" disabled={pending}>
                {pending ? "Reopening…" : "Reopen day"}
              </PosButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
