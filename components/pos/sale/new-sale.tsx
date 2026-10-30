"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, PackagePlus, Printer, Search, UserRound } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";
import { posInputClass } from "@/components/pos/form-fields";
import { newPrintJob, ReceiptPrintFrame, type PrintJob } from "@/components/pos/receipt/receipt-print-frame";
import { Input } from "@/components/ui/input";
import { requestErrorMessage } from "@/lib/actions/request-error";
import type { PosRole } from "@/lib/auth/types";
import { formatGhs } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import type { SaleCatalog, SaleService } from "@/lib/sale/catalog";
import { clearDraft, loadDraft, saveDraft } from "@/lib/sale/draft";
import { newTicket, salePayload, ticketProblem, ticketTotals, type Ticket, type TicketLine as Line } from "@/lib/sale/ticket";
import { formatAccraDayTime } from "@/lib/time";
import { cn } from "@/lib/utils";

import { confirmSaleAction, lookupCustomerAction, type ConfirmedSale, type CustomerMatch } from "@/app/pos/(app)/sale/new/actions";

import { CustomItemDialog } from "./custom-item-dialog";
import { PaymentPanel } from "./payment-panel";
import { PriceDialog } from "./price-dialog";
import { TicketLine } from "./ticket-line";

interface NewSaleProps {
  catalog: SaleCatalog;
  userId: string;
  role: PosRole;
  maxCounterDiscountPercent: number;
  dayClosed: boolean;
}

type Lookup = { state: "idle" } | { state: "looking" } | { state: "done"; match: CustomerMatch };

