"use client";

import * as React from "react";
import { Banknote, CreditCard, Plus, Smartphone, Split, X } from "lucide-react";

import { posInputClass } from "@/components/pos/form-fields";
import { Input } from "@/components/ui/input";
import { formatGhs, parseGhs, pesewasToInput } from "@/lib/money";
import { splitRemaining, type PaymentMethod, type PaymentMode, type Ticket } from "@/lib/sale/ticket";
import { cn } from "@/lib/utils";

const MODES: { mode: PaymentMode; label: string; icon: React.ReactNode }[] = [
  { mode: "cash", label: "Cash", icon: <Banknote className="h-5 w-5" /> },
  { mode: "momo", label: "MoMo", icon: <Smartphone className="h-5 w-5" /> },
  { mode: "card", label: "Card", icon: <CreditCard className="h-5 w-5" /> },
  { mode: "split", label: "Split", icon: <Split className="h-5 w-5" /> },
];

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: "Cash", momo: "MoMo", card: "Card", other: "Other" };

// Quick "cash given" amounts: exact, then the next round notes above the total.
function quickTenders(total: number): number[] {
  const steps = [1000, 2000, 5000, 10000, 20000];
  const values = new Set<number>([total]);
  for (const step of steps) {
    const rounded = Math.ceil(total / step) * step;
    if (rounded > total) values.add(rounded);
  }
  return [...values].sort((a, b) => a - b).slice(0, 4);
}

interface PaymentPanelProps {
  ticket: Ticket;
  total: number;
  onChange: (ticket: Ticket) => void;
}

export function PaymentPanel({ ticket, total, onChange }: PaymentPanelProps) {
  // Keep the typed text so "5" does not jump to "5.00" while typing.
  const [tenderedText, setTenderedText] = React.useState(ticket.tendered !== null ? pesewasToInput(ticket.tendered) : "");

  function setMode(mode: PaymentMode) {
    if (mode === "split" && ticket.split.length === 0) {
      onChange({
        ...ticket,
        paymentMode: mode,
        split: [
          { key: crypto.randomUUID(), method: "cash", amount: 0, reference: "" },
          { key: crypto.randomUUID(), method: "momo", amount: total, reference: "" },
        ],
      });
      return;
    }
    onChange({ ...ticket, paymentMode: mode });
  }

  const change = ticket.tendered !== null && ticket.tendered >= total ? ticket.tendered - total : null;
  const remaining = splitRemaining(ticket, total);

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-4 gap-2">
        {MODES.map(({ mode, label, icon }) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={ticket.paymentMode === mode}
            onClick={() => setMode(mode)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[10px] border text-sm font-medium focus-visible:outline-2 focus-visible:outline-pos-accent",
              ticket.paymentMode === mode ? "border-pos-accent bg-pos-accent-soft text-pos-accent" : "border-pos-border hover:bg-pos-subtle",
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {ticket.paymentMode === "cash" && total > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="cash-given">
            Cash given (optional)
          </label>
          <div className="flex flex-wrap gap-2">
            {quickTenders(total).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTenderedText(pesewasToInput(value));
                  onChange({ ...ticket, tendered: value });
                }}
                className={cn(
                  "min-h-11 rounded-[10px] border px-3 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-pos-accent",
                  ticket.tendered === value ? "border-pos-accent bg-pos-accent-soft text-pos-accent" : "border-pos-border",
                )}
              >
                {value === total ? "Exact" : formatGhs(value)}
              </button>
            ))}
          </div>
          <Input
            id="cash-given"
            inputMode="decimal"
            placeholder="GHS"
            value={tenderedText}
            onChange={(event) => {
              setTenderedText(event.target.value);
              onChange({ ...ticket, tendered: event.target.value.trim() ? parseGhs(event.target.value) : null });
            }}
            className={posInputClass}
          />
          {change !== null && (
            <p className="flex items-baseline justify-between rounded-[10px] bg-pos-up-soft px-3 py-2 text-pos-up">
              <span className="text-sm font-medium">Change</span>
              <span className="display-type text-3xl tabular-nums">{formatGhs(change)}</span>
            </p>
          )}
        </div>
      )}

      {(ticket.paymentMode === "momo" || ticket.paymentMode === "card") && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" htmlFor="payment-reference">
            {ticket.paymentMode === "momo" ? "MoMo reference (optional)" : "Card reference (optional)"}
          </label>
          <Input
            id="payment-reference"
            value={ticket.reference}
            onChange={(event) => onChange({ ...ticket, reference: event.target.value })}
            className={posInputClass}
          />
        </div>
      )}

      {ticket.paymentMode === "split" && (
        <div className="space-y-2">
          {ticket.split.map((row) => (
            <SplitRow
              key={row.key}
              method={row.method}
              amount={row.amount}
              reference={row.reference}
              onChange={(next) => onChange({ ...ticket, split: ticket.split.map((current) => (current.key === row.key ? { ...current, ...next } : current)) })}
              onRemove={
                ticket.split.length > 2
                  ? () => onChange({ ...ticket, split: ticket.split.filter((current) => current.key !== row.key) })
                  : undefined
              }
            />
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {ticket.split.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...ticket,
                    split: [...ticket.split, { key: crypto.randomUUID(), method: "card", amount: Math.max(remaining, 0), reference: "" }],
                  })
                }
                className="inline-flex min-h-11 items-center gap-1 rounded-[10px] px-2 text-sm font-medium text-pos-accent hover:bg-pos-accent-soft focus-visible:outline-2 focus-visible:outline-pos-accent"
              >
                <Plus className="h-4 w-4" /> Add payment
              </button>
            )}
            <p className={cn("text-sm font-medium tabular-nums", remaining === 0 ? "text-pos-up" : "text-pos-down")}>
              {remaining === 0 ? "Adds up to the total" : remaining > 0 ? `${formatGhs(remaining)} left to pay` : `${formatGhs(-remaining)} too much`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SplitRow({
  method,
  amount,
  reference,
  onChange,
  onRemove,
}: {
  method: PaymentMethod;
  amount: number;
  reference: string;
  onChange: (next: { method?: PaymentMethod; amount?: number; reference?: string }) => void;
  onRemove?: () => void;
}) {
  const [text, setText] = React.useState(amount ? pesewasToInput(amount) : "");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-pos-border p-2">
      <select
        aria-label="Method"
        value={method}
        onChange={(event) => onChange({ method: event.target.value as PaymentMethod })}
        className="h-11 rounded-[10px] border border-pos-border bg-pos-surface px-2 text-sm"
      >
        {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((key) => (
          <option key={key} value={key}>
            {METHOD_LABEL[key]}
          </option>
        ))}
      </select>
      <Input
        aria-label="Amount in GHS"
        inputMode="decimal"
        placeholder="GHS"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange({ amount: parseGhs(event.target.value) ?? 0 });
        }}
        className={cn(posInputClass, "w-28")}
      />
      {method !== "cash" && (
        <Input
          aria-label="Reference"
          placeholder="Reference"
          value={reference}
          onChange={(event) => onChange({ reference: event.target.value })}
          className={cn(posInputClass, "min-w-24 flex-1")}
        />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove this payment"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-pos-text-muted hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
