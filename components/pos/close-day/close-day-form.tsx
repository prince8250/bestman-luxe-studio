"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { closeDayAction } from "@/app/pos/(app)/close-day/actions";
import { PosButton } from "@/components/brand-pos/pos-button";
import { Field, FormError, posInputClass } from "@/components/pos/form-fields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestErrorMessage } from "@/lib/actions/request-error";
import { closeDaySchema, dayReportFileNames, type CloseDayInput, type CloseDayValues, type DayReportFiles } from "@/lib/close-day/close-day";
import { saveFile } from "@/lib/download";
import { formatGhs, parseGhs, pesewasToInput } from "@/lib/money";
import { cn } from "@/lib/utils";

type FieldName = keyof CloseDayInput;

// The extra copy of the day report on the PC (spec 17): HTML to read and
// print, CSV for a spreadsheet. Chrome may ask once to allow two downloads.
export function saveDayReport(files: DayReportFiles) {
  const names = dayReportFileNames(files.date);
  saveFile(files.html, names.html, "text/html;charset=utf-8");
  setTimeout(() => saveFile(files.csv, names.csv, "text/csv;charset=utf-8"), 400);
}

// Step 1: the blind count. Nothing on this screen knows the expected cash;
// close_day works it out on the server after the count is saved, and only
// then does the page show it (step 2).
export function CloseDayForm({ date, dayLabel, defaultFloat }: { date: string; dayLabel: string; defaultFloat: number }) {
  const [values, setValues] = React.useState<CloseDayInput>({
    date,
    counted: "",
    momo: "",
    float: pesewasToInput(defaultFloat),
    floatReason: "",
    note: "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<CloseDayValues | null>(null);
  const [pending, setPending] = React.useState(false);
  const schema = React.useMemo(() => closeDaySchema(defaultFloat), [defaultFloat]);

  const floatChanged = parseGhs(values.float) !== defaultFloat;
  const set = (name: FieldName) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((current) => ({ ...current, [name]: event.target.value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  function review(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) {
        const name = issue.path[0] as FieldName | undefined;
        if (name && !next[name]) next[name] = issue.message;
      }
      setErrors(next);
      return;
    }
    setConfirming(parsed.data);
  }

  async function close() {
    if (pending) return;
    setPending(true);
    setFormError(null);
    try {
      const result = await closeDayAction(values);
      if (!result.ok) {
        setFormError(result.error);
        setConfirming(null);
        return;
      }
      toast.success(`${dayLabel} closed`);
      if (result.data.files) saveDayReport(result.data.files);
      // The page now shows step 2 (the action refreshed it).
    } catch (error) {
      setFormError(requestErrorMessage(error));
      setConfirming(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={review} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="counted" className="text-base font-medium">
          Cash in the drawer
        </label>
        <p className="text-sm text-pos-text-muted">Count every note and coin in the drawer, the opening float included.</p>
        <div className="relative">
          <span aria-hidden className="display-type pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-3xl text-pos-text-muted">
            GHS
          </span>
          <Input
            id="counted"
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            value={values.counted}
            onChange={set("counted")}
            aria-invalid={Boolean(errors.counted)}
            aria-describedby={errors.counted ? "counted-error" : undefined}
            placeholder="0.00"
            className="display-type h-20 rounded-[16px] bg-pos-surface pl-20 text-5xl md:text-5xl"
          />
        </div>
        {errors.counted && (
          <p id="counted-error" className="text-sm text-pos-down">
            {errors.counted}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="float" label="Opening float (GHS)" hint="The cash the drawer started with." error={errors.float}>
          <Input id="float" inputMode="decimal" autoComplete="off" value={values.float} onChange={set("float")} className={posInputClass} />
        </Field>
        <Field id="momo" label="MoMo total (optional)" hint="As shown on the MoMo phone or statement for this day." error={errors.momo}>
          <Input id="momo" inputMode="decimal" autoComplete="off" value={values.momo} onChange={set("momo")} className={posInputClass} />
        </Field>
      </div>

      {floatChanged && (
        <Field
          id="floatReason"
          label="Why is the opening float different today?"
          hint={`Settings say ${formatGhs(defaultFloat)}.`}
          error={errors.floatReason}
        >
          <Input id="floatReason" maxLength={300} value={values.floatReason} onChange={set("floatReason")} className={posInputClass} />
        </Field>
      )}

      <Field id="note" label="Note (optional)" error={errors.note}>
        <Textarea
          id="note"
          maxLength={500}
          value={values.note}
          onChange={set("note")}
          className="min-h-20 rounded-[10px] bg-pos-surface text-base md:text-sm"
        />
      </Field>

      <FormError message={formError} />

      <PosButton type="submit" size="lg" fullWidth className="sm:w-auto">
        <Lock /> Close {dayLabel}
      </PosButton>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && !pending && setConfirming(null)}>
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display-type text-3xl">Close {dayLabel}?</DialogTitle>
            <DialogDescription>
              You counted <strong className="text-pos-text">{confirming ? formatGhs(confirming.countedCash) : ""}</strong>. After closing you
              will see what the POS expected. Only the owner can reopen a closed day.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <PosButton variant="secondary" onClick={() => setConfirming(null)} disabled={pending}>
              Back to the count
            </PosButton>
            <PosButton onClick={() => void close()} disabled={pending} className={cn(pending && "cursor-wait")}>
              <Lock /> {pending ? "Closing…" : "Close the day"}
            </PosButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
