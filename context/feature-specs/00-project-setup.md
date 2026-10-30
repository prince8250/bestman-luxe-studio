# 00 · Project Setup

## Goal

Create the empty project with tooling, folders, and environment validation for both systems.

## Depends On

- None

## Scope (Build Only This)

- Scaffold Next.js (latest) with TypeScript strict mode, App Router, Tailwind, ESLint.
- Initialize shadcn/ui and install only: button, input, label, card, dialog, sheet, sonner, table, tabs, select, popover, calendar.
- Install: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `lucide-react`.
- Add a test runner (Vitest) and `package.json` scripts: `lint`, `typecheck` (`tsc --noEmit`), `test`, `build`.
- Create the route skeleton: `app/(site)/page.tsx` (placeholder "Website"), `app/pos/page.tsx` (placeholder "POS"). Two separate root layouts are not required yet; spec 01 adds the two themes.
- Create folders: `lib/`, `components/site`, `components/booking`, `components/pos`, `components/brand-site`, `components/brand-pos`, `supabase/migrations`, `tools/pc-backup`, `tools/restore`, `docs`.
- `lib/env.ts` validates environment variables with Zod (server and public split). `.env.example` lists every name, no values.
- `robots.txt` that disallows `/pos`.
- Move or copy `context/` to the project root if it is not there.
- Initialize git with a sensible `.gitignore`. The repository will be private.

## Out Of Scope

- Any theme, page content, or database work.

## Notes And Rules

- Read `node_modules/next/dist/docs/` before configuring anything Next.js specific.
- Environment variables to declare now: Supabase URL, anon key, service-role key (server only), site URL, `BACKUP_EXPORT_TOKEN`, `BACKUP_WEBHOOK_TOKEN`, SMS provider key and sender ID, `SMS_MODE`, Turnstile site key and secret, `CRON_SECRET`. Mark the ones not needed until later specs as optional for now.
- One tiny Vitest test proves the runner works.

## Acceptance Criteria

- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` pass.
- [ ] `/` and `/pos` both render placeholders.
- [ ] `.env.example` lists every variable; the app fails fast with a clear message if a required one is missing.
- [ ] `robots.txt` disallows `/pos`.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
