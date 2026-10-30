# 17 · Close Day (Cash-up)

## Goal

End every day with a blind cash count, so the owner knows the money in the drawer matches the system, and the day's report lands on the PC.

## Depends On

- `16-pos-reports.md`
- `12-record-past-sale.md`

## Who Can Use This

- Counter and owner can close a day. Only the owner sees past closes and can reopen a day.

## Scope (Build Only This)

- `/pos/close-day` as in `ui-context.md` "Close Day Screen":
  - Step 1: business date (today by default; an earlier unclosed day can be chosen), opening float (prefilled from settings; changing it needs a reason), **counted cash** (one big field), optional MoMo total as seen on the MoMo phone or statement, note. **The expected cash is not shown or sent to the browser before submitting.**
  - Step 2 (after `close_day`): counted, expected, difference (green for zero, red otherwise), sales count, totals by payment method, services per staff (to compare with the staff's STAFF COPY slips), and MoMo reported vs MoMo in the system.
- Print a **close slip** (80mm) with the step 2 figures.
- **Download the day report** (CSV and HTML from spec 16) through the browser automatically after closing, as an extra copy on the PC. The download action (permission `day.closeReport`, both roles) checks on the server that the date has an active close and reads `report_day_close_export` (spec 14). It is the only report a counter user can get, and only after the close.
- Create `owner_alerts` rows: `day_summary` always, and `cash_difference` when the difference is beyond the tolerance (sent in spec 19).
- Owner: see past closes, and **Reopen day** with a reason (logged); the day can then be closed again, and both closes stay in history.
- Sidebar day status card for the counter ("Day open since 08:12" from the first sign-in or sale, or "Day closed at 20:41").

## Out Of Scope

- Sending SMS (spec 19). Cash drawer hardware.

## Notes And Rules

- `close_day` computes expected cash on the server only: opening float + cash payment rows for that business date (refund rows are negative).
- Explain to the developer why the count is blind (if the expected number is visible first, people count to the number).
- Sales after close are allowed and flagged `after_close` (spec 08); the day report shows them separately.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] The expected amount never reaches the browser before the counted amount is saved (check the network responses).
- [ ] Closing stores expected, counted, and difference correctly for a seeded day with cash, MoMo, card, and a refund.
- [ ] A day cannot be closed twice unless the owner reopens it; reopen requires a reason and is logged.
- [ ] The close slip prints at 80mm and the day report downloads after closing.
- [ ] A counter user can close the day but cannot reopen it.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
