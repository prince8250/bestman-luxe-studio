# 21 · Backup to the Studio PC (while it is on)

## Goal

Automatically keep a full backup and the day report on the studio PC, even though the PC is switched off at night and nobody has to click anything.

## Depends On

- `20-backup-export-endpoints.md`

## Who Can Use This

- Runs unattended on the studio PC. Backup status in the POS: owner only.

## Scope (Build Only This)

- Read `backup-and-recovery.md` Layer 1 again; the schedule is built around a PC that is **off at night**.
- `tools/pc-backup/bestman-backup.ps1`: reads `config.json` (site URL, token, backup folder, retention days); retries downloads up to 3 times a few minutes apart; downloads the export and today's CSV and HTML day reports; writes to temp names, verifies the JSON parses and has row counts, then renames into `<folder>\YYYY\MM\`, **overwriting today's files** from earlier runs; then re-saves the previous business day's day report if it changed since it was saved (this is how the late-evening sales reach the PC the next morning); deletes full backups older than the retention period (reports are kept; one JSON per day); writes `backup-log.txt`; calls the heartbeat with the result.
- `tools/pc-backup/install-task.ps1`: registers a Windows Scheduled Task with a log-on trigger (short delay for the network) and a repetition every 2 hours for the rest of the day. No night trigger, no shutdown trigger.
- `tools/pc-backup/README.md`: plain-language install steps (where the files go, setting the token, running it once by hand, reading the log, pointing the folder into Google Drive or OneDrive for an off-site copy, uninstalling).
- POS (owner): sidebar backup card and `/pos/backups` show the last successful PC backup, warn after 36 hours (with text noting that a closed day with the PC off is normal), and the owner job in spec 19 alerts on days that had sales but no PC backup.

## Out Of Scope

- Weekly cloud backup (spec 22). The browser download at Close day (spec 17).

## Notes And Rules

- The studio PC runs **Windows** (confirmed). Ask the developer for the exact version, and target Windows PowerShell 5.1 (built in), so nothing has to be installed.
- The config file holds a secret token; the README says to keep the folder in the owner's Windows account only.
- You cannot run Windows Task Scheduler here: say so honestly, and give the developer a step-by-step manual test to run on the PC (including: run it, add a sale, run it again and see today's files replaced; turn the PC off and on next day and see yesterday's report finalized).

## Acceptance Criteria

- [ ] Running the script by hand produces today's three files and a success row in `backup_runs`.
- [ ] A second run the same day replaces today's files instead of adding more.
- [ ] The first run on a new day finalizes the previous day's report.
- [ ] With no internet, the script retries, logs the failure, and the next successful run catches up.
- [ ] Retention deletes only full backups older than the setting.

## When Done

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Reply using the explanation format in `context/ai-workflow-rules.md`.
- Update `context/progress-tracker.md`.
- Stop. Do not start the next spec.
