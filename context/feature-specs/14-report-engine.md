# 14 · Report Engine (SQL)

## Goal

One set of SQL report functions that every number in the POS comes from, so the dashboard, reports, CSV files, and the PC day report always agree.

## Depends On

- `11-edit-sale-and-reassign-staff.md`
- `12-record-past-sale.md`

## Who Can Use This

- **Owner only.** Counter users do not see it in the navigation, and the server refuses its pages and actions for them.

## Scope (Build Only This)

- Postgres functions (migration) that take a start and end date in Accra time and return:
  - `report_summary`: revenue, number of sales, services done (sale items, excluding custom items), customers served (distinct identified customers + walk-ins without phone), average sale, and the same figures for the previous equal-length period.
  - `report_by_payment_method`, `report_by_service`, `report_by_category`, `report_by_channel` (walk-in, online booking, phone booking).
  - `report_by_staff`: per staff member: services done, revenue, top service, average per service.
  - `report_by_day` (for charts) and `report_by_weekday` (busiest days).
  - `report_repeat_customers`: identified customers in the period who also had a paid sale before the period, divided by identified customers in the period.
  - `report_voids`, `report_backdated`, and `report_after_close` for the period.
  - `report_void_requests`: every void request created in the period with sale id and receipt number, status (`pending`, `approved`, `rejected`, `cancelled`), requested by and when, reason, decided (or cancelled) by and when, and decision note. Used by the daily report and the counter-user section in spec 16.
  - `report_day_close_export(business_date)`: the day report used for the Close day browser download (spec 17). Callable by the owner for any date, and by a counter user **only** for a date that has an active close; it raises for any other date, so nothing is visible before the blind count.
  - `report_by_counter_user`: sales count, revenue, overrides, and void requests per counter account.
  - `report_day_close`: the `day_closes` row(s) for the period (expected, counted, difference).
  - `report_changes`: `audit_log` rows in the period.
- `lib/reports` with typed TypeScript wrappers and a shared date-range helper (Today, This week Monday-start, This month, Last 30 days, Custom), all in `Africa/Accra`.

Every report function above is owner-only, except `report_day_close_export` as described.

## Out Of Scope

- Any UI (specs 15 and 16).

## Notes And Rules

- Aggregate in SQL. Never load all sales into the app to add them up.
- Tests with seeded data: revenue excludes voided sales; a reassigned line counts for the new staff only; a backdated sale lands on its `paid_at` day; day, week, and month boundaries are correct; previous-period comparisons are right; repeat-customer rate is right on a hand-checked example.

## Acceptance Criteria

- [ ] All report tests pass.
- [ ] Every report function is owner-only (a counter user calling one gets an error).
- [ ] Results for a sample week match a hand calculation documented in the test.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
