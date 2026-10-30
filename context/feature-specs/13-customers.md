# 13 · Customers

## Goal

See and search customers and their history. Customers are recognized by phone number.

## Depends On

- `10-sales-history-and-void.md`

## Who Can Use This

- Owner and counter. Total spent, and blocking or unblocking a number: owner only.

## Scope (Build Only This)

- `/pos/customers`: search by name or phone (any common Ghana format: `024...`, `+233 24...`, `23324...`).
- Customer detail: name, phone, first visit, last visit, number of visits (paid sales), total spent, favorite service, usual staff, list of sales and appointments, notes.
- Edit name and notes (both roles). The phone number is the identity and is not editable here.
- Total spent is shown to the owner only.
- Block or unblock a number for online booking, with a reason (owner only).
- Wire Find: a phone number opens the customer.

## Out Of Scope

- Marketing messages or exports.

## Notes And Rules

- Visits and totals count only paid, non-voided sales.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Searching any common phone format finds the right customer.
- [ ] Visit counts and totals match the sales records.
- [ ] Blocking a number is logged and shown on the customer.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
