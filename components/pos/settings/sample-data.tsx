"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PosButton } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import { FormError, posInputClass } from "@/components/pos/form-fields";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

import { removeSampleDataAction } from "@/app/pos/(app)/settings/actions";

const LABELS: Record<string, string> = {
  sales: "sales",
  appointments: "appointments",
  customers: "customers",
  staff: "staff",
  services: "services",
  service_categories: "categories",
  offers: "offers",
  gallery_images: "gallery photos",
  day_closes: "day closes",
  owner_alerts: "alerts",
};

// Before the studio starts using the POS for real, the owner removes all the
// clearly marked sample data in one step. Real rows are never touched.
export function SampleData({ summary }: { summary: Record<string, number> }) {
  const [open, setOpen] = React.useState(false);
  const [keepCatalog, setKeepCatalog] = React.useState(true);
  const [confirmText, setConfirmText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const entries = Object.entries(summary).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;
  const willRemove = entries.filter(([table]) => !(keepCatalog && (table === "services" || table === "service_categories")));

  async function remove() {
    setError(null);
    setPending(true);
    try {
      const result = await removeSampleDataAction(keepCatalog);
      if (!result.ok) return setError(result.error);
      toast.success("Sample data removed. The POS is ready for real use.");
      setOpen(false);
    } catch {
      setError("Could not reach the server. Check the internet connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <PosCard title="Sample data">
      <p className="text-sm text-pos-text-muted">
        The POS was filled with sample data for testing:{" "}
        {entries.map(([table, count]) => `${count} ${LABELS[table] ?? table}`).join(", ")}. Remove it before the studio
        starts using the POS for real. Anything real you added is kept.
      </p>
      <PosButton variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        <Trash2 /> Remove sample data
      </PosButton>

      <AlertDialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
        <AlertDialogContent className="rounded-[16px] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all sample data?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {willRemove.map(([table, count]) => `${count} ${LABELS[table] ?? table}`).join(", ")}. It
              cannot be undone. Receipt numbers start again at BLS-000001 when no sales are left.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={keepCatalog}
              onChange={(event) => setKeepCatalog(event.target.checked)}
              className="h-5 w-5 accent-pos-accent"
            />
            Keep the service list (the studio&apos;s real services, with sample prices to fix)
          </label>
          <label className="block space-y-1.5 text-sm">
            Type REMOVE to confirm
            <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} className={posInputClass} />
          </label>
          <FormError message={error} />
          <AlertDialogFooter>
            <PosButton variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </PosButton>
            <PosButton variant="danger" disabled={pending || confirmText.trim() !== "REMOVE"} onClick={remove}>
              {pending ? "Removing…" : "Remove sample data"}
            </PosButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PosCard>
  );
}
