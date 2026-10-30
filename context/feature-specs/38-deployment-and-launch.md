# 38 · Deployment, Restore Drill, and Handover

## Goal

Go live safely, with backups proven, and hand the studio a plain-language guide.

## Depends On

- `37-polish-performance-seo.md`
- `21-pc-daily-backup.md`
- `22-weekly-cloud-backup.md`

## Scope (Build Only This)

- Production Supabase project on the **Pro plan** (daily backups, no pausing); apply migrations; buckets; public sign-ups disabled; **no sample seed data**; real studio settings; the owner account, then the counter account(s) created by the owner in Settings.
- Vercel **Pro** (Hobby is non-commercial only), environment variables, custom domain if the client has one; optionally serve the POS at `pos.<domain>`.
- Production SMS sender ID and balance; the owner alert phone; the owner job scheduled (Vercel Cron) with `CRON_SECRET`; production Turnstile keys; production backup tokens; GitHub secrets for the weekly workflow.
- Install the PC backup on the studio PC (spec 21 README) and check it ran during the first day and the receipt printer with the kiosk-printing shortcut.
- **Restore drill (blocks launch)**: restore one weekly dump and one daily JSON into a test project; compare row counts and one day's revenue with its saved day report; record the result in the tracker.
- End-to-end production test (as the counter user unless noted): walk-in sale with two staff and split payment, both receipt copies print, reassign a line, request a void and approve it as the owner from a phone, a discount above the limit is refused, close the day with a blind count and see the owner SMS, website booking from a phone, SMS received, Start sale from the appointment, dashboard and reports update, PC backup runs that night.
- `docs/owner-guide.md` in plain language, with a short **counter guide** section: signing in, New sale, the shop rules (no receipt, no service; staff keep their STAFF COPY; close the day every day), void requests, Close day, approving voids, reading the activity feed and alerts, managing counter accounts when an employee leaves, changing staff on a sale, voiding, recording a past sale, adding services and prices, staff, gallery, offers, appointments, reports, what the backup warnings mean, what to do when the internet is down.
- Finish `docs/restore-guide.md`.

## Out Of Scope

- New features.

## Notes And Rules

- Never run destructive operations on production without the developer's explicit confirmation.
- Recheck current Supabase and Vercel pricing and terms before telling the client the monthly cost.

## Acceptance Criteria

- [ ] The restore drill passed and is recorded.
- [ ] The full end-to-end test passed in production (anything not verified is listed in the tracker).
- [ ] The first PC backup (during the working day) and the first weekly cloud backup succeeded in production.
- [ ] The owner guide and restore guide exist.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
