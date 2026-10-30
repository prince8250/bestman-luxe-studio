# 10 · Sales History, Sale Detail, Voids, and Void Requests

## Goal

Find any sale, see exactly what happened, reprint it, and remove a wrong sale safely: the owner voids, the counter can only ask.

## Depends On

- `09-receipt-printing.md`

## Who Can Use This

- **Owner**: all sales, totals, change history, void directly, decide void requests.
- **Counter**: today's sales only, no totals, reprint, request a void.

## Scope (Build Only This)

- `/pos/sales`: owner sees all sales with date range, staff, payment method, channel, status, and counter-user filters, search by receipt number or phone, and totals for the filtered range. Counter sees **today's** sales only, with no totals (this is the "Sales (today)" item).
- Sale detail `/pos/sales/[id]`: receipt number, paid and recorded times, backdated and after-close flags, who recorded it, customer, lines (service, staff, price, override reasons), payments, channel, linked appointment, and (owner only) the change history from `audit_log`.
- Actions: Reprint (both roles).
- **Counter: Request void** (reason required) → `request_void`. The sale shows an amber "Void requested" badge. An `owner_alerts` row is created (sent in spec 19). A counter user can cancel their own pending request.
- **Owner: Void** directly (confirm dialog, reason required) → `void_sale`; and a **Void requests** list (also reachable from the sale) with Approve and Reject (note required on reject) → `decide_void_request`.
- Wire the top-bar Find box: a receipt number opens the sale directly (counter: only if it is today's sale; otherwise a plain "Ask the owner" message).

## Out Of Scope

- Editing lines and reassigning staff (spec 11). The activity feed (spec 19).

## Notes And Rules

- Voided sales stay visible, clearly marked, and never count anywhere.
- Approving a request voids the sale and closes the request in one transaction.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Typing a receipt number in Find opens that sale in one step.
- [ ] A counter user cannot void a sale by any route; they can only request.
- [ ] Approving a request voids the sale with the request's reason and the owner as `voided_by`; rejecting keeps the sale and records the note.
- [ ] A voided sale cannot be voided again, edited, or have a new request.
- [ ] Owner filtered totals match the rows shown; the counter sees no totals.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
