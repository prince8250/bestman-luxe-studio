# 11 · Reassign Staff and Edit a Paid Sale

## Goal

Fix the record when reality differs from what was entered: Kofi was busy, Kwame did the haircut. Staff reports must credit the person who really did the work.

## Depends On

- `10-sales-history-and-void.md`

## Who Can Use This

- **Change staff**: counter (current business day only) and owner (any time).
- **Edit line** (service or price after payment): owner only.

## Scope (Build Only This)

- On sale detail, each line has **Change staff** (counter: only on sales from the current business day; owner: any sale): pick the new staff member, give a reason (quick picks such as "Staff was busy", "Customer changed preference", "Entered wrong staff", plus free text). Calls `reassign_sale_item_staff`.
- **Edit line (owner only)**: change the service or price, with a reason. If the total changes, the owner must record the money difference in the same step (extra payment collected, or cash refunded), so payments still equal the total. Calls `edit_sale_item`.
- A "Changed" badge on lines and sales that were edited, linking to their history.
- Also allow reassignment straight from the sales list for today's sales (a quick action), because this happens often at the counter.

## Out Of Scope

- The global change log page (spec 16).

## Notes And Rules

- Every change is logged with before, after, reason, and time, in the same transaction as the change.
- Reassignment never changes the sale total, receipt number, or payments.
- Explain to the developer why this is an audit log rather than simply overwriting the row (who did what is money when staff are paid per job).

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Reassigning a line from Kofi to Kwame moves that job and its revenue to Kwame in every report.
- [ ] A counter user can reassign today's lines but the server refuses older ones and any line edit.
- [ ] The change history shows from, to, reason, and time.
- [ ] An edit that changes the total cannot be saved unless the payment difference is recorded.
- [ ] Voided sales cannot be edited.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
