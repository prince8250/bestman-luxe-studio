"use client";

import * as React from "react";
import Image from "next/image";
import { Minus, Pencil, Plus, X } from "lucide-react";

import { staffForService, type SaleCatalog, type SaleStaff } from "@/lib/sale/catalog";
import type { TicketLine as Line } from "@/lib/sale/ticket";
import { formatGhs } from "@/lib/money";
import { cn } from "@/lib/utils";

interface TicketLineProps {
  line: Line;
  catalog: SaleCatalog;
  onChange: (line: Line) => void;
  onRemove: () => void;
  onEditPrice: () => void;
}

// One line of the ticket: the service, who did it (asked right away), the
// price (changing it needs a reason), and how many.
export function TicketLine({ line, catalog, onChange, onRemove, onEditPrice }: TicketLineProps) {
  const { assigned, others } = staffForService(catalog, line.serviceId);
  const [showOthers, setShowOthers] = React.useState(assigned.length === 0 || Boolean(line.staffId && !assigned.some((s) => s.id === line.staffId)));
  const needsStaff = line.serviceId !== null && !line.staffId;
  const changedPrice = line.unitPrice !== line.listPrice;

  const chip = (member: SaleStaff) => (
    <button
      key={member.id}
      type="button"
      aria-pressed={line.staffId === member.id}
      onClick={() => onChange({ ...line, staffId: line.staffId === member.id && !line.serviceId ? null : member.id })}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-pos-accent",
        line.staffId === member.id ? "border-pos-accent bg-pos-accent text-pos-on-accent" : "border-pos-border bg-pos-surface hover:bg-pos-subtle",
      )}
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pos-subtle text-xs text-pos-text">
        {member.photoUrl ? <Image src={member.photoUrl} alt="" fill sizes="32px" className="object-cover" /> : member.name.charAt(0)}
      </span>
      {member.name}
    </button>
  );

  return (
    <li className={cn("rounded-[12px] border p-3", needsStaff ? "border-pos-warning bg-pos-warning-soft/40" : "border-pos-border")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {line.name}
            {!line.serviceId && <span className="ml-2 rounded-md bg-pos-subtle px-1.5 py-0.5 text-xs text-pos-text-muted">Custom</span>}
          </p>
          {changedPrice && (
            <p className="text-xs text-pos-text-muted">
              Usual {formatGhs(line.listPrice)} · {line.reason}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onEditPrice}
          className="inline-flex min-h-11 items-center gap-1 rounded-[10px] px-2 hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
          aria-label={`Change the price of ${line.name}`}
          title="Change price"
        >
          <span className={cn("display-type text-2xl tabular-nums", changedPrice && "text-pos-accent")}>
            {formatGhs(line.unitPrice * line.quantity)}
          </span>
          <Pencil className="h-4 w-4 text-pos-text-muted" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${line.name}`}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-pos-text-muted hover:bg-pos-subtle hover:text-pos-down focus-visible:outline-2 focus-visible:outline-pos-accent"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-2">
        <p className={cn("mb-1.5 text-xs", needsStaff ? "font-medium text-pos-warning" : "text-pos-text-muted")}>
          {line.serviceId ? (needsStaff ? "Who did it? Choose one." : "Done by") : "Staff (optional)"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {assigned.map(chip)}
          {showOthers ? (
            others.map(chip)
          ) : (
            <button
              type="button"
              onClick={() => setShowOthers(true)}
              className="min-h-11 rounded-full border border-dashed border-pos-border px-3 text-sm text-pos-text-muted hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
            >
              Other staff
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-pos-text-muted">Qty</span>
        <button
          type="button"
          aria-label="One fewer"
          disabled={line.quantity <= 1}
          onClick={() => onChange({ ...line, quantity: line.quantity - 1 })}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-pos-border disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-pos-accent"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-6 text-center text-sm font-medium tabular-nums" aria-live="polite">
          {line.quantity}
        </span>
        <button
          type="button"
          aria-label="One more"
          disabled={line.quantity >= 20}
          onClick={() => onChange({ ...line, quantity: line.quantity + 1 })}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-pos-border disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-pos-accent"
        >
          <Plus className="h-4 w-4" />
        </button>
        {line.quantity > 1 && (
          <span className="text-xs text-pos-text-muted tabular-nums">{formatGhs(line.unitPrice)} each</span>
        )}
      </div>
    </li>
  );
}
