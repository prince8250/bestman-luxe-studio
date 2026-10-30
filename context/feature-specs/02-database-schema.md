# 02 · Database Schema, Functions, RLS, and Seed Data

## Goal

Create the whole database described in `architecture-context.md`: tables, constraints, transaction functions, security rules, and clearly labeled sample data.

## Depends On

- `00-project-setup.md`

## Scope (Build Only This)

- SQL migrations for every table in the Data Model section: `profiles`, `sign_in_events`, `void_requests`, `day_closes`, `owner_alerts`, `studio_settings`, `customers`, `staff`, `service_categories`, `services`, `service_staff`, `staff_hours`, `staff_time_off`, `appointments`, `sales`, `sale_items`, `sale_payments`, `audit_log`, `offers`, `gallery_images`, `rate_limits`, `backup_runs`.
- Enums or check constraints for every status, channel, source, method, and kind.
- `btree_gist` and the exclusion constraint on `appointments` (`staff_id`, time range) for `confirmed` only.
- Unique `sales.client_request_id`; `create_sale` returns the existing sale when called again with the same id.
- Sequence and default for `sales.receipt_no` (`BLS-000001` format). Short `appointments.code` generator (for example `BK-7K4Q`, no look-alike characters 0/O, 1/I/L) and a long random `public_token`.
- Check constraints: money columns are non-negative integers; `sale_items.price_override_reason` required when `unit_price` differs from the service's price at sale time (enforced in `create_sale`); a custom item has `service_id` null and an `item_name`.
- Postgres functions, each one transaction: `create_sale`, `reassign_sale_item_staff`, `edit_sale_item`, `void_sale`, `request_void`, `decide_void_request`, `close_day`, `reopen_day`, `create_appointment`. POS functions read the caller's role from `profiles` and enforce the Permissions table (counter discount limit, same-day reassignment, backdate limit, owner-only void and edits), and record the actor; `create_appointment` is callable by the service role only. Fixed `search_path`. Each writes `audit_log` rows where the architecture says so. Payments must equal the total or the function raises.
- `audit_log`: insert-only. No update or delete policy, and a trigger that raises on update or delete.
- RLS on every table, exactly as in the architecture file, plus public views that expose only safe columns (`public_staff` without phone, `public_studio_settings`).
- Storage buckets `gallery`, `staff`, `catalog` (public read, owner write) and `backups` (private).
- A seed file **clearly marked as sample data**: studio settings, 4 staff (for example Kofi, Kwame, Ama, Efua), 4 categories, 10 services with realistic GHS prices, staff hours, 2 offers, gallery rows, and about two weeks of sample sales so reports have something to show.
- Generate TypeScript types into `lib/database.types.ts`.
- Supabase helpers: `lib/supabase/client.ts` (browser, public reads only), `server.ts` (POS user session), `admin.ts` (service role, `import "server-only"`).

## Out Of Scope

- Any UI. Report functions (spec 14).

## Notes And Rules

- `seed.sql` cannot create auth users; document a small script or the dashboard steps to create a test owner and a test counter user and their profiles.
- Ask the developer to create the Supabase project and give you the keys. Do not guess values.
- Tell the developer to **disable public sign-ups** in Supabase Auth and record that in the tracker.
- Write SQL tests (or Vitest tests against a local Supabase) for: a counter user calling `void_sale` or `edit_sale_item` is rejected; a counter discount above the limit is rejected; a counter reassigning a line from a previous day is rejected; `close_day` stores the difference and a second close of the same day fails until reopened; overlapping appointments rejected and back-to-back allowed; `create_sale` rejects payments that do not equal the total; `create_sale` with a changed price and no reason is rejected; `void_sale` keeps the row; `audit_log` update and delete both fail; anon cannot read sales, customers, appointments, or audit_log.
- Explain to the developer why functions are used for multi-row writes (the `@Transactional` analogy).

## Acceptance Criteria

- [ ] Migrations apply cleanly on a fresh database.
- [ ] All listed tests pass.
- [ ] `create_sale` writes sale, items, payments, and customer in one transaction, and nothing is written if any part fails.
- [ ] `audit_log` cannot be changed or deleted by anyone.
- [ ] Types are generated and `npm run typecheck` passes.
- [ ] The service-role client is `server-only`.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
