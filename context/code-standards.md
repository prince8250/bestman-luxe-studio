# Code Standards

## General

- Keep modules small and single-purpose.
- Fix root causes. Do not layer workarounds.
- Do not mix unrelated concerns in one component, action, or route.
- Respect the system boundaries and invariants in `architecture-context.md`.
- Prefer boring, readable code over clever code. The developer is learning this stack and must be able to read what you write.
- Comments explain **why**, not what. Add a short comment wherever the reason is not obvious (for example, why a constraint exists or why a check happens on the server).

## TypeScript

- Strict mode is required.
- Avoid `any`. Use explicit interfaces or narrowly scoped types.
- Validate every piece of external input (forms, query params, webhook bodies, environment variables) with Zod before trusting it.
- Use `interface` for object contracts. Generate database types from Supabase and use them rather than hand-writing duplicates.

## Next.js

- Default to React Server Components.
- Add `"use client"` only for browser interactivity, hooks, or real-time state, and keep client components small and as deep in the tree as possible.
- Prefer server actions for mutations from our own UI. Use route handlers only where an HTTP endpoint is required (backup export and heartbeat, scheduled jobs).
- The website (`app/(site)`) and the POS (`app/pos`) never import each other's components or layouts.
- Read the guide in `node_modules/next/dist/docs/` before using any Next.js API you are not certain about. Do not rely on memory.

## Supabase

- Schema changes go in `supabase/migrations` as SQL files. Never change the schema only through the dashboard.
- Every table has RLS enabled and explicit policies.
- Use the browser/anon client only for public read-only data, the server client for the POS user session, and the service-role client only in server-only modules after validation and checks.
- Never import the service-role client from anything that could be bundled to the browser. Mark such modules with `import "server-only"`.
- Any write that touches more than one row that must succeed or fail together goes in a Postgres function in a migration, called with `.rpc()`. Never chain several supabase-js inserts and hope they all succeed.
- Supabase's API returns at most 1000 rows per request by default. Anything that must read "all rows" (exports, reports) paginates or aggregates in SQL.

## Money, Time, and Phones

- Money: integer pesewas in the database and in logic. Format to GHS only at the display edge through one shared helper.
- Time: store `timestamptz` in UTC. Convert to `Africa/Accra` for display and for "what day is it" logic, through one shared helper.
- Phones: normalize to E.164 with one shared helper before storing or comparing.

## Styling

- Use the CSS custom property tokens defined in `globals.css`: `--site-*` tokens only in the website, `--pos-*` tokens only in the POS. No raw Tailwind palette classes and no hardcoded hex values.
- Website: square corners (`rounded-none`). POS: 16px cards, 10px buttons and inputs, as defined in `ui-context.md`.
- Website: write mobile styles first and add `sm:`, `md:`, `lg:`. POS: design for 1280px first, then make sure tablet and phone still work.
- Bebas Neue is display only (titles, numbers, buttons). Never use it for paragraphs, table cells, or inputs.
- Every interactive element needs a visible focus state and a minimum 44px tap target.

## Forms and Server Actions

- Validate and parse input before any logic runs.
- Enforce authentication and role checks before any mutation.
- Return a consistent result shape, for example `{ ok: true, data }` or `{ ok: false, error }`, with messages a customer can understand.
- Show pending, success, and error states in the UI. Disable submit buttons while pending.

## Money Records

- Sales are created only through the `create_sale` function, already paid, with payments that add up to the total.
- Sales are never deleted. Voids, reassignments, after-payment edits, backdated sales, and service price changes always write an `audit_log` row, inside the same function call as the change.
- Every edit to money or staff attribution requires a reason from the POS user.
- Permissions come only from `lib/auth/permissions.ts`; check them in the server action and again in the Postgres function. Never decide permissions in a client component.
- Report numbers come from the shared SQL report functions only, so the dashboard, reports, CSV, and PC day report always agree.

## Backup Endpoints

- Bearer tokens compared in constant time; tokens never logged.
- Exports paginate every table and include `schema_version`, `generated_at`, and row counts.
- Responses never include Supabase auth tables or secrets.

## Images

- Use `next/image` with sizes set for mobile.
- Resize and compress on upload. Store paths, not URLs.
- Always provide meaningful `alt` text (gallery captions, staff names).

## File Organization

- `app/(site)/` website pages, `app/pos/` POS pages, `app/api/` HTTP endpoints only.
- `lib/` shared infrastructure: Supabase clients, `lib/auth` (permissions, `requirePosUser`, `requirePermission`), availability, SMS adapter, money, time, phone helpers, report queries, backup export.
- `components/site`, `components/booking` (website), `components/pos` (POS). Shared pieces in `components/shared` only when genuinely used by both.
- `components/ui/` shadcn/ui generated components. Do not edit.
- `components/brand-site/` and `components/brand-pos/` styled wrappers that apply each system's tokens.
- `supabase/migrations/` SQL, including Postgres functions.
- `tools/pc-backup/` PowerShell scripts for the studio PC. `tools/restore/` restore scripts.
- `.github/workflows/` the weekly backup workflow.
- Name files after the responsibility they contain, not the technology.

## Security Basics

- Never commit secrets. Use `.env.local` and keep `.env.example` current with variable names only.
- Rate-limit public booking attempts per phone number and per IP, and verify the Turnstile token on the server for every booking submission.
- `/pos` is `noindex`, disallowed in `robots.txt`, and never linked from the website.
- Escape and validate any user-provided text that is displayed (names, captions).
- Return generic errors to users and detailed errors only to server logs.

## Git

- Commit after each completed spec with a clear message, for example `feat: new sale screen (spec 08)`.
- The repository is private.
