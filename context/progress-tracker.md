# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Phase 4: Reports, close day, and owner oversight.

## Current Goal

- `15-pos-dashboard.md`.

## Completed

- **00 Project setup**: Next.js 16.4.3 (App Router, TypeScript strict, Tailwind v4, ESLint CLI), shadcn/ui (Radix base, `radix-nova` style) with the 12 listed components, Supabase JS + SSR, Zod, Lucide, Vitest. Scripts `lint`, `typecheck`, `test`, `build`. `lib/env.ts` + `lib/env.server.ts` validate env vars, checked at server start by `instrumentation.ts`. `.env.example`, `app/robots.ts` (disallows `/pos` and `/api`), placeholder `/` and `/pos`, folder skeleton, git with `main` and `dev`.
- **01 Themes, fonts, brand wrappers**: Bebas Neue + Inter via `next/font` (`lib/fonts.ts`, `--font-display` / `--font-text`). `--site-*` and `--pos-*` tokens in `app/globals.css`, each scope also re-pointing shadcn's variables. **Two root layouts** (`app/(site)/layout.tsx` with `<html class="site">`, `app/pos/layout.tsx` with `<html class="pos">`, noindex) so portaled dialogs keep the theme; `app/global-not-found.tsx` (experimental `globalNotFound`) serves the 404. Wrappers: `SiteButton`, `SiteHeading`, `PaperSection`, `Container`, `Reveal` (scroll reveal); `PosButton`, `PosCard`, `KpiTile` (+ skeleton), `PageHeader`. Logo: `tools/assets/make-logo.mjs` cuts the circle out of the JPG into `public/brand/logo-crest.png` (transparent), `public/brand/logo-receipt.png` (B&W), `app/icon.png`, `app/apple-icon.png`. Temporary `/design-check` and `/pos/design-check` (remove in spec 37). Checked at 375/1280 (site) and 1280/768/375 (POS) in the browser; reduced motion verified in the compiled CSS only (not emulated).
- **02 Database schema, functions, RLS, seed**: 7 migrations in `supabase/migrations` (all 22 tables, check constraints, `btree_gist` overlap constraint, receipt sequence, booking codes and tokens, append-only `audit_log`, never-delete guards on money tables, a deferred check that every sale's lines and payments equal its total, RLS on every table with explicit grants, column grants that hide staff phones and internal settings from visitors, `public_staff` / `public_studio_settings` views, storage buckets and policies). Functions: `create_sale`, `reassign_sale_item_staff`, `edit_sale_item`, `void_sale`, `request_void`, `cancel_void_request`, `decide_void_request`, `close_day`, `reopen_day`, `create_appointment`, `cancel_appointment`, `mark_no_show`, `remove_sample_data`. Applied to the development project; types in `lib/database.types.ts` (`npm run db:types`); clients in `lib/supabase/{client,server,admin}.ts` (admin is `server-only`). 58 SQL tests in `supabase/tests/database.test.sql` pass on the hosted project (`npm run test:db`, always rolled back) and offline in PGlite (`npm run test:db:local`, also part of `npm run test`). Public sign-ups **disabled** in Supabase Auth (verified: the sign-up API returns `signup_disabled`).

- **03 POS login**: `/pos/login` (email + password, Supabase Auth through a server action), session refresh and signed-out redirect in `proxy.ts`, `getPosUser()` data access layer (`lib/auth/pos-user.ts`, active profile required), `sign_in_events` row on every sign-in (the sign-in is refused if it cannot be recorded), one generic error for every failure, failed attempts slowed after 3 and locked after 10 per email and per IP in 15-minute windows (`rate_limit_*` functions, migration `20261030130000`). Owner lands on `/pos`, counter on `/pos/sale/new`. Route groups: `app/pos/login` (public) and `app/pos/(app)` (signed-in; temporary top bar until spec 04). Verified in the browser by the developer: wrong password gives the generic error, owner and counter sign in to their home pages, a deactivated counter is refused, sign-out returns to the login page; `sign_in_events` rows checked in the database. Public sign-up stays disabled (spec 02).

- **04 POS shell, permissions, Find**: `lib/auth/permissions.ts` (one entry per row of the architecture Permissions table, covered by a test), `requirePosUser` / `requirePermission` / `pageAccess` (`lib/auth/require-pos-user.ts`), `runPosAction` and the `ActionResult` shape (`lib/actions/result.ts`) so owner-only actions refuse a counter user before running. Shell in `app/pos/(app)/layout.tsx`: sidebar (240px, collapsible to icons on desktop with the choice kept in a cookie, icon rail on tablet), top bar with Find (`Ctrl+K`) and the signed-in name and role, phone bottom bar with "More" sheet, owner backup-status card and counter day-status card. Placeholder pages for every POS route with the permission check in place; owner-only pages show "This page is for the owner" to counter users. `/pos/find` classifies receipt numbers, booking codes, and phones (lookups wired in specs 10, 13, 36). `lib/time.ts` is the shared Africa/Accra helper. Checked in the browser as counter and owner at 1280, 768, and 375px.

- **05 Staff management**: `/pos/staff` (owner only): active and removed lists as cards, add/edit sheet (name, title, internal phone normalised to E.164, bio, photo, show on website, bookable online, order), Remove = archive with a dialog that explains history is kept, Restore, and permanent Delete only for removed staff with no sales or bookings. Photos are resized in the browser to 800px WebP (`lib/images/compress.ts`) and uploaded to the `staff` bucket; the database stores only the path, and replaced or deleted photos are removed from storage. Shared `lib/phone.ts` (Ghana formats to E.164, display format), `lib/storage.ts`, `lib/staff/schema.ts` (one Zod schema for the form and the action). Archive/restore are logged by the existing trigger. Migrations `20261030140000` (EXECUTE on `private.is_e164` for signed-in users: the phone check constraints run as the writing user, so owner edits of staff and settings failed) and `20261030150000` (owner SELECT on image-bucket objects: Storage only removes files the caller can select). Verified in the browser at 1280, 768, and 375px as the owner: validation messages, add with photo (116 KB JPEG became a 41 KB WebP), edit, remove, restore, delete; a staff member with sales (Kofi) can be removed and restored but not deleted; visitors get no phone column from `public_staff` and are refused `staff.phone`. Archived staff are excluded from `public_staff`; the New sale and booking pickers (specs 08, 32) must also filter `active`.

- **06 Services, categories, prices**: `/pos/services` (owner only) with three tabs. Services grouped by category (image, price, time, assigned staff, website and online-booking flags), add/edit sheet with a staff picker, Remove = archive (hidden from the website and New sale, history kept), Restore, permanent Delete only when never sold or booked, up/down reorder. Categories: add/edit (name, tagline, image), reorder, remove/restore, delete only when empty. Quick prices: one GHS field per active service, changed rows highlighted with the old price, saved together. Migration `20261030160000`: `save_service` (service + staff assignments in one transaction), `update_service_prices` (many prices, all or nothing), `reorder_rows` (whitelisted owner lists), all owner-only; every price change is logged by the existing trigger with old and new price and the actor. Shared `lib/money.ts` (integer pesewas, string-based parsing), `lib/catalog/schema.ts`, `lib/actions/db-errors.ts` (database error codes to plain messages), `lib/images/upload.ts`, `components/pos/form-fields.tsx`. `PosButton` and `SiteButton` now default to `type="button"` (submit only when asked). Verified in the browser at 1280, 768, and 375px: quick price change logged (Test Owner, 5000 to 5500), staff assignment saved and shown, reorder of services and categories, a service with sales removed (website no longer returns it, its 15 sale lines untouched) and restored, a new category and service added, removed, and deleted. Sample prices were put back afterwards.

- **07 Studio settings and counter accounts**: `/pos/settings` (owner only): studio details (name, phone, WhatsApp, address, map link, opening hours per day, social links, about text), receipts (header, footer, copies, new-booking sound), counter controls (discount %, past-sale days, opening float, cash tolerance, big price change), owner alerts (phone, one toggle per alert kind, daily SMS limit), counter accounts (create with a generated temporary password, new password, sign out everywhere, deactivate/reactivate; the owner's own account is never listed or touched), and "Remove sample data" (shows what is left, keeps the service list unless asked, type REMOVE to confirm). Every settings change is logged by the trigger with only the changed fields; account changes write `audit_log` rows (`account_created`, `account_password_reset`, `account_signed_out_everywhere`, `account_deactivated`, `account_reactivated`) with no password. Migrations `20261030170000` (a POS user needs a live Auth session: `private.has_live_session` inside `pos_role` and `require_pos_user`; `end_user_sessions` for the service role; every policy now calls the helpers as `(select ...)` so they run once per query) and `20261030180000` (`sample_data_summary`). Login form: show/hide password button (developer request). Verified: settings save and reload (opening float GHS 250 and receipt footer, logged with old and new values), invalid values refused with the field named; a counter account created (confirmed email, counter profile, logged), deactivated (0 sessions left), reactivated, and given a new password; a separate live counter session read 19 services, and right after the owner pressed "Sign out everywhere" the same token read 0 and its refresh token was dead. The temporary account was deleted afterwards. Not verified by hand: a newly created counter account signing in through the login page (the same path as the test counter, which works). Checked at 1280, 768, and 375px.

- **08 New sale**: `/pos/sale/new` (owner and counter). Service tiles by category with search (`/` focuses it, Enter adds the first match), a Custom item tile, and the ticket: per-line staff chips (staff assigned to the service first, then "Other staff"; preselected when only one person does the service), quantity, and a price dialog that needs a reason (quick reasons; for the counter the lowest allowed price is shown and bigger discounts are refused). Customer phone (optional) with a live lookup (`customer_lookup`, migration `20261030190000`: name, visits, last visit, blocked warning, never money); a new number asks for an optional name. Payment: Cash (quick amounts, change), MoMo/Card (optional reference), Split (rows must add up; Confirm stays disabled with the reason shown). CONFIRM & PRINT sends only ids, prices, quantities, and reasons to `confirmSaleAction` (Zod), which calls `create_sale` (re-reads prices, enforces the discount limit and reasons, records `created_by`, dedupes on `client_request_id`). A ref guard stops a second Confirm before the screen re-renders. Failure keeps the ticket with the message. The ticket is kept in `sessionStorage` per user id (`lib/sale/draft.ts`), restored after a refresh, cleared after a sale and on sign-out, and another account's draft is discarded unread. After-close banner when today is closed. Phone/tablet: a sticky total bar with a jump to the ticket (hidden while the ticket is on screen). Logic in `lib/sale/ticket.ts` (totals, problems, payload) with tests. Verified in the browser: the developer's own sales (Facial by MoMo, Weavon Styling cash with change, Makeup); a keyboard-only sale of three lines by two staff (Kofi, Kofi, Efua) paid cash GHS 100 + MoMo GHS 120, Enter pressed twice → exactly one sale (BLS-000214); split over the total refused on screen; a returning sample number recognised ("Kwesi Darko · 7 visits"); counter discount above the limit and a missing reason refused by `create_sale` (database tests). Checked at 1280, 768, and 375px as the owner. Not verified by hand: the screen signed in as the counter account (its limits are covered by the database tests and the price dialog's role check).

- **09 Receipt printing**: `/pos/receipts/[saleId]` (outside the POS shell, so only the receipt prints) built from `receipt_data(sale_id)` (migration `20261030200000`): the stored sale, lines with staff names, payments, the counter account's name, studio settings, and the print count; same visibility as sales (owner any, counter today's only). `receipt_prints` records every print (`record_receipt_print`), so every print after the first is marked **REPRINT**. Copies from Settings (default 2): the customer's copy, then a **STAFF COPY** per staff member on the sale (at least copies − 1). After CONFIRM & PRINT the receipt loads in a hidden frame and opens the print dialog, so the counter stays on New sale; the success panel has Reprint and View receipt. Paper per device (cookie): **80mm roll** (each copy one page, exactly as tall as the receipt, so the printer cuts per copy and feeds no blank paper) or **A4** (copies side by side with dashed cut lines). Black and white, logo `public/brand/logo-receipt.png`, "Served by", "Served at the counter by", tendered and change, references, footer, socials, WhatsApp, "Book online at". Owner-guide notes in `docs/owner-guide-draft.md` (driver, default printer, paper size and cutter, Chrome `--kiosk-printing` shortcut, A4, the "no receipt, no service" rule). Verified: print output rendered through headless Chrome to PDF, 80mm (2 pages of 80 × 145mm, controls hidden) and A4 (one page, both copies, cut lines); the developer printed and reprinted BLS-000202 (REPRINT shown afterwards); a three-line sale printed 3 copies (customer, Kofi, Efua). The Claude app's built-in browser does not show Chrome's print preview; test printing in real Chrome. Checked at 1280, 768, and 375px.

- **10 Sales history and voids**: `/pos/sales`. Owner: every sale, filters in the URL (dates: today, yesterday, this week, this month, last 30 days, custom; staff; payment method; channel; recorded by; status paid / voided / void requested), search by receipt number (`BLS-000213`, `bls213`, or `213`) or phone across all dates, totals for the whole filtered range (revenue, sales, voided count and amount, money per method; paid sales only), 50 per page, and a notice naming sales from other days that were voided during the dates shown (they count on the day they were sold). Counter: today's sales only, no totals and no per-sale amounts in the list. Table on a desktop, cards on a tablet or phone. Sale page `/pos/sales/[id]`: times (paid, recorded, business day), past-sale / after-close / voided / "Void requested" badges, who recorded it, customer, lines with staff and override reasons, payments with change and references, linked appointment, print count, void requests, and (owner only) the change history in plain sentences. Actions: Reprint (hidden frame, marked REPRINT), View receipt (`?from=sale` returns to the sale), owner Void (reason required), counter "Request void (the owner will approve)" and Withdraw, owner Approve / Reject (note required on reject) on the sale and on `/pos/sales/void-requests` (pending first, then the last 20 decisions; count shown on the Sales page). Find: a receipt number opens the sale (counter: today's only, else "ask the owner"). Migration `20261030210000`: `search_sales(filters)` and `sale_detail(sale_id)` (security definer, apply `private.can_see_sale`, money only for the owner); `receipt_data` / `record_receipt_print` now use the existing helper and the duplicate overload from spec 09 is dropped. Shared `components/pos/receipt/receipt-print-frame.tsx`. Database tests (95): a voided sale cannot be voided again, requested, or edited; reject keeps the sale with the note; approve uses the request's reason and the owner as `voided_by`; the counter's search has no money and no older sales; owner totals equal the rows and the methods add up; filters; history owner-only. Verified in the browser as the owner at 1280, 768, and 375px: Find "bls 143" opened BLS-000143; the developer approved the sample request (BLS-000143, from 29 Oct, now shown in the notice); void of BLS-000213 with a reason (blank refused) updated the list (revenue GHS 1,170 → 1,140, voided 1); 30-day voided filter (3 sales, GHS 310); a test request on BLS-000214 rejected with a note (blank refused). Not verified by hand: the counter's screens (request, withdraw, today-only list); the database tests cover their rules, and the developer can try them signed in as the counter.

- **11 Reassign staff and edit a paid sale**: on the sale page each line has **Change staff** (counter: today's sales only; owner: any sale) with staff chips and quick reasons ("Staff was busy", "Customer changed preference", "Entered wrong staff") → `reassign_sale_item_staff`, and **Edit** (owner only): service (grouped by category, the price follows the new service), price, quantity, reason quick picks; when the total changes the dialog shows "Collect GHS X" or "Refund GHS X" with the method and an optional reference, and sends exactly that difference → `edit_sale_item` (which refuses any other amount). The Sales list has a quick **Change staff** on today's paid sales (icon in the table, text on cards; a sale with several lines asks which one). A **Changed** badge marks edited lines and sales (owner: links to the change history). Migration `20261030220000`: `private.line_changed` / `private.sale_changed` (a reassignment, price change, or service change in `audit_log`), and `search_sales` / `sale_detail` return the flags plus the line and staff ids. Database tests (101): a counter reassignment moves the job to the new staff member in `search_sales` (and out of the old one's), marks the sale changed, keeps the total, and the history shows from, to, reason, and time; same-staff and voided-sale reassignments are refused (earlier tests: counter refused on older days and for any edit; an edit that changes the total needs the exact money difference). Component test: the Edit dialog sends the exact difference and needs a reason. Verified in the browser as the owner at 1280, 768, and 375px on test sale BLS-000214: Hair Washing Kofi → Kwame ("Staff was busy"), P-Cut GHS 60 → 70 with GHS 10 cash collected (total 220 → 230, "Extra paid by Cash"), Pedicure Efua → Ama from the list's quick action; the history lists each change. Not verified by hand: the counter's Change staff (same screens; the database tests cover the counter's limits). Staff reports (spec 16) will read `sale_items.staff_id`, so a reassignment moves the job and its revenue there too.

- **12 Record a past sale**: New sale has **Record a past sale** (top of the ticket): a date (min = today − the account's limit, max = today) and a time; the ticket stays blocked until both are valid ("Enter the time the sale happened", "That time is in the future", "up to N days back"), and the button reads **SAVE PAST SALE**. The past date and time live on the ticket, so they survive a refresh with the draft (an older draft without them loads as a normal sale). `confirmSaleAction` sends `paid_at` (the Accra date and time as an instant); `create_sale` already refuses the future and the limit (owner 14 days, counter `counter_backdate_days`), sets `is_backdated`, writes `sale_backdated` to `audit_log` and a `backdated_sale` owner alert, and flags `after_close` when that day was closed. A past sale does not print automatically (the customer has left; the success panel offers Print receipt), and after saving the mode stays on with the same date and an empty time, for entering a stack of paper sales. The "Past sale" badge shows in the sales list and on the sale page (from spec 10); day reports are spec 14/16 and group by `paid_at`. `/pos/paper-sheet` (outside the shell, both roles): a blank A4 sheet with the studio name, date / written by / page, 22 rows (time, customer phone, service, staff, amount, payment with Cash · MoMo · Card to circle, and an "Entered" box) and cash / MoMo / card totals; linked from the past-sale panel. Owner guide: "When the internet or power is down", including open question 15 (backup MiFi and a small UPS, no code). Database tests (104): the owner cannot go beyond 14 days and can go 10 days (beyond the counter's 3); a counter sale backdated to yesterday 14:30 lands on yesterday, is flagged and logged, and shows in yesterday's `search_sales`. Unit tests for the past-sale rules and payload. Verified in the browser as the owner at 1280, 768, and 375px: a future time is refused on screen; Haircuts recorded for Thu 29 Oct 14:30 (BLS-000254) shows in "Yesterday" with "Past sale" and "After close" badges; the paper sheet printed through headless Chrome to one A4 page (controls hidden, every column header fits). Not verified by hand: the counter account's past-sale limit on screen (the database test covers it).

- **13 Customers**: `/pos/customers` (both roles): search box (a full phone number in any common Ghana format is matched exactly as E.164; otherwise part of the name or part of the number, for example `000 0106`), most recent visit first, 50 per page, table from tablet width and cards on a phone, "Blocked online" badge. Customer page `/pos/customers/[id]`: name and phone, tiles for visits (paid sales only, since the first visit), last visit, total spent (owner only), favourite service, and usual staff; sales (voided ones listed and marked; a counter user can open only today's, older ones are plain text) and appointments with their status; edit name and notes (both roles; the phone is the identity and is not editable); owner **Block online booking** (reason required) / **Unblock**, with a red banner showing the reason and who blocked it when. Find: a phone number in any format opens the customer (or says no customer has it yet). Migration `20261030230000`: `search_customers(query, phone, limit, offset)` and `customer_detail(id)`, security definer, money for the owner only; name and notes updates go through the existing RLS, column grants, and `customers_guard` trigger, and blocks are logged by the existing `customers_audit` trigger. Database tests (110): two paid sales and one voided for one number give 2 visits and the right total (voided listed, not counted), favourite service and usual staff, the counter sees no money, search by `020 999 9050`, `233209999050`, part of the number, or part of the name, visitors refused, a block shows with who blocked it, the counter edits name and notes. Verified in the browser as the owner at 1280, 768, and 375px: Find "+233 20 000 0106" opened Kwesi Darko (6 visits and GHS 350.00, matching the sales table; his voided BLS-000143 listed and not counted); every phone format and "kwesi" found him; blocking needed a reason, showed the banner, and wrote `customer_blocked` with the reason to `audit_log`; unblocked again; a notes edit saved (sample note restored afterwards). Not verified by hand: the customer pages signed in as the counter (the database tests cover what the counter gets).

- **14 Report engine**: migration `20261030240000`. Private builders `private.r_*` (never granted) compute each report; public `report_*` wrappers check owner-only and a sane range (start on or before end, at most two years) through `private.report_guard`, then return the builder's jsonb: `report_summary` (revenue, sales, services done, customers served = distinct identified customers + walk-ins without a phone, average sale, discounts, and the same for the previous period of equal length), `report_by_payment_method` (adjustments included, so methods add up to revenue), `report_by_service` (current name and category; custom items apart), `report_by_category`, `report_by_channel` (every channel, zeros included), `report_by_staff` (service lines only: services, revenue, average per service, top service; a reassigned line counts for whoever it is assigned to now), `report_by_day` (every day, zeros included), `report_by_weekday` (Monday-Sunday with how many of each day the range has), `report_repeat_customers`, `report_voids` / `report_backdated` (sold in the period, or voided / entered during it, flagged), `report_after_close`, `report_void_requests`, `report_by_counter_user` (every counter account with zeros, the owner when they rang sales), `report_day_close` (reopened closes marked), `report_changes` (audit_log, newest first, limit 500 by default), and `report_day_close_export(date)` (the day report; owner any day, counter only for a day with an active close, else `not_closed`), all built from the same builders. Revenue is paid sales by `business_date` (the Accra date of `paid_at`), so a backdated sale lands on its real day. `lib/reports/range.ts`: the shared date-range helper (Today, Yesterday, This week from Monday, This month, Last 30 days, Custom; `previousRange`, `rangeDays`, `isCalendarDate`); the Sales page now uses it. `lib/reports/reports.ts` (server-only): one typed wrapper per report with a Zod schema, `ReportError`, and `percentChange`. Database tests (131): a sample week (3-9 Jan 2000) with a hand calculation written in the test: revenue 395.00 over 5 sales, 6 services, 3 customers served, average 79.00, cash 280 / MoMo 80 / card 35, Kwame 4 services and 220.00 after the reassignment, Kofi 2 and 140.00, repeat rate 0.5, previous week 140.00; day, week (a 00:00:30 Monday sale is next week's), and month (January 2000 against December 1999) boundaries; voided sale excluded everywhere; the counter refused on every report and on a day report before the close; the private builders cannot be called. Also checked: all 17 report outputs captured from the dev database (last 30 days, as the test owner, in a throwaway session) parse with the TypeScript schemas, and on that real data revenue equals the payment methods and the day-by-day total, and services done match across summary, services, and staff.

## Development Database And Test Accounts

- Development project: `bestman-luxe-studio` (ref `xpcsmqwdpswnvzyterwx`, eu-central-1, free plan). The CLI is linked (`npx supabase link --project-ref xpcsmqwdpswnvzyterwx`); `npm run db:push` applies new migrations.
- **Test accounts**: `npm run db:seed` creates a test owner (`owner@bestman.test`) and a test counter (`counter@bestman.test`, "Abena (counter)") with the admin API, stores their passwords in `.env.local` (`DEV_OWNER_PASSWORD`, `DEV_COUNTER_PASSWORD`, gitignored), uploads the sample gallery photos, and runs `supabase/seed.sql`. It refuses to run unless `.env.local` has `SEED_TARGET=development`.
- **Sample data** (all marked "(sample)"): the studio's 5 categories and 19 real services with placeholder prices, 4 staff, 18 customers with fake `020 000 01xx` numbers, about two weeks of sales with day closes, a voided sale, a backdated sale, a reassignment, a pending void request, and 10 appointments. Every row is registered in `private.sample_rows`. **Remove it before real use**: `npm run db:remove-sample` (keeps the service list; `select public.remove_sample_data(false)` also removes the services). Removal resets receipt numbers to `BLS-000001` when no sales remain.
- **First production owner** (spec 03 / 38): create the user in the Supabase dashboard (Authentication → Users → Add user), then insert their profile: `insert into public.profiles (id, display_name, role) values ('<user id>', '<name>', 'owner');`. Counter accounts are created by the owner in POS Settings (spec 07).

## In Progress

- None.

## Next Up

- `15-pos-dashboard.md`, then `16-pos-reports.md`.

## Build Order

Specs live in `context/feature-specs/`. Build in order unless the developer says otherwise. Tick a box only when the spec is fully done. **The POS comes first** because it is the product the studio runs on; the website follows.

**Phase 0: Foundation**
- [x] 00 Project setup
- [x] 01 Two themes, fonts, and brand wrappers
- [x] 02 Database schema, functions, RLS, and seed data

**Phase 1: POS access**
- [x] 03 POS login (owner and counter accounts)
- [x] 04 POS shell, permissions, and Find

**Phase 2: POS catalog and settings**
- [x] 05 Staff management
- [x] 06 Services, categories, and prices
- [x] 07 Studio settings and counter accounts

**Phase 3: POS core (the counter)**
- [x] 08 New sale
- [x] 09 Receipt printing
- [x] 10 Sales history, voids, and void requests
- [x] 11 Reassign staff and edit a paid sale
- [x] 12 Record a past sale (outage fallback)
- [x] 13 Customers

**Phase 4: Reports, close day, and owner oversight**
- [x] 14 Report engine (SQL)
- [ ] 15 Dashboard
- [ ] 16 Reports: day, week, month, staff, changes
- [ ] 17 Close day (blind cash-up)
- [ ] 18 SMS adapter
- [ ] 19 Owner activity feed and SMS alerts

**Phase 5: Backups**
- [ ] 20 Backup export endpoints and manual download
- [ ] 21 Backup to the studio PC (while it is on)
- [ ] 22 Weekly cloud backup and the Backups page

**Milestone: the studio can start using the POS here**, before the website exists (see open question 11).

**Phase 6: Website content and public site**
- [ ] 23 Gallery management (POS)
- [ ] 24 Offers management (POS)
- [ ] 25 Website navbar
- [ ] 26 Website hero
- [ ] 27 Website services panels and page
- [ ] 28 Website gallery
- [ ] 29 Website offers, about, location, footer

**Phase 7: Online booking into the POS**
- [ ] 30 Staff working hours and time off
- [ ] 31 Availability engine
- [ ] 32 Website booking flow
- [ ] 33 Booking creation
- [ ] 34 Booking abuse protection
- [ ] 35 Confirmation page and SMS
- [ ] 36 Appointments in the POS

**Phase 8: Launch**
- [ ] 37 Polish: performance, SEO, accessibility
- [ ] 38 Deployment, restore drill, and handover

**Not in v1**: `feature-specs/later/` (deposits, offline mode, owner PIN on the counter PC, commission, reminders, products, mobile app).

## Resolved Questions

- **Who sits at the counter PC**: an employee. → Owner and counter roles with server-enforced permissions, void requests, a counter discount limit, blind cash-up, an owner activity feed, and SMS alerts (architecture "Access Model").
- **Studio PC**: Windows, **not** left on overnight. → PC backups run at log-on and every 2 hours while the PC is on, overwrite today's files, and finalize the previous day at the next start-up; Close day also downloads the day report in the browser (`backup-and-recovery.md` Layer 1).
- **Online deposits**: not in v1, confirmed. → `later/` L1.
- **17 Accent color in the POS**: reference blue `#2563eb` (developer, 2026-10-30).
- **2 Logo file**: no transparent file exists. The agent removes the dark background from `bestman-logo.jpg` itself (spec 01) and makes a black-and-white receipt version (developer, 2026-10-30).
- **3 Service list**: the developer supplied the real services (below). Prices and durations are **placeholders**, clearly marked; the owner sets the real ones in POS Services (developer, 2026-10-30).
  - Haircuts & Barbering: Haircuts, P-Cut, Boy Child Fringe
  - Hair Styling & Installation: Frontal Pony, Frontal Styling, Wig Installation, Weavon, Weavon Styling, Hair Washing
  - Facial & Skincare: Facial, Contour, Eyebrow Tattoo
  - Nails & Pedicure: Nail Services, Gel Polish, Acrylic Nails, Pedicure
  - Makeup & Beauty Enhancements: Makeup, Eyelashes, Piercing
  - Main business category: Beauty, Hair & Personal Care (Beauty Salon & Barbershop)
- **4 Staff list**: 4 sample staff (Kofi, Kwame, Ama, Efua), clearly marked. The owner adds the real staff in POS Staff (developer, 2026-10-30).
- **Sample data must be very easy to remove** (developer, 2026-10-30): all sample rows are removable in one step before real use (see spec 02 notes when built).
- **Dependencies**: the developer allowed adding dependencies as needed; each one is listed in the spec report (2026-10-30).
- **Open questions are asked one by one** as their spec comes up (developer, 2026-10-30).
- **GitHub repo stays public** (developer's choice, 2026-10-30), although `code-standards.md` says private. No secrets are committed; `.env.local` is gitignored.
- **8 Receipt printer**: 80mm thermal (model not known yet), 2 copies by default (developer, 2026-10-30). Setup steps in `docs/owner-guide-draft.md`.
- **9 Customer phone at the counter**: optional, encouraged (developer, 2026-10-30).
- **15 Internet and power at the studio**: no code needed; the backup MiFi and small UPS recommendation is in `docs/owner-guide-draft.md` for the handover (spec 38).
- **10 Staff pay**: not decided yet (developer, 2026-10-30). Default kept: v1 reports services done and revenue per staff member only; pay calculations stay in `later/` L4.
- **12 Products**: sold occasionally, through the Custom item line (developer, 2026-10-30); stock stays in `later/` L6.
- **Supabase**: new project `bestman-luxe-studio` (ref `xpcsmqwdpswnvzyterwx`, region Europe), the development database with sample data. "Automatically expose new tables" is off (migrations grant access explicitly) and automatic RLS is on. The other projects in the org (`luxe-studio`, `Maison`) are not used.

## Open Questions

Resolve each before the spec shown in brackets. Record the answer in the relevant context file, then remove it here. Defaults are what the agent assumes if the developer says "go with the default".

**Catalog and counter**
1. **Studio details** [07, 26, 29] Phone and WhatsApp (024 456 5866) and Instagram (https://www.instagram.com/bestman_luxe_studio_/) are real and saved (developer, 2026-10-30). Still open: exact address and map pin, opening hours, other socials, about text (the owner can enter them in POS Settings).
5. **Counter employees** [07] Resolved for now: the owner creates one account per employee in POS Settings when ready (developer, 2026-10-30); one close per day, shift hand-overs not tracked in v1. Original question: How many people will use the counter PC, and their names (one counter account each). Is there a regular hand-over between shifts during the day? (Default: one close per day; shift hand-overs not tracked in v1.)
6. **Counter limits** [07, 08, 12] Resolved: use the defaults below, editable in POS Settings (developer, 2026-10-30). Original question: Maximum counter discount (default 20%), counter backdate limit (default 3 days), opening cash float (default: owner sets), cash difference tolerance (default GHS 0.00), alert threshold for overrides.
7. **Owner alerts** [19] Owner's phone number, which alerts by SMS (default: all on), daily SMS cap (default 20).
11. **Soft launch** [after 22] Start using the POS at the studio before the website is ready? (Default: yes; requires Supabase Pro and Vercel Pro from that point, see 13.)

**Backups and hosting**
13. **Hosting cost** [22, 38] Production needs Supabase Pro (about $25/month, daily backups, no pausing) and Vercel Pro (Hobby is non-commercial only). The client must agree to pay. Recheck prices before quoting.
14. **Windows version and folder** [21] Windows 10 or 11? Backup folder (default `C:\BestmanBackups`), and can it sit inside a Google Drive or OneDrive desktop folder for an off-site copy?

**Website and booking**
16. **SMS provider** [18] Arkesel, mNotify, or Hubtel; account, API key, sender ID. Needed earlier now, because owner alerts (spec 19) use it.
18. **"No preference" staff** [32] Allowed? (Default: yes.)
19. **Booking limits** [34] 2 upcoming bookings per phone and the documented rate limits. (Default: yes.)
20. **Turnstile** [34] Developer creates the free Cloudflare Turnstile site and keys.
21. **Website photos** [26–29] Use the starter photos in `studio-assets/photos/` (default yes), get the studio's OK for the people shown, and a few landscape and interior shots for the hero and About.

## Architecture Decisions

- **Two systems, one codebase**: POS (`app/pos`, main product) and website (`app/(site)`, no login). Shared database; strict folder, layout, and design separation.
- **POS-first build order.** The studio can start using the POS before the website exists.
- **Two POS roles**: owner (full access, often on a phone) and counter (one account per employee). One permissions map in `lib/auth/permissions.ts`, enforced in server actions and again in Postgres functions.
- **Counter controls**: void requests approved by the owner, a discount limit, same-day-only reassignment, a backdate limit, a blind cash count at close, a live activity feed, SMS alerts and a daily summary to the owner, and two receipt copies ("no receipt, no service").
- **Sales are separate from appointments.** A sale (receipt) with line items (service + staff + price) and payments is the only source of revenue. Appointments are reserved time slots.
- **Paid means confirmed** at the counter. No unpaid sales are stored.
- **Walk-in sales never fail because of schedules.** Only online appointments are protected by the overlap constraint.
- **Staff are records, not users.** Reassignment always needs a reason and is logged in an append-only `audit_log` with the actor.
- **Multi-row writes are Postgres functions** (one transaction each).
- **Three backup layers**: PC (log-on + every 2 hours while on, plus the browser copy at Close day), weekly `pg_dump` to a private bucket (GitHub Actions), Supabase Pro daily backups. Restore drill blocks launch.
- **Fonts**: Bebas Neue for display, Inter for reading, in both systems.
- **Website look**: dark, photo-led, square. **POS look**: light dashboard (Shopeers-style reference).
- No customer accounts, no OTP, no online deposits in v1.
- Money is integer pesewas; timezone `Africa/Accra`; week starts Monday.
- **Next.js 16 Cache Components off** (spec 00). `create-next-app` 16.4 enables `cacheComponents` by default; it forces every session read behind a Suspense boundary. The POS is per-user and dynamic, so the classic model (cookies make a route dynamic) is used for simpler, safer access checks.
- **shadcn/ui on the Radix base** (`radix-nova`), because the specs use the `asChild` pattern. shadcn's `cn` comes from its `cn` package (re-exported by `lib/utils.ts`).
- **Env split**: `lib/env.ts` (schemas + public vars, safe anywhere) and `lib/env.server.ts` (`server-only`, secrets).
- **Two root layouts** (spec 01): the website and the POS each own `<html>`, because Radix dialogs/selects portal into `<body>` and must inherit the right theme. Moving between them is a full page load, which is fine (the site never links to the POS).
- **POS radius**: use `rounded-[16px]` for cards; shadcn's radius scale is relative to `--radius` (10px in the POS), so `rounded-2xl` would be 18px.
- **Git**: work is pushed to `dev` after each spec; the developer merges `dev` into `main` after review.
- **Database tests without Docker** (spec 02): SQL tests run on the development project through `supabase db query --linked`, one transaction per file that always ends in a deliberate error (so everything rolls back), and offline in PGlite with a small stand-in for Supabase's `auth` and `storage` schemas.
- **Deferred balance check** (spec 02): a constraint trigger refuses, at commit, any sale whose lines or payments do not add up to its total, whatever code path wrote it.
- **Counter sales visibility** (spec 02): RLS lets a counter user read sales of the current business day (and past sales recorded today) only. Per-sale amounts stay visible to them because they ring up and reprint those receipts; money aggregates are owner-only.
- **Owner-only pages** (spec 04): Next.js `forbidden()` needs the experimental `authInterrupts` flag and a single root layout, so pages use `pageAccess(action)` and render `<OwnerOnly />` before loading data; server actions use `runPosAction(action, ...)`, which throws on a refused role before the action body runs.
- **Owner alert occurrence keys** (review, 2026-10-30): `owner_alerts.occurrence_key` is unique, so a retried job or a re-close cannot queue or send the same alert twice.
- **Session check** (spec 07): signing someone out everywhere deletes their rows in `auth.sessions`, and every RLS rule and POS function also requires the token's session to still exist, so the lock-out is immediate (not after the access token expires).
- **Second review (2026-10-30)**: the POS error page uses Next.js 16.4's stable `retry()` (not `unstable_retry`, which was the 16.2 name) so "Try again" refetches the server data; client components catch a failed request (dropped internet) and show a message instead of staying stuck on "Saving…" (catalog, quick prices, staff, settings, counter accounts, sample data).
- **Review of 2026-10-30, not changed (with reasons)**: counter sale-detail without amounts (conflicts with the supported counter reprint; RLS already limits the counter to today); empty `SMS_MODE` in `.env.example` (an empty value fails the enum, the explicit `console` is correct); `--font-sans` to Geist (the project uses Inter); allowing `/pos` in robots.txt (spec 00 and the architecture require disallow; POS pages are also `noindex` and never linked); edits to `components/ui` (button default type, sheet scroll, tabs orientation) because generated shadcn files are never edited. Note: `components/ui/tabs.tsx` does not forward `orientation` to Radix, so vertical tabs need a wrapper; only horizontal tabs are used.

- **Third review (2026-10-30)**: a counter password reset or deactivation now reports when the account could not be signed out of its devices (the change and its audit row are still saved); Settings number fields refuse empty input instead of saving 0; opening-hours fields stop at 40 characters; every client request handler uses `lib/actions/request-error.ts`, which says "refresh the page" when a server action is unknown after a deploy (`unstable_isUnrecognizedActionError`) and keeps the connection message otherwise (applied to all forms, not only the three files named in the review).
- **Fourth review (2026-10-30)**: Sign out everywhere stays available on deactivated counter accounts (the deactivation error tells the owner to press it); reactivating a counter account first ends any leftover sign-in and stays inactive if that fails; the sales date filters accept real calendar dates only (`isCalendarDate`), so an impossible date in a link falls back to today instead of failing in `search_sales`.
- **Receipts print from a hidden frame** (spec 09): after a sale, `/pos/receipts/<id>?print=1` loads in an off-screen iframe that records the print and calls `window.print()`, so no pop-up is needed and the counter never leaves New sale. With Chrome's `--kiosk-printing` it prints silently.
- **Print count in the database** (spec 09): `receipt_prints` decides REPRINT, not a URL flag, so an original cannot be printed twice by reopening a link. A sale with several staff gets one STAFF COPY per staff member, so each person's slips match their count in the day report.
- **Sales list money for the counter** (spec 10): the counter's Sales list shows no amounts at all (not only no totals), matching the Today page in `ui-context.md`, so it cannot be summed into the expected cash before the blind count. The sale page still shows the amounts, because the counter reprints and checks those receipts.
- **Receipt paper per device** (spec 09): a `pos_paper` cookie (80mm or A4), set by a server action. On 80mm the page height is measured from the receipt before printing.

## What Changed From Context Version 1

For the developer's reference; the agent should treat the current files as the only truth.
- Admin area rebuilt as **the POS**, the main product, built first, with **owner and counter roles**.
- `bookings` + "check-in revenue" replaced by `appointments` + `sales` / `sale_items` / `sale_payments`.
- Multi-service sales, a staff member per line, reassignment with a change log, voids and void requests, backdated sales, close day.
- New: dashboard per the POS reference, report engine, staff reports, end-of-day report, CSV exports, owner activity feed and SMS alerts.
- New: backups (`backup-and-recovery.md`, specs 20–22), restore drill.
- New: studio settings and counter accounts, phone bookings.
- Removed from v1: Paystack deposits (now `later/` L1).
- Fonts changed to Bebas Neue + Inter.

## Session Notes

- 2026-10-30: The developer asked for the whole project to be built spec by spec, pushing each finished spec to `dev`. Supabase org `lfsdjrvlfgypdlvhgyny`, Vercel team `princeappiah8250-9236s-projects`, GitHub user `prince8250`.
