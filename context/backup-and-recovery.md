# Backup and Recovery

The goal: **the studio never loses its records**, even if the cloud provider, the internet, or the studio PC fails. Three independent copies, in two different places, plus a habit of testing restores.

## What Can Go Wrong, And What Protects Against It

| Risk | Protection |
| --- | --- |
| A bad migration, a bug, or an accidental bulk change corrupts data | Daily PC backups (go back to any day), weekly cloud dumps, Supabase Pro daily backups |
| The Supabase project is lost, suspended, or unpaid | The PC holds a full copy from the last time it was on (usually the same day) |
| The studio PC dies, is stolen, or the disk fails | The cloud database itself, plus weekly dumps in the cloud |
| The internet is down at the studio | Sales are written on paper and entered later with "Record a past sale". (Offline POS mode is a later feature) |
| The PC is switched off at night | Backups run while the PC is on: at start-up and every 2 hours. The cloud database is the main record anyway, so the PC copy only needs to catch up the next time the PC starts |
| Nobody notices backups stopped working | `backup_runs` records every run; the owner's sidebar shows the last successful backup, turns red when it is stale, and the owner gets an SMS on any day that had sales but no successful PC backup by closing (checked by the 23:30 owner job) |

## Why Not "Save To The PC" From The Browser?

A website cannot write files on a schedule by itself. Browsers only write files when the page is open, and either the user clicks a download or (in Chrome only) the user has granted folder access in that session. If nobody opens the POS on a Sunday, nothing would be saved. So the reliable path is a **small scheduled script on the PC** that runs even when the browser is closed. The browser download buttons stay as a manual fallback.

## Layer 1: Backup On The Studio PC (automatic, while the PC is on)

The studio PC is **not** left on overnight, so nothing is scheduled for the night. Instead the backup follows the working day.

**What gets saved, for every day the PC is used:**

| File | What it is | Who it is for |
| --- | --- | --- |
| `bestman-backup-YYYY-MM-DD.json` | A **full snapshot** of every business table (not just that day), with `schema_version`, `generated_at`, and row counts | Restoring the system |
| `day-report-YYYY-MM-DD.csv` | That day's sales, line by line: receipt no, time, customer, service, staff, price, payment method, voided or not, backdated or not | Opening in Excel |
| `day-report-YYYY-MM-DD.html` | The readable end-of-day report: totals, by payment method, by staff, by service, voids, edits made that day | Reading or printing, even with no internet |

Because each JSON file is a full snapshot, **the newest file alone is enough to restore**. Older files let you go back in time.

Within a day, each run **overwrites that day's files** with a fresher snapshot, so the folder holds one set of files per day, and the last run before shutdown has almost the whole day. The run at next morning's start-up then saves the **final** version of the previous day's report (including anything entered late or after close) before starting today's.

