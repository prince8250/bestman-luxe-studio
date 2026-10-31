# Architecture Context

## Stack

| Layer          | Technology                                | Role                                                              |
| -------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| Framework      | Next.js (latest) + TypeScript, App Router | Both systems: public website and POS, plus server logic           |
| UI             | Tailwind CSS + shadcn/ui                  | Components and styling, with two token sets (site and POS)        |
| Charts         | Recharts (via shadcn/ui chart)            | POS dashboard and reports only                                    |
| Database       | Supabase Postgres                         | All data                                                          |
| POS auth       | Supabase Auth (email + password)          | POS users only: one owner and the counter accounts. No customer accounts |
| File storage   | Supabase Storage                          | Gallery, staff, catalog images; private weekly backup files       |
| SMS            | Arkesel (SMS API v2; chosen by the developer, 2026-10-31) | Booking confirmation SMS and owner alerts, behind one adapter in `lib/sms` |
| Bot protection | Cloudflare Turnstile (free)               | Public booking form                                               |
| Hosting        | Vercel                                    | Free Hobby tier while building only. **Hobby is non-commercial only**, so a paid plan is required at launch |
| Weekly backup  | GitHub Actions scheduled workflow + `pg_dump` | Weekly full database dump uploaded to a private bucket        |
| Daily PC backup| PowerShell script + Windows Task Scheduler on the studio PC | Calls a secured export endpoint and saves files locally |
| Validation     | Zod                                       | All external input                                                |

There is **no separate backend service**. Server logic lives in Next.js server actions, route handlers, and **Postgres functions** (see "Transactions").

## Why One Codebase For Two Systems

The website and the POS read and write the same data: the POS edits services, prices, gallery, offers, and staff that the website displays, and website bookings must land in the POS. Two separate apps would mean two deploys, two sets of environment variables, and duplicated database types for one developer. So: one Next.js app, one database, with hard boundaries:

- Separate route trees and layouts: `app/(site)` and `app/pos`. Neither imports the other's components.
- Separate component folders: `components/site` and `components/pos`. Shared pieces live only in `components/shared` (rare) and `lib`.
- Separate design tokens (see `ui-context.md`).
- The POS layout verifies a POS user (owner or counter) on the server. The site has no auth code at all.
- The site never links to `/pos`. `/pos` is `noindex` and disallowed in `robots.txt`.

## System Boundaries

- `app/(site)` — public pages: home, `/services`, `/gallery`, `/book`, `/booking/[token]`.
- `app/pos` — the POS. Every route requires a POS user, and owner-only routes require the owner, checked on the server. `/pos/login` is the only POS route reachable without a session.
- `app/api` — route handlers that must be HTTP endpoints: backup export and heartbeat (called by the PC script and GitHub Actions), and scheduled jobs. Everything else prefers server actions.
- `lib` — shared infrastructure: Supabase clients, `lib/auth` (permissions, `requirePosUser`, `requirePermission`), money, time, phone helpers, availability engine, SMS adapter, report queries, backup export.
- `components/site`, `components/pos`, `components/booking`, `components/brand-site`, `components/brand-pos`, `components/ui` (shadcn, never edited).
- `supabase/migrations` — SQL migrations, including Postgres functions. Never change the schema only in the dashboard.
- `tools/pc-backup` — the PowerShell backup scripts and install guide for the studio PC.
- `.github/workflows` — the weekly backup workflow.
- `docs` — owner guide and restore guide (written in the launch specs).
- `context` — specs and project docs for the agent.

## Core Concepts (read this before the data model)

The old design treated every visit as a "booking" that blocked a staff time slot. That breaks at the counter: if a walk-in sale overlaps a staff member's time, the database would refuse the sale while the customer is standing there with cash. So the model separates two ideas:

- **Appointment** = a promise of a future time slot, made on the website or by phone. It reserves a staff member's time. It is **not money**.
- **Sale** = what was actually done and paid at the counter. It has one or more **sale items** (service + staff member who did it + price) and one or more **payments**. A sale **is** the receipt. **Revenue comes only from sales.**

An appointment becomes a sale when the customer arrives (Start sale). A walk-in sale has no appointment.

Walk-in sales **never** fail because of a staff member's schedule. They do not take part in the appointment overlap constraint. They do, however, make that staff member look busy to the online availability engine for the service's duration, so the website does not offer a slot with someone who is mid-haircut.

