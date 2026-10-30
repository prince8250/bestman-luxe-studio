# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Specs are built in order. Check `context/progress-tracker.md` for what exists before assuming a feature is there.

## Commands

- `npm run dev` (needs `.env.local`; copy `.env.example`)
- `npm run lint` (ESLint CLI; `next lint` no longer exists in Next.js 16)
- `npm run typecheck` (`next typegen && tsc --noEmit`; typegen creates the global `PageProps`/`LayoutProps` types)
- `npm run test` (Vitest, single run). One file: `npx vitest run lib/env.test.ts`. Watch: `npm run test:watch`
- `npm run build`

Database (Supabase CLI is a dev dependency; the project is linked to the development project):

- `npm run db:push` applies new migrations in `supabase/migrations` to the linked project. Never edit an applied migration; add a new one.
- `npm run db:types` regenerates `lib/database.types.ts` after a schema change.
- `npm run test:db` runs `supabase/tests/*.test.sql` on the linked project. Each file is one transaction that ends in a deliberate error, so it always rolls back and reports `ok` / `not ok` lines.
- `npm run test:db:local` runs every migration, `seed.sql`, the SQL tests, and `remove_sample_data()` offline in PGlite. It is also part of `npm run test`.
- `npm run db:seed` creates the test owner and counter accounts (passwords go to `.env.local`) and loads sample data. `npm run db:remove-sample` removes all sample data.
- Ad-hoc SQL: `npx supabase db query --linked "select ..."`.

A spec is not done until lint, typecheck, test, and build pass. The server validates env vars at start-up (`instrumentation.ts` → `lib/env.ts`) and refuses to start if a required one is missing. `NEXT_PUBLIC_*` values are inlined at build time, so they must be set when building.

## Git

Work goes to the `dev` branch and is pushed after each spec passes its checks. The developer reviews and merges `dev` into `main`; never push to `main` directly.

## Working rules

- **Spec-driven.** Build only the spec the developer names, in `context/feature-specs/` order. Read it and every spec under its "Depends On" first. Never start the next spec on your own.
- **Read `context/` before architectural decisions**, in the order listed in `context/AGENTS.md`. Do not invent product behavior the specs do not define. Ask, then record the answer in the relevant context file.
- **Ask first** before adding a dependency, changing the schema or an applied migration, editing any `context/` file other than `progress-tracker.md`, changing money/auth/backup behavior beyond the spec, or changing design tokens.
- **Update `context/progress-tracker.md`** after each meaningful change. It must reflect what is actually implemented, not what is intended.
- **The Next.js version (latest, per spec 00) may differ from training data.** Read `node_modules/next/dist/docs/` before using any Next.js API. `context/code-standards.md` repeats this.
- The developer is learning Next.js, TypeScript, and Supabase. Explain the why of decisions, and use Spring Boot analogies where they help.

## Architecture (big picture)

**Two systems, one Next.js codebase, one Supabase Postgres database**, for Bestman Luxe Studio (a barbering and beauty studio in Kumasi, Ghana).

1. **POS** (`app/pos`), the main product: the counter system for walk-in sales, receipts, staff attribution, catalog, reports, backups. Light dashboard UI. Two roles, **owner** and **counter**. Staff are records, never logins.
2. **Public website** (`app/(site)`): a showcase with no login. Visitors book an appointment with a name and phone number, and the booking appears in the POS. Dark, photo-led UI.

Hard boundaries that must hold:
- Routes, layouts, components (`components/site` vs `components/pos`), and design tokens (`--site-*` vs `--pos-*`) are separate. Neither system imports the other. The site never links to `/pos`.
- Server logic lives in server actions, route handlers (`app/api`, only for HTTP endpoints such as backup export and heartbeat), and Postgres functions. There is no separate backend service.

### Core model: appointments are not sales

- An **appointment** reserves a staff member's time. It is not money.
- A **sale** is the receipt: items (service, staff who did it, price) plus payments. It is always created already paid. **Revenue comes only from sales.**
- An appointment becomes a sale when the customer arrives. Walk-in sales never fail because of a staff schedule. They only make the staff member look busy to the online availability engine.
- Only confirmed online appointments are protected by a Postgres exclusion constraint on (`staff_id`, time range).

### Where the rules are enforced

- **Money** is integer pesewas, never floats. Display formatting goes through one helper. Timezone is `Africa/Accra`; weeks start Monday.
- **Multi-row writes are Postgres functions** in `supabase/migrations`, called with `.rpc()`. Examples: `create_sale`, `void_sale`, `edit_sale_item`, `close_day`, `create_appointment`. Never chain several supabase-js inserts for one logical operation.
- **Permissions** come from one map in `lib/auth/permissions.ts`, checked in server actions (`requirePosUser`, `requirePermission`) **and again** in the Postgres functions. Hiding a button is not access control.
- **Audit and history are append-only.** Sales are never deleted. Voids, reassignments, price edits, and backdated sales write `audit_log` rows. Sale items snapshot name, price, and duration so catalog edits never rewrite history.
- **Reports** are all SQL report functions. The dashboard, reports, CSV exports, and the PC day report all call the same functions so every number matches.
- **RLS** is enabled on every table. The anon client reads only public catalog data. The service-role client exists only in `import "server-only"` modules after validation.
- **Public booking** is a server action protected by Cloudflare Turnstile and per-phone/per-IP rate limits. Confirmation pages use a long random token, never the short booking code.
- **SMS** goes only through `lib/sms` (provider still undecided).

### Backups

Three layers, designed in `context/backup-and-recovery.md`: a PowerShell script on the studio PC calling `/api/backup/*` with bearer tokens (compared in constant time), a weekly `pg_dump` GitHub Actions workflow to a private bucket, and Supabase daily backups on the paid plan. A backup that has never been test-restored does not count.

## Where things live

- `context/` holds the authoritative specs and rules. `progress-tracker.md` lists the build order and open questions. `architecture-context.md` has the data model and permission table. `code-standards.md` has conventions.
- `context/design-reference/` has screenshots. View them before any UI work.
- `context/studio-assets/` has the logo and starter photos. Read its README before using them.
- Planned locations: `tools/pc-backup`, `tools/restore`, `.github/workflows`, `components/ui` (shadcn, never edit).

## Secrets

Never commit secrets. Keep `.env.example` listing variable names only. The service-role key, SMS key, Turnstile secret, and backup tokens must never reach the browser bundle.
