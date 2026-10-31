# Backup to the studio PC

This keeps a copy of all the studio's records on the counter PC, without anyone clicking anything. The PC is switched off at night, so the backup follows the working day: **a few minutes after someone signs in to Windows, then every 2 hours while the PC is on.**

Each run saves, in `C:\BestmanBackups\YEAR\MONTH\`:

| File | What it is |
| --- | --- |
| `bestman-backup-YYYY-MM-DD.json` | Every record (sales, customers, staff, services, settings, history). Used to restore the system. One per day; later runs that day replace it. |
| `day-report-YYYY-MM-DD.csv` | That day's sales for Excel. |
| `day-report-YYYY-MM-DD.html` | The end-of-day report to read or print, even with no internet. |

The run also re-saves the report of earlier days (up to a week back) when they changed, for example a sale entered late in the evening, so yesterday's report is final the next morning. Full backups older than 180 days are deleted; day reports are kept forever (they are tiny). Every run writes a line in `C:\BestmanBackups\backup-log.txt` and tells the POS how it went (the owner sees it on the **Backups** page).

**Privacy**: these files hold customer names and phone numbers, and `config.json` holds the backup password (token). Keep them in the owner's own Windows account, never in a shared or public folder.

## Install (about 10 minutes)

Works on Windows 10 and 11 with what is already installed (Windows PowerShell 5.1).

1. **Copy the files.** Make a folder `C:\BestmanBackup` (the program, not the backups) and copy into it: `bestman-backup.ps1`, `install-task.ps1`, `config.example.json`.
2. **Fill in the settings.** Copy `config.example.json` to `config.json` in the same folder and open it in Notepad:
   - `siteUrl`: the POS address, for example `https://bestman-pos.vercel.app` (no `/pos` at the end).
   - `token`: the value of `BACKUP_EXPORT_TOKEN` from the POS hosting settings (Vercel). The developer gives it to you; it is not the owner's password.
   - `backupFolder`: where the backups go. Default `C:\\BestmanBackups` (in this file every `\` is written twice).
   - `retentionDays`: how long full backups are kept. Default 180.
   Save the file.
3. **Run it once by hand.** Open PowerShell (Start menu, type *PowerShell*) and run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\BestmanBackup\bestman-backup.ps1
   ```
   It should end with `Backup finished.` Check that `C:\BestmanBackups\YEAR\MONTH\` now has today's three files, and that the POS **Backups** page shows a new "Studio PC" line.
4. **Install the schedule.**
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\BestmanBackup\install-task.ps1
   ```
   To see what it would install without changing anything, add `-DryRun`. It appears in Task Scheduler as **Bestman POS backup**. It runs as the signed-in Windows user, only while that user is signed in, so no Windows password is stored.

## Reading the log

Open `C:\BestmanBackups\backup-log.txt` in Notepad. Each run starts with `Backup started` and ends with `Backup finished` or `Backup did not finish`. Common lines:

- `try 1 ... failed (Unable to connect to the remote server); trying again in 120 seconds`: no internet for a moment; it tries 3 times.
- `The POS refused the token (HTTP 401)`: the token in `config.json` is wrong or was changed. Put in the current one.
- `Could not report the result to the POS`: the files were saved, but the POS was not told; the next run will tell it.

If the internet is down for a whole run, nothing is lost: the next run (2 hours later, or at the next sign-in) saves a fresh full backup and catches up the day reports.

## An off-site copy (recommended)

If the PC is stolen or its disk fails, a copy outside the building helps. Install **Google Drive for desktop** (or use **OneDrive**, built into Windows), signed in with the owner's account, then set `backupFolder` in `config.json` to a folder inside it, for example `G:\\My Drive\\BestmanBackups` or `C:\\Users\\<name>\\OneDrive\\BestmanBackups`. Every backup is then copied to the cloud automatically.

## Check it works (test on the studio PC)

1. Run it by hand (step 3 above): today's three files appear.
2. Make a test sale in the POS, then run it again: today's files are **replaced** (same names, newer time), not added to.
3. Turn the internet off (Wi-Fi off) and run it: the log shows 3 tries and `Backup did not finish`. Turn the internet back on and run it again: `Backup finished`.
4. Leave the PC off overnight. The next morning, after signing in, wait about 5 minutes: the log shows a run, and yesterday's day report has the evening's last sales (open the HTML file).

## Remove it

```powershell
powershell -ExecutionPolicy Bypass -File C:\BestmanBackup\install-task.ps1 -Uninstall
```

This removes the schedule only; the backup files stay.

## For the developer

- The script calls `GET /api/backup/export` (a gzip file it unpacks and checks: valid JSON, format `bestman-backup`, row counts present), `GET /api/backup/day-report?date=&format=csv|html`, and `POST /api/backup/heartbeat` (`kind: daily_pc`), all with `Authorization: Bearer <BACKUP_EXPORT_TOKEN>` (spec 20).
- Files are written as `*.partial` and checked before they replace anything; a run cut off half-way leaves only `.partial` files, removed by the next run.
- Business dates are Accra dates (UTC all year).
- Optional settings in `config.json`: `retryDelaySeconds` (default 120), `catchUpDays` (default 7).
- To restore from a backup file, see `docs/restore-guide.md` (spec 22) and `npm run restore:import`.
