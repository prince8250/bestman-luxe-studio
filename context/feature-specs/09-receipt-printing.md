# 09 · Receipt Printing

## Goal

Print a clean receipt for every sale, which the customer takes to the staff member.

## Depends On

- `08-new-sale.md`

## Who Can Use This

- Owner and counter.

## Scope (Build Only This)

- `/pos/receipts/[saleId]`, built only from stored data, laid out as in `ui-context.md` "POS Receipt".
- Print stylesheet for 80mm thermal paper with an A4 fallback; black and white.
- Opens automatically after a sale and calls the print dialog; prints the number of copies set in Settings (default 2). The second copy is marked **STAFF COPY** for the staff member to keep.
- Shows "Served at the counter by <display name>".
- Reprint from sale detail, marked "REPRINT".
- Owner-guide notes (saved in `docs/owner-guide-draft.md` for spec 38): installing the thermal printer driver, setting it as default, the paper size, a Chrome shortcut with kiosk printing so receipts print without the dialog, and the shop rule **no receipt, no service**: staff keep their STAFF COPY slips, and at closing each staff member's slips should match their count in the day report.

## Out Of Scope

- Emailing or SMS-ing receipts. Direct printer hardware integrations.

## Notes And Rules

- Confirm open question about the printer model with the developer first.
- Test in print preview at 80mm and A4.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Receipt data comes from the database, never client state.
- [ ] Print preview is correct at 80mm and A4.
- [ ] Reprints are identical apart from the REPRINT mark.
- [ ] Only signed-in POS users can open receipts.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