## Data Model (Supabase Postgres)

All money is stored as **integer pesewas** (1 GHS = 100 pesewas). All timestamps are `timestamptz`. The studio timezone is `Africa/Accra`.

| Table | Purpose and key fields |
| --- | --- |
| `profiles` | **POS users only.** `id` (the Supabase auth user), `display_name` (for example "Abena (counter)"), `role` (`owner` or `counter`), `active`. Production: one owner, plus one counter account per employee who uses the PC |
| `sign_in_events` | `profile_id`, `signed_in_at`, `user_agent`. Lets the owner see when the counter signed in (when the shop "opened") |
| `void_requests` | `sale_id`, `requested_by`, `reason`, `status` (`pending`, `approved`, `rejected`, `cancelled` when the requester withdraws it), `decided_by`, `decided_at`, `decision_note`. At most one pending request per sale |
| `day_closes` | One row per close event: `business_date`, `opening_float`, `expected_cash`, `counted_cash`, `cash_difference`, `momo_reported` (optional), `expected_momo`, `expected_card`, `sales_count`, `note`, `closed_by`, `closed_at`, `reopened_by`, `reopened_at`, `reopen_reason`. A reopen marks the row (it is never overwritten or deleted) and a re-close inserts a new row, so every close stays in history. At most one **active** close (`reopened_at` is null) per `business_date` (partial unique index) |
| `owner_alerts` | `kind` (for example `void_requested`, `cash_difference`, `backdated_sale`, `large_override`, `after_close_sale`, `day_summary`, `day_not_closed`, `backup_stale`), `sale_id`, `occurrence_key` (unique: `<kind>:<sale id>`, `<kind>:<day close id>`, or `<kind>:<YYYY-MM-DD>`, claimed atomically so one occurrence is queued and sent at most once), `payload` (jsonb), `sms_status`, `created_at`. The SMS log for the owner, also used for throttling |
| `studio_settings` | Single row: studio name, phone, WhatsApp, address, map URL, opening hours text, social links, receipt header and footer text, receipt copies (default **2**: customer copy and staff copy), about text. Counter controls: `max_counter_discount_percent` (default 20), `counter_backdate_days` (default 3), `default_opening_float`, `cash_difference_tolerance` (default 0), owner alert phone, alert toggles, `override_alert_threshold`. Edited by the owner in POS Settings; read by the site and receipts |
| `customers` | One row per phone: `phone` (E.164, unique), `full_name`, `blocked` (bool), `blocked_reason`, `notes`, `created_at`. Created automatically by sales and appointments |
| `staff` | `name`, `title` (for example Barber, Nail Tech), `phone` (optional, internal), `photo_path`, `bio`, `show_on_website`, `bookable_online`, `active`, `archived_at`, `sort_order`. A record, never a login |
| `service_categories` | `name`, `tagline`, `image_path`, `sort_order`, `active`. Drives the website panels and groups the POS service picker |
| `services` | `category_id`, `name`, `description`, `image_path`, `price`, `duration_minutes`, `show_on_website`, `bookable_online`, `active`, `archived_at`, `sort_order` |
| `service_staff` | Which staff can perform which service (many-to-many). Used by online booking and as the default filter in New sale (the counter can still pick any active staff) |
| `staff_hours` | Weekly working hours per staff member (weekday, start, end) |
| `staff_time_off` | Days or ranges a staff member is unavailable |
| `appointments` | `code` (short, for example `BK-7K4Q`), `public_token` (long random, for the confirmation link), `customer_id`, `customer_name`, `customer_phone`, `service_id`, `staff_id`, `staff_preference` (`specific` or `any`), `starts_at`, `ends_at`, `status`, `source` (`web` or `phone`), `quoted_price` (snapshot), `sale_id` (set when started as a sale), `sms_status`, `notes`, `created_at`, `seen_at` (when a POS user first viewed it, for the "new" badge) |
| `sales` | The receipt. `receipt_no` (sequential, for example `BLS-000123`), `customer_id` (nullable), `customer_name`, `customer_phone` (nullable), `appointment_id` (nullable), `channel` (`walk_in`, `online_booking`, `phone_booking`), `status` (`paid` or `voided`), `subtotal`, `discount_total`, `total`, `paid_at` (business time of the sale), `recorded_at` (when it was entered), `is_backdated`, `after_close` (entered after that day was closed), `created_by` (profile), `note`, `voided_at`, `voided_by`, `void_reason`, `client_request_id` (unique; makes a double-clicked Confirm return the same sale instead of creating two) |
| `sale_items` | `sale_id`, `service_id` (nullable for a custom item), `item_name` (snapshot), `staff_id` (who did the work; nullable only for a custom item), `unit_price` (snapshot), `quantity` (default 1), `price_override_reason` (required when the price differs from the service price), `line_total`, `duration_minutes` (snapshot, used to block online availability) |
| `sale_payments` | `sale_id`, `method` (`cash`, `momo`, `card`, `other`), `amount` (applied to the sale), `tendered` (cash only, to compute change), `reference` (optional MoMo or card reference), `created_at` |
| `audit_log` | Append-only history: `actor_id` and `actor_role` (who did it: owner or which counter account), `entity` (`sale`, `sale_item`, `service`, `staff`, `appointment`, `settings`), `entity_id`, `action` (for example `staff_reassigned`, `item_price_changed`, `item_service_changed`, `sale_voided`, `sale_backdated`, `service_price_changed`, `appointment_cancelled`), `before` (jsonb), `after` (jsonb), `reason`, `created_at`. No update or delete is ever allowed on this table, not even by the owner |
| `offers` | `title`, `description`, `image_path`, `active`, `starts_on`, `ends_on`, optional `service_id`. Display only in v1 |
| `gallery_images` | `path`, `caption`, `sort_order`, `active` |
| `rate_limits` | Counters for booking abuse protection: key (hashed phone or IP), window, count |
| `backup_runs` | `kind` (`daily_pc`, `weekly_cloud`, `manual_download`), `status` (`success` or `failed`), `started_at`, `finished_at`, `file_name`, `storage_path` (weekly only), `size_bytes`, `row_counts` (jsonb), `message` |