**Folder**: `C:\BestmanBackups\YYYY\MM\` by default (configurable). Recommended: point it inside the owner's Google Drive for desktop (or OneDrive) folder so a copy also leaves the building automatically.

**How it works:**

1. `tools/pc-backup/bestman-backup.ps1` (PowerShell, built into Windows, nothing to install) calls:
   - `GET /api/backup/export` → the full JSON snapshot
   - `GET /api/backup/day-report?date=YYYY-MM-DD&format=csv` and `&format=html`
   with `Authorization: Bearer <BACKUP_EXPORT_TOKEN>`.
2. It writes the files to a temp name first (and retries the downloads up to 3 times if the network is down), checks the JSON parses and the row counts are present, then renames them into place (so a half-written file never looks like a good backup).
3. It deletes full JSON backups older than the retention period (default 180 days). Day reports are tiny and are kept forever. Only one JSON is kept per day (the latest run of that day).
4. It calls `POST /api/backup/heartbeat` with the result (success or failure, file names, sizes, row counts), which writes a `backup_runs` row.
5. It writes a local log file `backup-log.txt` in the backup folder.

**Schedule**: `tools/pc-backup/install-task.ps1` registers a Windows Scheduled Task with:
- a trigger at user log-on (a few minutes after start-up, once the network is up),
- a repeating trigger every **2 hours** while the PC is on (from log-on, for the rest of the day),
- "Run only if network connection is available" turned **off** (the script itself retries 3 times a few minutes apart and logs the failure if still offline, so a failed run is visible rather than silently skipped),
- no night-time triggers.

Each run: saves today's snapshot and today's day report (overwriting earlier ones from today), then checks the most recent previous business day and re-saves its day report if the stored one is older than that day's last change. Do not rely on a shutdown trigger; Windows does not give scheduled tasks enough time during shutdown to be reliable.

**Close day adds a browser copy**: when the counter runs Close day, the POS also downloads that day's CSV and HTML day report through the browser into the PC's Downloads folder. That copy exists even if the scheduled task was never installed or is broken.
- This is the **only** report a counter user can get, and only **after** the day is closed: the download action (permission `day.closeReport`) checks on the server that the requested business date has an active close, then calls the report function `report_day_close_export(business_date)`, which is callable by a counter user only for a date that is closed (and by the owner for any date). Before the close, the counter cannot load any report or expected figure, so the count stays blind. Every other report function stays owner-only.

**Endpoint rules:**
- The export reads with the service-role client in a server-only module.
- Supabase's API returns at most 1000 rows per request by default, so the export **must paginate every table**. A test proves an export of a table with more than 1000 rows is complete.
- Excluded: `rate_limits` (temporary), Supabase auth tables (not ours), storage files (images are recoverable from the owner's phone and are listed by path in the export).
- Included for account recovery: a `pos_accounts` list with each POS user's auth id (the same as `profiles.id`), email, display name, role, and active flag. **Never** password hashes, tokens, or sessions.
- The response is gzip-compressed and streams if large.
- The token is long (at least 32 random bytes), stored as a server env var, compared in constant time, and never logged. If the token leaks, generate a new one, update the env var and the script config, and redeploy.

**Privacy**: these files contain customer names and phone numbers. Keep the folder in the owner's Windows account, not a shared or public folder.

## Layer 2: Weekly Backup In The Cloud (automatic)

1. A GitHub Actions workflow (`.github/workflows/weekly-backup.yml`) runs every **Sunday at 23:00 UTC** (Accra time is UTC+0) and can also be run manually.
2. It runs `pg_dump` (custom format, compressed) against the production database.
   - Use the Supabase **session pooler** connection string. The direct connection is IPv6, and GitHub's runners may not reach it. Verify this in current Supabase docs at build time.
   - The `pg_dump` major version must match (or be newer than) the Supabase Postgres version.
   - The connection string is a GitHub secret.
3. It uploads the file to the private `backups` bucket as `weekly/bestman-YYYY-MM-DD.dump`.
4. It calls the heartbeat endpoint (with `BACKUP_WEBHOOK_TOKEN`) to write a `backup_runs` row.
5. It deletes weekly dumps older than **12 weeks**.
6. The repository must be **private** (it holds the schema and workflow; secrets stay in GitHub secrets). Check current GitHub rules for scheduled workflows and free minutes; one run takes a minute or two.

**In the POS, Backups page (owner only):** list of recent runs (daily PC and weekly cloud) with status, time, size and row counts; download buttons for weekly dumps (short-lived signed URLs); "Download backup now" (full JSON, same as the PC file) and "Download day report"; a clear warning when the last successful PC backup is older than 36 hours (a weekend or a public holiday with the PC off is normal; the warning text says so) or the last weekly is older than 8 days.

## Layer 3: Supabase's Own Backups

Supabase's free plan has **no automatic backups** and pauses projects after a week of inactivity. The Pro plan (about $25/month at the time of writing) adds daily backups with 7-day retention and no pausing. For a commercial client, **production must be on Pro** (and Vercel Pro, since Vercel Hobby is non-commercial only). Recheck current pricing before quoting the client.

## Restore Guide (drafted in spec 22, finished in spec 38, as `docs/restore-guide.md`)

Three restore paths, all practiced against a **test** Supabase project, never production:

1. **From a weekly dump**: create an empty project, run `pg_restore` with the dump. This restores schema, functions, data, everything.
2. **From a daily PC JSON**: create a project, apply all migrations from `supabase/migrations`, then run `tools/restore/import-json.ts <file>` which inserts the rows in dependency order and resets sequences (for example `receipt_no`). The JSON's `schema_version` must match the migrations; the script refuses to run if it does not.
   - **Accounts**: auth users are not in the JSON, but every history row points at them (`sales.created_by`, `voided_by`, `closed_by`, `audit_log.actor_id`). Before inserting `profiles`, the script recreates each entry of `pos_accounts` with the Supabase admin API **using the same user id** and a long random temporary password (never printed; the owner sets new passwords afterwards with the reset flow in spec 07). Because the ids are unchanged, every sale, void, close, and change stays attributed to the same person. If an account cannot be recreated, the script stops before inserting any business rows.
3. **From Supabase Pro backups**: through the Supabase dashboard.

After any restore: re-upload storage images if needed, point the app's env vars at the restored project, and check the totals of the last full day against that day's saved day report.

## Restore Drill

- Before launch: restore one weekly dump **and** one daily JSON into a test project, compare row counts and one day's revenue with the day report, and **sign in to the restored POS** as the owner and as a counter user (after setting new passwords), checking that a restored sale shows the right "recorded by" name. Record the result in the tracker. **Launch is blocked until this passes.**
- After launch: repeat every 3 months, and after any big migration.

A backup that has never been restored is a hope, not a backup.