// The New sale screen (ui-context.md, "The New Sale Screen"): services on the
// left, the ticket on the right, one dominant CONFIRM button. Built for speed
// at the counter with a mouse and keyboard, and usable by touch.
export function NewSale({ catalog, userId, role, maxCounterDiscountPercent, dayClosed }: NewSaleProps) {
  const [ticket, setTicket] = React.useState<Ticket>(() => loadDraft(userId) ?? newTicket(crypto.randomUUID()));
  const [category, setCategory] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");
  const [priceLineKey, setPriceLineKey] = React.useState<string | null>(null);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [lookup, setLookup] = React.useState<Lookup>({ state: "idle" });
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<(ConfirmedSale & { change: number | null }) | null>(null);
  // The receipt prints from a hidden frame, so the counter stays on this
  // screen, ready for the next customer. A new nonce prints again.
  const [printJob, setPrintJob] = React.useState<PrintJob | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const ticketRef = React.useRef<HTMLElement>(null);

  const totals = ticketTotals(ticket.lines);
  const problem = ticketProblem(ticket, role, maxCounterDiscountPercent);
  const phoneValid = ticket.customerPhone.trim() === "" || normalizePhone(ticket.customerPhone) !== null;
  const canConfirm = !problem && phoneValid && !pending;

  // Phone and tablet: the "Ticket" bar hides while the ticket is on screen.
  const [ticketInView, setTicketInView] = React.useState(false);
  React.useEffect(() => {
    const element = ticketRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setTicketInView(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The ticket survives an accidental refresh (this tab, this account only).
  React.useEffect(() => saveDraft(userId, ticket), [userId, ticket]);

  // Live customer lookup once the number is complete.
  const normalizedPhone = normalizePhone(ticket.customerPhone);
  React.useEffect(() => {
    if (!normalizedPhone) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLookup({ state: "looking" });
      try {
        const result = await lookupCustomerAction(normalizedPhone);
        if (!cancelled) setLookup(result.ok ? { state: "done", match: result.data } : { state: "idle" });
      } catch {
        if (!cancelled) setLookup({ state: "idle" });
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalizedPhone]);
  const match = normalizedPhone && lookup.state === "done" ? lookup.match : null;

  const update = React.useCallback((change: (current: Ticket) => Ticket) => {
    setError(null);
    setTicket(change);
  }, []);

  function addService(service: SaleService) {
    const assigned = catalog.serviceStaff[service.id] ?? [];
    const activeAssigned = assigned.filter((id) => catalog.staff.some((member) => member.id === id));
    const line: Line = {
      key: crypto.randomUUID(),
      serviceId: service.id,
      name: service.name,
      listPrice: service.price,
      unitPrice: service.price,
      quantity: 1,
      // One person does this service: pick them already (one tap saved).
      staffId: activeAssigned.length === 1 ? activeAssigned[0] : null,
      reason: null,
      durationMinutes: service.durationMinutes,
    };
    update((current) => ({ ...current, lines: [...current.lines, line] }));
    setDone(null);
  }

  const visibleServices = catalog.services.filter((service) => {
    if (query.trim()) return service.name.toLowerCase().includes(query.trim().toLowerCase());
    return category === "all" || service.categoryId === category;
  });

  // Blocks a second Confirm (double-click, held Enter) before the screen has
  // re-rendered as pending. The server also returns the first sale for a
  // repeated request id, so a sale is never saved twice.
  const submitting = React.useRef(false);

  async function confirm() {
    if (!canConfirm || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await confirmSaleAction(salePayload(ticket));
      if (!result.ok) {
        // Keep the ticket on screen so nothing typed is lost.
        setError(result.error);
        return;
      }
      const change = ticket.paymentMode === "cash" && ticket.tendered !== null ? ticket.tendered - result.data.total : null;
      setDone({ ...result.data, change });
      setPrintJob(newPrintJob(result.data.saleId));
      clearDraft(userId);
      setTicket(newTicket(crypto.randomUUID()));
      setLookup({ state: "idle" });
      setQuery("");
    } catch (error) {
      setError(
        requestErrorMessage(error, "Could not reach the server. Check the internet connection and press Confirm again. The sale will not be saved twice."),
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  // Keyboard: "/" searches services, Enter confirms when the ticket is ready.
  const confirmRef = React.useRef(confirm);
  React.useEffect(() => {
    confirmRef.current = confirm;
  });
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      const inDialog = Boolean(target?.closest('[role="dialog"]'));
      if (event.key === "/" && !typing && !inDialog) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "Enter" && !typing && !inDialog && !event.repeat) {
        if (target?.tagName === "BUTTON" || target?.tagName === "A") return;
        event.preventDefault();
        void confirmRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const priceLine = ticket.lines.find((line) => line.key === priceLineKey) ?? null;

  return (
    <main className="flex-1 p-3 md:p-6">
      {dayClosed && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-[12px] bg-pos-warning-soft px-4 py-3 text-sm text-pos-warning">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Today is already closed. You can still sell; this sale is marked &quot;after close&quot; and the owner is told.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
        {/* Services */}
        <section aria-label="Services" className="min-w-0 space-y-3">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-pos-text-muted" />
            <Input
              ref={searchRef}
              type="search"
              aria-label="Search services"
              placeholder="Search services (press /)"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && visibleServices[0]) {
                  event.preventDefault();
                  addService(visibleServices[0]);
                  setQuery("");
                }
                if (event.key === "Escape") setQuery("");
              }}
              className={cn(posInputClass, "h-12 bg-pos-surface pl-10")}
            />
          </div>

          {!query.trim() && (
            <div role="tablist" aria-label="Categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible">
              {[{ id: "all", name: "All" }, ...catalog.categories].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={category === item.id}
                  onClick={() => setCategory(item.id)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-[10px] px-4 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-pos-accent",
                    category === item.id ? "bg-pos-text text-pos-surface" : "bg-pos-surface text-pos-text hover:bg-pos-subtle",
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}

          {catalog.services.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-pos-border bg-pos-surface p-8 text-center text-sm text-pos-text-muted">
              No services yet. The owner adds them on the Services page.
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {visibleServices.map((service) => (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() => addService(service)}
                    className="flex h-full min-h-24 w-full flex-col justify-between rounded-[16px] border border-pos-border bg-pos-surface p-3 text-left transition-colors duration-150 hover:border-pos-accent hover:bg-pos-accent-soft focus-visible:outline-2 focus-visible:outline-pos-accent active:translate-y-px"
                  >
                    <span>
                      <span className="block text-sm leading-tight font-medium">{service.name}</span>
                      <span className="text-xs text-pos-text-muted">{service.durationMinutes} min</span>
                    </span>
                    <span className="display-type mt-2 text-2xl whitespace-nowrap tabular-nums">{formatGhs(service.price)}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  className="flex h-full min-h-24 w-full flex-col items-start justify-between rounded-[16px] border border-dashed border-pos-border p-3 text-left text-pos-text-muted hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
                >
                  <PackagePlus className="h-5 w-5" />
                  <span className="text-sm font-medium">Custom item</span>
                </button>
              </li>
              {visibleServices.length === 0 && (
                <li className="col-span-full py-4 text-sm text-pos-text-muted">No service matches &quot;{query}&quot;.</li>
              )}
            </ul>
          )}
        </section>

        {/* Ticket */}
        <section
          ref={ticketRef}
          aria-label="Ticket"
          className="scroll-mt-32 rounded-[16px] border border-pos-border bg-pos-surface p-4 md:scroll-mt-24 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
        >
          {done && (
            <div role="status" className="mb-4 rounded-[12px] bg-pos-up-soft p-4 text-pos-up">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-5 w-5" /> Sale {done.receiptNo} saved{done.existing ? " (already saved before)" : ""}
              </p>
              <p className="mt-1 text-sm text-pos-text">
                {formatGhs(done.total)}
                {done.change !== null && done.change > 0 && (
                  <>
                    {" · "}
                    <strong>Change {formatGhs(done.change)}</strong>
                  </>
                )}
                {done.afterClose && " · marked after close"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPrintJob(newPrintJob(done.saleId))}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] bg-pos-surface px-3 text-sm font-medium text-pos-text hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
                >
                  <Printer className="h-4 w-4" /> Reprint
                </button>
                <Link
                  href={`/pos/receipts/${done.saleId}`}
                  className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-sm font-medium text-pos-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-pos-accent"
                >
                  View receipt
                </Link>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="customer-phone" className="text-sm font-medium">
              Customer phone (optional)
            </label>
            <Input
              id="customer-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="024 123 4567"
              value={ticket.customerPhone}
              onChange={(event) => update((current) => ({ ...current, customerPhone: event.target.value }))}
              className={cn(posInputClass, !phoneValid && ticket.customerPhone.trim().length >= 10 && "border-pos-down")}
            />
            {normalizedPhone && lookup.state === "looking" && <p className="text-xs text-pos-text-muted">Looking up…</p>}
            {match?.found && (
              <p className="flex items-center gap-2 rounded-[10px] bg-pos-accent-soft px-3 py-2 text-sm">
                <UserRound className="h-4 w-4 text-pos-accent" />
                <span>
                  <strong>{match.name ?? "Returning customer"}</strong> · {match.visits} {match.visits === 1 ? "visit" : "visits"}
                  {match.lastVisit && `, last ${formatAccraDayTime(match.lastVisit)}`}
                </span>
              </p>
            )}
            {match?.blocked && (
              <p className="rounded-[10px] bg-pos-warning-soft px-3 py-2 text-sm text-pos-warning">
                This number is blocked for online booking{match.blockedReason ? ` (${match.blockedReason})` : ""}. They can still pay at the counter.
              </p>
            )}
            {normalizedPhone && match && !match.found && (
              <Input
                aria-label="New customer's name (optional)"
                placeholder="New customer: name (optional)"
                value={ticket.customerName}
                onChange={(event) => update((current) => ({ ...current, customerName: event.target.value }))}
                className={posInputClass}
              />
            )}
          </div>

          <div className="mt-4">
            {ticket.lines.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-pos-border p-6 text-center text-sm text-pos-text-muted">
                Tap a service to add it.
              </p>
            ) : (
              <ul className="space-y-2">
                {ticket.lines.map((line) => (
                  <TicketLine
                    key={line.key}
                    line={line}
                    catalog={catalog}
                    onChange={(next) => update((current) => ({ ...current, lines: current.lines.map((l) => (l.key === next.key ? next : l)) }))}
                    onRemove={() => update((current) => ({ ...current, lines: current.lines.filter((l) => l.key !== line.key) }))}
                    onEditPrice={() => setPriceLineKey(line.key)}
                  />
                ))}
              </ul>
            )}
          </div>

          <dl className="mt-4 space-y-1 border-t border-pos-border pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-pos-text-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatGhs(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-pos-text-muted">Discount</dt>
                <dd className="tabular-nums">-{formatGhs(totals.discount)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-1">
              <dt className="display-type text-2xl">Total</dt>
              <dd className="display-type text-5xl tabular-nums">{formatGhs(totals.total)}</dd>
            </div>
          </dl>

          <div className="mt-3">
            <PaymentPanel key={ticket.requestId} ticket={ticket} total={totals.total} onChange={(next) => update(() => next)} />
          </div>

          <div className="mt-4 space-y-2">
            {(error || (problem && ticket.lines.length > 0)) && (
              <p role="alert" className={cn("rounded-[10px] px-3 py-2.5 text-sm", error ? "bg-pos-down-soft text-pos-down" : "bg-pos-subtle text-pos-text")}>
                {error ?? problem}
              </p>
            )}
            {!phoneValid && ticket.customerPhone.trim().length >= 10 && (
              <p className="text-sm text-pos-down">The phone number is not valid. Fix it or leave it empty.</p>
            )}
            <PosButton size="lg" fullWidth disabled={!canConfirm} onClick={confirm} className="min-h-14 text-base tracking-wide">
              {pending ? "Saving…" : `CONFIRM & PRINT · ${formatGhs(totals.total)}`}
            </PosButton>
            {ticket.lines.length > 0 && (
              <button
                type="button"
                onClick={() => update(() => newTicket(crypto.randomUUID()))}
                className="min-h-11 w-full rounded-[10px] text-sm text-pos-text-muted hover:bg-pos-subtle"
              >
                Clear ticket
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Phone and tablet: the total and a jump to the ticket stay in reach. */}
      {ticket.lines.length > 0 && !ticketInView && (
        <div className="sticky bottom-20 z-10 mt-3 flex items-center justify-between gap-3 rounded-[16px] border border-pos-border bg-pos-surface p-3 shadow-sm md:bottom-4 lg:hidden">
          <span className="text-sm">
            {ticket.lines.length} {ticket.lines.length === 1 ? "item" : "items"} ·{" "}
            <span className="display-type text-2xl tabular-nums">{formatGhs(totals.total)}</span>
          </span>
          <PosButton onClick={() => ticketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>Ticket</PosButton>
        </div>
      )}

      <ReceiptPrintFrame job={printJob} />

      <PriceDialog
        line={priceLine}
        role={role}
        maxCounterDiscountPercent={maxCounterDiscountPercent}
        onCancel={() => setPriceLineKey(null)}
        onApply={(unitPrice, reason) => {
          update((current) => ({
            ...current,
            lines: current.lines.map((line) => (line.key === priceLineKey ? { ...line, unitPrice, reason } : line)),
          }));
          setPriceLineKey(null);
        }}
      />
      <CustomItemDialog
        open={customOpen}
        role={role}
        onCancel={() => setCustomOpen(false)}
        onAdd={(item) => {
          update((current) => ({
            ...current,
            lines: [
              ...current.lines,
              {
                key: crypto.randomUUID(),
                serviceId: null,
                name: item.name,
                listPrice: item.price,
                unitPrice: item.price,
                quantity: 1,
                staffId: null,
                reason: item.reason,
                durationMinutes: 0,
              },
            ],
          }));
          setCustomOpen(false);
        }}
      />
    </main>
  );
}
