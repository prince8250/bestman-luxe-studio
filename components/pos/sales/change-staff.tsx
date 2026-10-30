"use client";

import * as React from "react";
import Image from "next/image";
import { UserRoundPen } from "lucide-react";
import { toast } from "sonner";

import { reassignStaffAction } from "@/app/pos/(app)/sales/actions";
import { PosButton } from "@/components/brand-pos/pos-button";
import { FormError, posInputClass } from "@/components/pos/form-fields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { requestErrorMessage } from "@/lib/actions/request-error";
import { cn } from "@/lib/utils";

const QUICK_REASONS = ["Staff was busy", "Customer changed preference", "Entered wrong staff"];

export interface ChangeStaffLine {
  id: string;
  name: string;
  staffId: string | null;
  staffName: string | null;
}

export interface ChangeStaffOption {
  id: string;
  name: string;
  photoUrl: string | null;
}

interface ChangeStaffButtonProps {
  receiptNo: string;
  /** The lines that can be changed; the first is chosen when there is only one. */
  lines: ChangeStaffLine[];
  staff: ChangeStaffOption[];
  /** "button" on the sale page; "compact" (text) and "icon" in the sales list. */
  look?: "button" | "compact" | "icon";
}

// Change who did a line (spec 11): pick the person, give a reason. The total,
// the receipt number, and the payments stay as they are; the change and its
// reason are logged for the owner.
export function ChangeStaffButton({ receiptNo, lines, staff, look = "button" }: ChangeStaffButtonProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      {look === "button" ? (
        <PosButton variant="ghost" onClick={() => setOpen(true)} className="min-h-11 px-3 text-sm">
          <UserRoundPen /> Change staff
        </PosButton>
      ) : look === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Change staff on ${receiptNo}`}
          title="Change staff"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-pos-accent hover:bg-pos-accent-soft focus-visible:outline-2 focus-visible:outline-pos-accent"
        >
          <UserRoundPen className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Change staff on ${receiptNo}`}
          className="relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2.5 text-sm font-medium text-pos-accent hover:bg-pos-accent-soft focus-visible:outline-2 focus-visible:outline-pos-accent"
        >
          <UserRoundPen className="h-4 w-4" /> Change staff
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[16px] sm:max-w-lg">
          {open && <ChangeStaffForm receiptNo={receiptNo} lines={lines} staff={staff} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChangeStaffForm({ receiptNo, lines, staff, onDone }: Omit<ChangeStaffButtonProps, "look"> & { onDone: () => void }) {
  const [lineId, setLineId] = React.useState(lines.length === 1 ? lines[0].id : "");
  const [staffId, setStaffId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const line = lines.find((candidate) => candidate.id === lineId) ?? null;
  const choices = staff.filter((member) => member.id !== line?.staffId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!line) return setError("Choose the service to change.");
    if (!staffId) return setError("Choose who did the work.");
    if (!reason.trim()) return setError("Give a reason.");
    setPending(true);
    setError(null);
    try {
      const result = await reassignStaffAction(line.id, staffId, reason.trim());
      if (!result.ok) return setError(result.error);
      toast.success(`${line.name} is now credited to ${staff.find((member) => member.id === staffId)?.name ?? "them"}`);
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
        <DialogTitle className="display-type text-3xl">Change staff</DialogTitle>
        <DialogDescription>{receiptNo}: the total, receipt number, and payments stay the same. The change is recorded with your reason.</DialogDescription>
      </DialogHeader>

      {lines.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Which service?</legend>
          <div className="space-y-1.5">
            {lines.map((candidate) => (
              <label
                key={candidate.id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-sm",
                  lineId === candidate.id ? "border-pos-accent bg-pos-accent-soft" : "border-pos-border hover:bg-pos-subtle",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="line"
                    value={candidate.id}
                    checked={lineId === candidate.id}
                    onChange={() => {
                      setLineId(candidate.id);
                      setStaffId("");
                    }}
                    className="h-4 w-4 accent-pos-accent"
                  />
                  <span className="font-medium">{candidate.name}</span>
                </span>
                <span className="text-pos-text-muted">{candidate.staffName ?? "No staff"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {line && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            Who did {line.name}?{line.staffName && <span className="font-normal text-pos-text-muted"> (now {line.staffName})</span>}
          </legend>
          {choices.length === 0 ? (
            <p className="text-sm text-pos-text-muted">There is no other active staff member to choose.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {choices.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  aria-pressed={staffId === member.id}
                  onClick={() => setStaffId(member.id)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-pos-accent",
                    staffId === member.id ? "border-pos-accent bg-pos-accent text-pos-on-accent" : "border-pos-border bg-pos-surface hover:bg-pos-subtle",
                  )}
                >
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pos-subtle text-xs text-pos-text">
                    {member.photoUrl ? <Image src={member.photoUrl} alt="" fill sizes="32px" className="object-cover" /> : member.name.charAt(0)}
                  </span>
                  {member.name}
                </button>
              ))}
            </div>
          )}
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
          {pending ? "Saving…" : "Change staff"}
        </PosButton>
      </DialogFooter>
    </form>
  );
}
