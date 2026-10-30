import type { ReactNode } from "react";
import Image from "next/image";

import { formatGhs } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { PAYMENT_LABEL, SOCIAL_LABEL, socialHandle, type ReceiptCopy as Copy, type ReceiptData } from "@/lib/receipt/receipt";
import { formatAccraDateTime } from "@/lib/time";

interface ReceiptCopyProps {
  receipt: ReceiptData;
  copy: Copy;
  reprint: boolean;
  bookUrl: string;
}

// One printed copy, laid out as in ui-context.md "POS Receipt": black and
// white only, readable on an 80mm thermal roll. Every copy of one print is
// identical apart from the STAFF COPY mark, and a reprint apart from REPRINT.
export function ReceiptCopy({ receipt, copy, reprint, bookUrl }: ReceiptCopyProps) {
  const { studio } = receipt;
  const socials = Object.entries(studio.social_links)
    .map(([network, url]) => ({ network, handle: url ? socialHandle(url) : null }))
    .filter((social): social is { network: string; handle: string } => social.handle !== null);
  const marks = [
    receipt.status === "voided" ? "VOIDED" : null,
    reprint ? "REPRINT" : null,
    copy.kind === "staff" ? `STAFF COPY${copy.staffName ? ` · ${copy.staffName}` : ""}` : null,
  ].filter(Boolean);

  return (
    <article className="receipt-copy bg-white text-[12px] leading-snug text-black" aria-label={copy.kind === "staff" ? "Staff copy" : "Customer copy"}>
      <header className="text-center">
        <Image
          src="/brand/logo-receipt.png"
          alt=""
          width={384}
          height={384}
          loading="eager"
          unoptimized
          className="mx-auto h-[22mm] w-[22mm] grayscale"
        />
        <p className="mt-1 text-[15px] font-bold tracking-wide uppercase">{studio.name}</p>
        {studio.address && <p>{studio.address}</p>}
        {studio.phone && <p>Tel {formatPhone(studio.phone)}</p>}
        {studio.header && <p className="mt-1 whitespace-pre-line">{studio.header}</p>}
      </header>

      {marks.length > 0 && (
        <div className="mt-2 space-y-1">
          {marks.map((mark) => (
            <p key={mark} className="border-2 border-black py-0.5 text-center text-[14px] font-bold tracking-widest">
              {mark}
            </p>
          ))}
        </div>
      )}

      <Rule />
      <dl className="space-y-0.5">
        <Row label="Receipt" value={<span className="font-bold">{receipt.receipt_no}</span>} />
        <Row label="Date" value={formatAccraDateTime(receipt.paid_at)} />
        {receipt.is_backdated && <Row label="Recorded" value={formatAccraDateTime(receipt.recorded_at)} />}
        {receipt.customer_name && <Row label="Customer" value={receipt.customer_name} />}
      </dl>

      <Rule />
      <ul className="space-y-1.5">
        {receipt.lines.map((line) => (
          <li key={line.line_no}>
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{line.name}</span>
              <span className="shrink-0 tabular-nums">{formatGhs(line.line_total)}</span>
            </div>
            {line.quantity > 1 && (
              <p className="pl-2 tabular-nums">
                {line.quantity} × {formatGhs(line.unit_price)}
              </p>
            )}
            {line.unit_price < line.list_price && <p className="pl-2 tabular-nums">Usual price {formatGhs(line.list_price)}</p>}
            {line.staff_name && <p className="pl-2">Served by {line.staff_name}</p>}
          </li>
        ))}
      </ul>

      <Rule />
      <dl className="space-y-0.5">
        {receipt.discount_total > 0 && (
          <>
            <Row label="Subtotal" value={formatGhs(receipt.subtotal)} />
            <Row label="Discount" value={`-${formatGhs(receipt.discount_total)}`} />
          </>
        )}
        <div className="flex items-baseline justify-between gap-2 pt-0.5 text-[17px] font-bold">
          <dt>TOTAL</dt>
          <dd className="tabular-nums">{formatGhs(receipt.total)}</dd>
        </div>
      </dl>

      <Rule />
      <ul className="space-y-1">
        {receipt.payments.map((payment, index) => (
          <li key={index}>
            <div className="flex justify-between gap-2">
              <span>
                {payment.kind === "adjustment" ? (payment.amount < 0 ? "Refund" : "Extra paid") : "Paid"} by {PAYMENT_LABEL[payment.method]}
              </span>
              <span className="shrink-0 tabular-nums">{formatGhs(Math.abs(payment.amount))}</span>
            </div>
            {payment.tendered !== null && (
              <p className="pl-2 tabular-nums">
                Cash given {formatGhs(payment.tendered)} · Change {formatGhs(payment.tendered - payment.amount)}
              </p>
            )}
            {payment.reference && <p className="pl-2">Ref {payment.reference}</p>}
          </li>
        ))}
      </ul>

      <Rule />
      <footer className="space-y-1 text-center">
        {receipt.counter_name && <p>Served at the counter by {receipt.counter_name}</p>}
        {studio.footer && <p className="font-semibold whitespace-pre-line">{studio.footer}</p>}
        {socials.map((social) => (
          <p key={social.network}>
            {SOCIAL_LABEL[social.network] ?? social.network} {social.handle}
          </p>
        ))}
        {studio.whatsapp && <p>WhatsApp {formatPhone(studio.whatsapp)}</p>}
        <p>Book online at {bookUrl}</p>
      </footer>
    </article>
  );
}

function Rule() {
  return <hr className="my-2 border-0 border-t border-dashed border-black" />;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
