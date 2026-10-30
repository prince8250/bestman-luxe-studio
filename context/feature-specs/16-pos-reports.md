# 16 · Reports: Day, Week, Month, Staff, Changes

## Goal

Printable and downloadable summaries for the day, the week, the month, each staff member, and every change made.

## Depends On

- `15-pos-dashboard.md`

## Who Can Use This

- **Owner only.** Counter users do not see it in the navigation, and the server refuses its pages and actions for them.

## Scope (Build Only This)

- `/pos/reports/daily`, `/weekly`, `/monthly` (and a custom range): totals, payment methods, by category, by service, by staff, by channel, by counter user, voids, void requests, backdated and after-close sales, the cash-up result (expected, counted, difference) when the day is closed, list of sales. Previous/next arrows to move between periods.
- **End-of-day report** (the daily report): the same layout as the HTML file the PC backup saves, with a Print button (80mm and A4).
- `/pos/reports/staff`: choose a staff member and a range: services done, revenue, by service, by day, list of their lines (with any reassignments marked). A leaderboard of all staff for the range.
- `/pos/reports/changes`: the change log (`audit_log`) with who did each change, filters by type, date, and account: reassignments, edits, voids, backdated sales, price changes, appointment cancellations.
- **Download CSV** on every report.

## Out Of Scope

- Commission or payroll figures (in `later/`).

## Notes And Rules

- The daily report HTML and CSV are produced by shared functions in `lib/reports` that spec 20's backup endpoint will reuse. Build them so they render without the POS layout.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Day, week, and month totals match the dashboard for the same range.
- [ ] A staff report reflects reassignments.
- [ ] CSV files open correctly in Excel (UTF-8 with BOM, ISO dates, amounts in GHS with two decimals).
- [ ] The end-of-day report prints cleanly at 80mm and A4.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
