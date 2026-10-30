import Link from "next/link";

import { ChangeStaffButton, type ChangeStaffOption } from "@/components/pos/sales/change-staff";
import { SaleBadges } from "@/components/pos/sales/sale-badges";
import { formatGhs } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { CHANNEL_LABEL, METHOD_LABEL, type SaleRow } from "@/lib/sales/history";
import { formatAccraDayTime, formatAccraTime } from "@/lib/time";
import { cn } from "@/lib/utils";

interface SalesTableProps {
  rows: SaleRow[];
  /** Owner: amounts, channel, and who recorded each sale. */
  owner: boolean;
  /** Show the date with the time (a range longer than one day). */
  showDate: boolean;
  /** Today's business date: today's paid sales get a quick "Change staff". */
  today: string;
  staff: ChangeStaffOption[];
}

function services(row: SaleRow): string {
  return row.items.map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join(", ");
}

function staffNames(row: SaleRow): string {
  return [...new Set(row.items.map((item) => item.staff_name).filter(Boolean))].join(", ") || "—";
}

function customer(row: SaleRow): string {
  return row.customer_name ?? (row.customer_phone ? formatPhone(row.customer_phone) : "Walk-in");
}

function badges(row: SaleRow) {
  return (
    <SaleBadges
      status={row.status}
      voidRequested={row.void_requested}
      isBackdated={row.is_backdated}
      afterClose={row.after_close}
      changed={row.changed}
    />
  );
}

// Sales list: a table on a desktop, cards on a tablet or phone. Voided sales
// stay in the list, marked, with their amount struck through. Today's paid
// sales have a quick "Change staff" (spec 11), because a wrong staff member is
// the most common fix at the counter.
export function SalesTable({ rows, owner, showDate, today, staff }: SalesTableProps) {
  const when = (row: SaleRow) => (showDate ? formatAccraDayTime(row.paid_at) : formatAccraTime(row.paid_at));
  const quickChange = (row: SaleRow, look: "icon" | "compact") =>
    row.status === "paid" && row.business_date === today && staff.length > 0 ? (
      <ChangeStaffButton
        look={look}
        receiptNo={row.receipt_no}
        staff={staff}
        lines={row.items.map((item) => ({ id: item.id, name: item.name, staffId: item.staff_id, staffName: item.staff_name }))}
      />
    ) : null;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-[16px] border border-pos-border bg-pos-surface lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pos-border text-left text-xs tracking-wide whitespace-nowrap text-pos-text-muted uppercase">
              <th className="px-4 py-3 font-medium">Receipt</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Services</th>
              <th className="px-4 py-3 font-medium">Staff</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              {owner && <th className="px-4 py-3 font-medium">Recorded by</th>}
              {owner && <th className="px-4 py-3 text-right font-medium">Total</th>}
              <th className="py-3 pr-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={cn("border-b border-pos-border last:border-0 hover:bg-pos-subtle/60", row.status === "voided" && "text-pos-text-muted")}>
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/pos/sales/${row.id}`}
                    className="font-medium whitespace-nowrap text-pos-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-pos-accent"
                  >
                    {row.receipt_no}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">{badges(row)}</div>
                </td>
                <td className="px-4 py-3 align-top whitespace-nowrap tabular-nums">{when(row)}</td>
                <td className="px-4 py-3 align-top">{services(row)}</td>
                <td className="px-4 py-3 align-top">{staffNames(row)}</td>
                <td className="px-4 py-3 align-top">{customer(row)}</td>
                <td className="px-4 py-3 align-top whitespace-nowrap">
                  {row.methods.map((method) => METHOD_LABEL[method]).join(" + ")}
                  {owner && row.channel !== "walk_in" && <div className="text-xs text-pos-text-muted">{CHANNEL_LABEL[row.channel]}</div>}
                </td>
                {owner && <td className="px-4 py-3 align-top">{row.recorded_by ?? "—"}</td>}
                {owner && (
                  <td className={cn("px-4 py-3 text-right align-top whitespace-nowrap tabular-nums", row.status === "voided" && "line-through")}>
                    {row.total !== null ? formatGhs(row.total) : ""}
                  </td>
                )}
                <td className="py-1.5 pr-2 text-right align-top">{quickChange(row, "icon")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn(
              // The whole card opens the sale (the link's ::after covers it);
              // the quick action sits above that layer.
              "relative rounded-[16px] border border-pos-border bg-pos-surface p-4 focus-within:outline-2 focus-within:outline-pos-accent has-[a:active]:bg-pos-subtle",
              row.status === "voided" && "text-pos-text-muted",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/pos/sales/${row.id}`} className="font-medium text-pos-accent outline-none after:absolute after:inset-0 after:rounded-[16px]">
                  {row.receipt_no}
                </Link>
                <p className="text-xs text-pos-text-muted tabular-nums">{when(row)}</p>
              </div>
              {owner && row.total !== null && (
                <p className={cn("display-type text-2xl tabular-nums", row.status === "voided" && "line-through")}>{formatGhs(row.total)}</p>
              )}
            </div>
            <p className="mt-2 text-sm">{services(row)}</p>
            <p className="text-sm text-pos-text-muted">
              {staffNames(row)} · {row.methods.map((method) => METHOD_LABEL[method]).join(" + ")} · {customer(row)}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
              <div className="flex flex-wrap gap-1 empty:hidden">{badges(row)}</div>
              {quickChange(row, "compact")}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
