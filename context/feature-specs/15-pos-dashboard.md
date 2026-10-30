# 15 · Dashboard

## Goal

The owner's at-a-glance view of the business, laid out like `design-reference/pos/01-dashboard-reference.png`.

## Depends On

- `14-report-engine.md`

## Who Can Use This

- **Owner only.** Counter users do not see it in the navigation, and the server refuses its pages and actions for them.

## Scope (Build Only This)

- `/pos` (Dashboard), following the mapping table in `ui-context.md`:
  - Header: "Dashboard" in Bebas Neue, date range picker (Today default, This week, This month, Last 30 days, Custom), **Export** (CSV and print of the period summary).
  - Four `KpiTile`s: Revenue, Services done, Customers served, Online bookings, each with change vs the previous period.
  - Revenue chart: current period line with soft area fill, previous period dashed; under it the Walk-in / Online booking / Phone booking strip.
  - Busiest days bar chart (top day in accent blue, others subtle gray).
  - Repeat customers gauge.
  - Top staff table and Top services table.
  - Payment methods card.
  - Today's appointments card (placeholder list until spec 36 wires it).
- Charts with Recharts through the shadcn chart component (ask first; it is a new dependency).
- Responsive: the grid collapses to one column on a phone so the owner can check it from home.

## Out Of Scope

- Detailed reports pages (spec 16).

## Notes And Rules

- Every figure comes from the spec 14 functions.
- Show money as `GHS 1,250.00` through the shared money helper.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Every KPI matches the report functions for the selected range.
- [ ] Changing the range updates every card.
- [ ] Readable on a phone at 375px.
- [ ] Loading, empty (a brand-new studio with no sales), and error states exist.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
