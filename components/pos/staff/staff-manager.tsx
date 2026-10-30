"use client";

import * as React from "react";
import Image from "next/image";
import { Archive, Globe, Pencil, Plus, RotateCcw, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";

import { PosButton } from "@/components/brand-pos/pos-button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ActionResult } from "@/lib/actions/result";
import type { StaffRow } from "@/lib/staff/schema";
import { cn } from "@/lib/utils";

import { archiveStaffAction, deleteStaffAction, restoreStaffAction } from "@/app/pos/(app)/staff/actions";

import { StaffForm } from "./staff-form";

type Confirm = { kind: "archive" | "delete"; member: StaffRow } | null;

// The owner's staff screen: active and archived staff as cards, an add/edit
// sheet, and confirm dialogs for Remove (archive) and permanent delete.
export function StaffManager({ staff }: { staff: StaffRow[] }) {
  const [view, setView] = React.useState<"active" | "archived">("active");
  const [editing, setEditing] = React.useState<StaffRow | "new" | null>(null);
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const active = staff.filter((member) => member.active);
  const archived = staff.filter((member) => !member.active);
  const shown = view === "active" ? active : archived;
  const nextSortOrder = Math.max(0, ...staff.map((member) => member.sortOrder)) + 1;

  async function run(id: string, action: () => Promise<ActionResult>, success: string) {
    setBusyId(id);
    try {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
      return result.ok;
    } catch {
      toast.error("Could not reach the server. Check the internet connection and try again.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Staff list" className="inline-flex rounded-[10px] bg-pos-subtle p-1">
          {(
            [
              ["active", `Active (${active.length})`],
              ["archived", `Removed (${archived.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn(
                "min-h-11 rounded-[8px] px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-pos-accent",
                view === key ? "bg-pos-surface text-pos-text shadow-sm" : "text-pos-text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <PosButton onClick={() => setEditing("new")}>
          <Plus /> Add staff
        </PosButton>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-pos-border bg-pos-surface p-8 text-center">
          <p className="font-medium">{view === "active" ? "No staff yet" : "No removed staff"}</p>
          <p className="mt-1 text-sm text-pos-text-muted">
            {view === "active"
              ? "Add the people who do the work, so sales can record who served each customer."
              : "Staff you remove appear here. Their past sales and reports are kept."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shown.map((member) => (
            <li
              key={member.id}
              className={cn(
                "flex flex-col rounded-[16px] border border-pos-border bg-pos-surface p-5",
                !member.active && "bg-pos-bg",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-pos-subtle">
                  {member.photoUrl ? (
                    <Image src={member.photoUrl} alt={member.name} fill sizes="56px" className="object-cover" />
                  ) : (
                    <span className="display-type flex h-full w-full items-center justify-center text-2xl text-pos-text-muted">
                      {member.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{member.name}</p>
                  <p className="truncate text-sm text-pos-text-muted">{member.title ?? "No title"}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {member.active ? (
                  <>
                    <Badge on={member.showOnWebsite} icon={<Globe className="h-3.5 w-3.5" />} label="On website" />
                    <Badge on={member.bookableOnline} icon={<Wifi className="h-3.5 w-3.5" />} label="Online booking" />
                  </>
                ) : (
                  <span className="rounded-md bg-pos-subtle px-2 py-1 text-pos-text-muted">Removed, history kept</span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {member.active ? (
                  <>
                    <PosButton variant="secondary" className="flex-1" onClick={() => setEditing(member)}>
                      <Pencil /> Edit
                    </PosButton>
                    <PosButton variant="ghost" onClick={() => setConfirm({ kind: "archive", member })}>
                      <Archive /> Remove
                    </PosButton>
                  </>
                ) : (
                  <>
                    <PosButton
                      variant="secondary"
                      className="flex-1"
                      disabled={busyId === member.id}
                      onClick={() => run(member.id, () => restoreStaffAction(member.id), `${member.name} restored`)}
                    >
                      <RotateCcw /> Restore
                    </PosButton>
                    {!member.hasHistory && (
                      <PosButton variant="ghost" onClick={() => setConfirm({ kind: "delete", member })}>
                        <Trash2 /> Delete
                      </PosButton>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="right" className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="display-type text-3xl">{editing === "new" ? "Add staff" : "Edit staff"}</SheetTitle>
            <SheetDescription>Staff are records for sales and booking. They never sign in.</SheetDescription>
          </SheetHeader>
          {editing !== null && (
            <StaffForm
              key={editing === "new" ? "new" : editing.id}
              member={editing === "new" ? null : editing}
              nextSortOrder={nextSortOrder}
              onDone={() => setEditing(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          {confirm?.kind === "archive" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {confirm.member.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirm.member.name} will no longer appear in New sale or online booking. Every past sale and
                  report keeps their name. You can restore them later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <PosButton variant="secondary" onClick={() => setConfirm(null)}>
                  Cancel
                </PosButton>
                <PosButton
                  variant="danger"
                  disabled={busyId === confirm.member.id}
                  onClick={async () => {
                    const member = confirm.member;
                    if (await run(member.id, () => archiveStaffAction(member.id), `${member.name} removed`)) setConfirm(null);
                  }}
                >
                  Remove
                </PosButton>
              </AlertDialogFooter>
            </>
          )}
          {confirm?.kind === "delete" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {confirm.member.name} for good?</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirm.member.name} has no sales and no bookings, so nothing is lost. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <PosButton variant="secondary" onClick={() => setConfirm(null)}>
                  Cancel
                </PosButton>
                <PosButton
                  variant="danger"
                  disabled={busyId === confirm.member.id}
                  onClick={async () => {
                    const member = confirm.member;
                    if (await run(member.id, () => deleteStaffAction(member.id), `${member.name} deleted`)) setConfirm(null);
                  }}
                >
                  Delete
                </PosButton>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Badge({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1",
        on ? "bg-pos-accent-soft text-pos-accent" : "bg-pos-subtle text-pos-text-muted line-through",
      )}
    >
      {icon}
      {label}
    </span>
  );
}
