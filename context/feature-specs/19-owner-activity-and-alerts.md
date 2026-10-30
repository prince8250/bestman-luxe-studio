# 19 · Owner Activity Feed and SMS Alerts

## Goal

Let the owner see what is happening at the counter from anywhere: a live activity feed, void approvals on the phone, and SMS for anything unusual plus a daily summary.

## Depends On

- `17-close-day.md`
- `18-sms-adapter.md`
- `11-edit-sale-and-reassign-staff.md`

## Who Can Use This

- **Owner only.** Counter users do not see it in the navigation, and the server refuses its pages and actions for them.

## Scope (Build Only This)

- `/pos/activity` (owner only), as in `ui-context.md` "Activity Feed": sales, price overrides, custom items, reassignments, void requests and decisions, voids, backdated and after-close sales, appointment cancellations and no-shows, day closes and reopens, counter sign-ins, failed backups. Built from `audit_log`, `sales`, `void_requests`, `day_closes`, `sign_in_events`, and `backup_runs`. Filters by type and counter account. Live updates (Supabase Realtime or 30-second polling; pick the simpler and explain). Unread count in the sidebar.
- Pending void requests pinned at the top with Approve and Reject (reusing spec 10's actions). Works well on a phone.
- **SMS alerts** to the owner's phone through `lib/sms`, for each `owner_alerts` kind switched on in Settings: `void_requested`, `cash_difference`, `backdated_sale`, `large_override`, `day_summary`, `day_not_closed`, `backup_stale`. Templates in `lib/sms/templates.ts`, short, with the receipt number and amounts, no customer phone numbers.
- **Day summary SMS** when the day is closed: revenue, number of services, cash / MoMo / card, cash difference, voids, void requests pending.
- **Owner job** `app/api/cron/owner-daily` (secured by `CRON_SECRET`, scheduled for 23:30 Accra with Vercel Cron): if the day had sales but was not closed, send `day_not_closed` with the summary; if the day had sales but no successful PC backup, send `backup_stale`.
- Throttling: at most one SMS per alert kind per sale, and a daily cap (default 20) after which alerts stay in the feed only. Record `sms_status` on each `owner_alerts` row. An SMS failure never blocks the action that caused it.

## Out Of Scope

- Push notifications or WhatsApp. Customer-facing SMS (spec 35).

## Notes And Rules

- Read Vercel's current cron documentation (schedule format, plan limits) before configuring.
- In development use `SMS_MODE=console` so alerts print instead of sending.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] Every listed event appears in the feed within a minute, with the account that did it.
- [ ] The owner can approve a void request from a phone at 375px.
- [ ] Each enabled alert sends exactly once; disabled alerts do not send; the daily cap holds.
- [ ] The 23:30 job sends `day_not_closed` and `backup_stale` only when their conditions are true (tested by calling the endpoint with seeded data).
- [ ] A counter user cannot open the feed or call its actions.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
