# 12 · Record a Past Sale (Outage Fallback)

## Goal

When the internet or power is down, the studio writes sales on paper. This lets the counter or the owner enter them later with the real date and time.

## Depends On

- `08-new-sale.md`

## Who Can Use This

- Owner (up to 14 days back) and counter (up to the Settings limit, default 3 days back).

## Scope (Build Only This)

- A "Record a past sale" option on the New sale screen that adds a date and time field (default now; never in the future; counter up to `counter_backdate_days` back, owner up to 14).
- Saved through `create_sale` with `paid_at` = the chosen time, `recorded_at` = now, `is_backdated = true`, an `audit_log` row, and an `owner_alerts` row.
- Backdated sales show a clear badge in history and in day reports.
- A short printable **paper sales sheet** (`/pos/paper-sheet`) the studio can print in advance: columns for time, customer phone, service, staff, amount, payment method.

## Out Of Scope

- True offline mode (in `later/`).

## Notes And Rules

- Reports group by `paid_at`, so a backdated sale lands on the day it really happened.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] A sale backdated to yesterday appears in yesterday's report and is flagged.
- [ ] Future dates, and dates beyond each role's limit, are rejected on the server.
- [ ] The paper sheet prints cleanly on A4.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