### Appointment Status Lifecycle

`confirmed` → `arrived` (a sale was started and paid) or `cancelled` or `no_show`.

- `confirmed`: created by the website (after bot and limit checks) or by a POS user for a phone booking. Reserves the slot.
- `arrived`: the linked sale was paid. Set in the same transaction as the sale.
- `cancelled`: by a POS user, with a reason (shown in the owner's activity feed). Frees the slot.
- `no_show`: by a POS user. Frees the slot from that point on. The owner may block the number.

The **overlap constraint**: `appointments` has an exclusion constraint on (`staff_id`, `tstzrange(starts_at, ends_at)`) for status `confirmed` only (needs `btree_gist`). This is the final guard against double booking online.

### Sale Rules

- A sale is created **already paid** in one transaction: sale + items + payments (+ appointment update + customer upsert). There is no unpaid or draft sale in the database. The in-progress sale lives only in the New sale screen until Confirm.
- Sum of `sale_payments.amount` must equal `sales.total`. Cash `tendered` can be higher; change = tendered − amount, shown on screen and on the receipt.
- `receipt_no` comes from a Postgres sequence. Gaps (from failed transactions) are acceptable and expected.
- **Snapshot rule**: `item_name`, `unit_price`, and `duration_minutes` are copied onto the sale item. Changing a service's price later never changes old sales.
- **Price override**: a line's price may be changed at the counter (discount, special price), within the role limits in the Permissions table. A reason is required, it is logged, and large overrides alert the owner.
- **Custom item**: a free-text line (name + price, optional staff) for the occasional product or extra. It counts as revenue but appears separately in service reports.
- **Voiding**: a sale is never deleted. Only the owner voids (directly or by approving a counter user's `void_requests` row). Voiding sets `status = voided` with a reason and `voided_by`, logs it, and removes it from revenue and staff reports. Voided sales stay visible in sales history and the day report.
- **After close**: a sale whose business date is already closed is still allowed (a late customer), but is flagged `after_close`, shown separately in the day report, and alerts the owner.
- **Backdated sale** ("Record a past sale"): for sales written on paper during an outage. The POS user picks the real date and time (counter up to 3 days back by default, owner up to 14). `paid_at` is that time, `recorded_at` is now, `is_backdated = true`, and it is logged.

### Editing Who Did The Work

- On a paid sale, a line's **staff member** can be changed (counter: same business day; owner: any time), with a reason (for example "Kofi was busy, Kwame did it"). This writes an `audit_log` row (`staff_reassigned`, before and after staff).
- The owner can also change a line's **service** or **price** after payment, with a reason. If this changes the sale total, the payments must be corrected in the same edit so they still equal the total (for example a cash refund or extra cash), and both changes are logged.
- Reports always show the **current** state. The change log shows the history. A day report saved to the PC earlier shows the state at that moment; the next day's full backup supersedes it.

### Revenue Recognition (one rule)

- **Revenue = sum of `sales.total` where `status = 'paid'`, grouped by `paid_at` in `Africa/Accra` time.**
- Staff revenue = sum of `sale_items.line_total` for that staff member on paid sales.
- Appointments never count as revenue. Cancelled and no-show appointments have no money attached in v1.
- Week starts Monday.

## Close Day (cash-up)

- At the end of the day a POS user runs Close day: enters counted cash (blind), optionally the MoMo total seen on the MoMo phone or statement, and a note.
- `close_day` computes expected cash = opening float + cash payments (refunds are negative payment rows) for that business date, stores the `day_closes` row with the difference, alerts the owner, and triggers the day summary SMS.
- A closed day can only be reopened by the owner, with a reason; reopening and re-closing are logged.

## Transactions (important)

supabase-js cannot run several statements in one database transaction. Any operation that writes more than one row that must succeed or fail together is a **Postgres function** (in a migration) called with `supabase.rpc(...)` from a server action, after the server action has validated input and checked the permission:

- `create_sale(payload)` — customer upsert, sale, items, payments, appointment → `arrived`, audit row if backdated or prices overridden.
- `reassign_sale_item_staff(item_id, new_staff_id, reason)`
- `edit_sale_item(item_id, changes, payment_adjustment, reason)`
- `void_sale(sale_id, reason)` (owner only)
- `request_void(sale_id, reason)` and `decide_void_request(request_id, approve, note)`
- `close_day(business_date, counted_cash, momo_reported, opening_float, note)` and `reopen_day(business_date, reason)`
- `create_appointment(...)` for the public booking (customer upsert + appointment, so the overlap constraint error comes back cleanly)

Functions use `security definer` only where needed, set a fixed `search_path`, and re-check the caller's role in `profiles` against the Permissions table (POS functions) or are only callable by the service role (public booking). Spring Boot analogy: each function is a `@Transactional` service method that lives inside the database.

## Online Availability Model

Bookable slots for a staff member on a date = their `staff_hours`, minus `staff_time_off`, minus `confirmed` appointments, minus **busy blocks from walk-in sales** (`paid_at` to `paid_at + duration_minutes` for that staff member's sale items today), using the chosen service's `duration_minutes`, a minimum lead time (default 60 minutes), and a slot interval (default 30 minutes). Only staff with `bookable_online = true` assigned to the service through `service_staff`, and services with `bookable_online = true`, are offered. "No preference" picks the first free eligible staff member.

The overlap constraint is the source of truth for appointments. The availability engine is for good UX only, and appointment creation must handle a lost race with a friendly message.

## Access Model

### Terms

- **POS user** = anyone signed in to the POS. Two roles: **owner** and **counter**.
- **Owner**: the studio owner. Full access, from the counter PC or from their phone anywhere.
- **Counter**: the employee at the counter PC. Can run the counter, but cannot remove money from the records, change the price list, or see the business's finances.
- Older wording "the admin" anywhere in these docs means "a POS user". What each role may do is decided **only** by the Permissions table below and each spec's "Who Can Use This" section.

### Sign-in

- Owner and counter users sign in with Supabase Auth email + password. Public sign-ups are **disabled**. The first owner is created by the developer (Supabase dashboard user, then a `profiles` row with `role = 'owner'`). Counter accounts are created by the owner in POS Settings (server-side, with the Supabase admin API), one per employee, so every action is traceable to a person.
- The owner can reset a counter password, sign a counter account out of every device, and deactivate it (for example when an employee leaves).
- Every successful sign-in writes `sign_in_events`.

### Server-side checks

- `lib/auth/permissions.ts` is the single source of truth: a map from action (for example `sale.create`, `sale.void`, `sale.requestVoid`, `catalog.edit`, `reports.view`) to the roles allowed.
- `requirePosUser()` (any active POS user) and `requirePermission(action)` run on the server at the start of every POS page and server action. The Postgres functions re-check the role from `profiles` too, so calling the database directly cannot skip the rules. Hiding a button is never access control.

### Permissions

| Action | Counter | Owner |
| --- | --- | --- |
| New sale, receipt, reprint | Yes | Yes |
| Price override on a line | Discounts up to `max_counter_discount_percent` below the service price, reason required; price **increases** allowed with a reason | Any, reason required |
| Custom item line | Yes, reason required | Yes |
| Reassign staff on a line | Same business day only, reason required | Any time, reason required |
| Edit a paid line's service or price | No (request a void and redo the sale) | Yes, reason required |
| Void a sale | **Request** a void with a reason; the owner approves or rejects | Void directly, or decide requests |
| Record a past sale | Up to `counter_backdate_days` back (default 3) | Up to 14 days back |
| Close day (cash-up) | Yes (blind count); after closing, that day's report only (CSV and HTML download, permission `day.closeReport`) | Yes; can reopen a closed day with a reason |
| Today page (today's sales list and appointments, no money totals) | Yes | Yes |
| Appointments: view, start sale, phone booking, cancel (reason), no-show | Yes | Yes |
| Customers: search, view, edit name and notes | Yes | Yes |
| Block or unblock a phone number | No | Yes |
| Dashboard, reports, staff reports, CSV exports | No | Yes |
| Activity feed and change log | No | Yes |
| Services, categories, prices, staff, hours, gallery, offers, settings | No | Yes |
| Counter accounts | No | Yes |
| Backups page and backup downloads | No | Yes |

### Counter Controls (why each one exists)

Cash businesses lose money in quiet ways: a sale not recorded, a sale voided after the customer leaves, a "discount" that was really cash kept. Each control closes one of those gaps.

- **No receipt, no service (a shop rule, not code).** Receipts print in two copies by default: one for the customer, one the staff member keeps. At closing, each staff member's slips must match their count in the system. A service done without a receipt is a sale nobody recorded. This only works if the owner enforces it, so it goes in the owner guide.
- **Voids need the owner.** A counter user cannot make a sale disappear; they can only ask. The owner gets an SMS and approves or rejects from their phone. Pending requests show on the sale.
- **Discount limit.** Bigger discounts need the owner. Overrides above `override_alert_threshold` also alert the owner.
- **Blind cash count at close.** The counter user enters the cash they counted **before** seeing what the system expects. Then the difference is shown, saved, and sent to the owner. If the expected amount were visible first, a counter user could simply count "to the number".
- **Activity feed.** Every sale, override, reassignment, void request, backdated sale, cancellation, close, and sign-in appears in the owner's live feed with who did it.
- **SMS alerts and a daily summary** to the owner's phone, so the owner sees the day without opening the POS.
- **Everything is attributed.** `audit_log.actor_id`, `sales.created_by`, `voided_by`, `closed_by`.
- **Website visitors** never log in. Public booking is a server action protected by Turnstile and rate limits. It uses the service-role client in a server-only module. The browser never reads `appointments`, `sales`, `customers`, or any money table.
- **Confirmation page** `/booking/[token]` uses the long random `public_token`. The short `code` is for the counter and the SMS and cannot open the page.
- **Backup endpoints** (`/api/backup/*`) do not use a POS session. They require a long random bearer token (`BACKUP_EXPORT_TOKEN` for the PC script, a separate `BACKUP_WEBHOOK_TOKEN` for GitHub Actions), compared in constant time. Rotating a token is documented in `backup-and-recovery.md`.
- Phone numbers are normalized to E.164 (`+233...`) everywhere before storage or comparison.

### Known Trade-off: Controls Reduce Risk, They Do Not Remove It

Software cannot see a haircut that happened off the books. The receipt-copy rule, the owner's own spot checks, and comparing staff counts with what the staff say are part of the system too.

### Known Trade-off: Phone Numbers Are Not Verified

Without OTP nobody proves they own the number they type. Mitigations: Turnstile, per-phone and per-IP rate limits, a maximum of 2 upcoming appointments per phone (default), a blocklist, and POS users can cancel and mark no-shows. Deposits (in `later/`) are the stronger fix if no-shows become a problem.

## Row Level Security

- RLS enabled on every table.
- Anon can read only: active categories, active services with `show_on_website`, active staff with `show_on_website` (public fields only, through a view that hides `phone`), active offers, active gallery images, `studio_settings` public fields (through a view), and the data the availability engine needs, which the server reads with the service-role client anyway.
- Anon can never read `appointments`, `sales`, `sale_items`, `sale_payments`, `customers`, `profiles`, `audit_log`, `rate_limits`, or `backup_runs`.
- Signed-in POS users can read and write business tables according to their role (owner-only tables such as `audit_log` reads, `backup_runs`, `owner_alerts`, `day_closes` history, and report functions are restricted to the owner); counter users never read money aggregates; `audit_log` is insert-only for everyone (no update or delete policy exists).
- The service-role key is server-only.

## Storage

- Public-read, owner-write buckets: `gallery`, `staff`, `catalog`.
- Private bucket: `backups` (weekly dumps). Only the service role writes; the POS gives the owner short-lived signed download links.
- Images are resized and compressed before upload (phone photos are large; most visitors are on mobile data). The database stores paths, not URLs.

## Receipts

- An HTML page styled for printing (80mm thermal by default, A4 fallback), opened after a sale and from sale detail. Printed through the browser print dialog. On the studio PC, Chrome can be started with a kiosk-printing shortcut so receipts print without the dialog (documented in the owner guide).
- Generated only from stored data, never from client state. Reprints are identical apart from a "REPRINT" mark.

## Reports

- All aggregation happens in SQL (views or functions), never by loading all rows into the app.
- Report functions take a date range in Accra time and return: totals, counts, by payment method, by staff, by service, by channel, voids, backdated sales, and the comparison with the previous equal-length period.
- The same report functions power the dashboard, the Reports pages, the CSV downloads, and the day report saved by the PC backup, so every number matches everywhere.

## Backups

Summarized here; the full design is in `backup-and-recovery.md`.

- **Daily, on the studio PC**: the PC is switched off at night, so a Windows scheduled task runs a PowerShell script at start-up and then every 2 hours while the PC is on. Each run downloads a full JSON backup and the day report from `/api/backup/export` and `/api/backup/day-report`, saves them in a local folder (today's files are overwritten by later runs; earlier days are kept), and reports to `/api/backup/heartbeat`. Close day also downloads the day report through the browser as an extra copy.
- **Weekly, in the cloud**: a GitHub Actions workflow runs `pg_dump`, uploads the file to the private `backups` bucket, and records it in `backup_runs`.
- **Manual**: "Download backup now" and "Download day report" buttons in the POS.
- **Supabase Pro daily backups** (7-day retention) once on the paid plan, as a third layer.

## Invariants

1. No two `confirmed` appointments overlap for the same staff member. The database enforces this.
2. A walk-in sale is never rejected because of a staff member's schedule.
3. Money is integer pesewas. No floating-point money anywhere.
4. Revenue comes only from paid, non-voided sales, by `paid_at` in Accra time. Nothing else changes revenue.
5. A sale's payments always add up to its total.
6. Sales are never deleted. Voids keep the record with a reason.
7. Every staff reassignment, after-payment edit, void, backdated sale, and service price change writes an `audit_log` row. `audit_log` is never updated or deleted.
8. Sale items snapshot name, price, and duration. Catalog changes never rewrite history.
9. Multi-row writes happen inside one Postgres function (one transaction).
10. The POS user and their permission are verified on the server (and again in Postgres functions) for every POS read and mutation.
18. Only the owner can remove money from the records (voids, after-payment price edits). Counter users can only request.
19. The cash count at close is blind: expected cash is never shown before the counted amount is saved.
11. Staff are never deleted if they have any sale items or appointments; they are archived.
12. The public site contains no login, and no website code can read money or customer tables.
13. Secrets (service-role key, SMS key, Turnstile secret, backup tokens) never reach the browser.
14. Phone numbers are stored in one normalized format.
15. SMS goes only through `lib/sms`.
16. The confirmation page is reachable only through the long random token.
17. A backup that has never been test-restored is not counted as a working backup.
