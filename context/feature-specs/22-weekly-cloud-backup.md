# 22 · Weekly Cloud Backup and the Backups Page

## Goal

A weekly full database dump in the cloud, visible and downloadable in the POS.

## Depends On

- `20-backup-export-endpoints.md`

## Who Can Use This

- Runs unattended in GitHub Actions. Backups page: owner only.

## Scope (Build Only This)

- `.github/workflows/weekly-backup.yml`: Sunday 23:00 UTC plus manual run; installs a `pg_dump` matching the Supabase Postgres major version; dumps (custom format) via the session pooler connection string from a GitHub secret; uploads to the private `backups` bucket at `weekly/bestman-YYYY-MM-DD.dump` with the service role; deletes dumps older than 12 weeks; posts a heartbeat with `BACKUP_WEBHOOK_TOKEN`. A failed step still posts a failure heartbeat.
- `/pos/backups` page (owner only): recent runs (daily PC, weekly cloud, manual) with status, time, size, row counts; download weekly dumps through short-lived signed URLs; the manual buttons from spec 20; warnings when the last daily is older than 36 hours or the last weekly older than 8 days.
- `docs/restore-guide.md` first draft (finished in spec 38): restoring a weekly dump with `pg_restore`, restoring a daily JSON with `tools/restore/import-json.ts`, and checking the result against a day report.

## Out Of Scope

- Supabase Pro backups (configured at launch, spec 38).

## Notes And Rules

- Read current Supabase docs on connection strings and `pg_dump`, and current GitHub docs on scheduled workflows. Do not rely on memory.
- Ask the developer to add the GitHub secrets; never put them in the workflow file.

## Screen Check

- POS: verify at 1280px first, then 768px (tablet) and 375px (phone).
- Buttons and inputs at least 44px tall; keyboard and mouse both work.
- Loading (skeletons), empty, and error states exist where data is fetched.

## Acceptance Criteria

- [ ] A manual run of the workflow produces a dump in the bucket and a success row.
- [ ] The Backups page lists runs and downloads a weekly dump.
- [ ] Stale-backup warnings appear when expected.
- [ ] A weekly dump restores into a test project (documented in the tracker).

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
