# 20 · Backup Export Endpoints and Manual Download

## Goal

The secured endpoints the PC script and GitHub Actions call, plus manual download buttons in the POS.

## Depends On

- `16-pos-reports.md`

## Who Can Use This

- Endpoints: the PC script and GitHub Actions, by token only.
- Manual download buttons: owner only.

## Scope (Build Only This)

- Read `backup-and-recovery.md` fully.
- `lib/backup/export.ts` (server-only): builds the full JSON snapshot of every business table, **paginating every table** past the 1000-row API limit, with `schema_version`, `generated_at`, and row counts.
- `GET /api/backup/export` (bearer `BACKUP_EXPORT_TOKEN`): returns the snapshot gzip-compressed.
- `GET /api/backup/day-report?date=YYYY-MM-DD&format=csv|html` (same token): reuses the spec 16 day report.
- `POST /api/backup/heartbeat` (accepts either token): validates the body with Zod and writes a `backup_runs` row.
- POS: on `/pos/backups` (page body can stay minimal until spec 22), buttons **Download backup now** (owner session only, same JSON) and **Download day report**. Manual downloads write a `manual_download` row.
- `tools/restore/import-json.ts`: imports a snapshot into an **empty test project** (after migrations), in dependency order, resetting sequences; refuses to run if `schema_version` differs or if the target URL matches production.

## Out Of Scope

- The PowerShell script (spec 21). The weekly workflow (spec 22).

## Notes And Rules

- Constant-time token comparison; tokens never logged; wrong token returns 401 with no details.
- Test: a table seeded with more than 1000 rows exports completely; an export then import into a test project reproduces identical row counts and the same day's revenue.

## Acceptance Criteria

- [ ] The export is complete beyond 1000 rows per table.
- [ ] Endpoints reject missing or wrong tokens.
- [ ] Export then import into a test project reproduces the data (row counts and one day's revenue match).
- [ ] Manual download works from the POS and is recorded.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
