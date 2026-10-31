# Restore guide (first draft, spec 22; finished after the restore drill, spec 38)

The studio's records live in Supabase. Three independent copies protect them (backup-and-recovery.md):

| Copy | Where | How often | Restore with |
| --- | --- | --- | --- |
| Daily JSON `bestman-backup-YYYY-MM-DD.json` | The studio PC, `C:\BestmanBackups\YYYY\MM\` (and Google Drive or OneDrive if set up) | At log-on and every 2 hours while the PC is on | `npm run restore:import` (path B) |
| Weekly dump `weekly/bestman-YYYY-MM-DD.dump` | The private `backups` bucket in Supabase Storage; download it from POS > Backups | Every Sunday 23:23 UTC | `pg_restore` (path A) |
| Supabase daily backups | Supabase, Pro plan | Daily, 7 days kept | The Supabase dashboard (path C) |

The day reports (`day-report-YYYY-MM-DD.csv` / `.html`) are for people, not for restoring: use them to check a restore (last section).

**Always restore into a new, empty project first, never over the live one.** Check it, then point the app at it.

## Setting up the weekly cloud backup (developer, once)

The workflow is `.github/workflows/weekly-backup.yml`; the work is in `tools/cloud-backup/weekly-backup.sh`.

1. **The repository is private** (GitHub > Settings > General > Danger Zone > Change visibility). Free private repositories have 2,000 Actions minutes a month; one run takes about 2.
2. **Add the secrets** in GitHub > Settings > Secrets and variables > Actions > New repository secret (never in a file):
   - `SUPABASE_DB_URL`: Supabase dashboard > the project > **Connect** > **Session pooler** connection string, with the database password filled in: `postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres`. The session pooler is used because GitHub's runners have no IPv6 and the direct connection is IPv6-only (unless you buy the IPv4 add-on).
   - `SUPABASE_URL`: `https://<ref>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: dashboard > Project Settings > API keys > service_role.
   - `BACKUP_WEBHOOK_TOKEN`: the same value as in the POS's environment (Vercel).
   - `POS_URL`: the POS address, for example `https://bestman-pos.vercel.app`. Until the POS is deployed, leave it out: the run then writes its `backup_runs` row straight into the database.
3. **Merge `dev` into `main`.** GitHub runs scheduled workflows, and shows the "Run workflow" button, only for workflows on the default branch.
4. **Run it once by hand:** GitHub > Actions > Weekly cloud backup > Run workflow. It should end with "Weekly backup finished", the file should appear in POS > Backups > Weekly cloud backups, and a "Weekly cloud" row in Recent backups.

If a run fails, the step's log on GitHub says why (wrong password, pooler unreachable, bucket full), and a "Failed" row appears in POS > Backups. A dump bigger than the bucket's 50 MB limit needs the limit raised (Storage > backups > Edit bucket).

## Path A: from a weekly dump (`pg_restore`)

The dump holds the POS schemas (`public`, `private`, `supabase_migrations`) with their tables, functions, policies, and data, plus the login tables (`auth`). You need the PostgreSQL client tools of the same major version as Supabase (17): on Windows, install PostgreSQL 17 (only "Command Line Tools") from postgresql.org.

1. Create a new Supabase project (same region if possible). Note its database password and its **Session pooler** connection string (`NEW_DB` below).
2. Download the dump (POS > Backups > Weekly cloud backups > Download).
3. In the new project's SQL editor, turn on the extensions the POS uses:
   ```sql
   create extension if not exists btree_gist with schema extensions;
   create extension if not exists pgcrypto with schema extensions;
   ```
4. Restore the logins first (their ids are referenced by every sale, close, and change):
   ```bash
   pg_restore -l bestman-YYYY-MM-DD.dump | grep -E "TABLE DATA auth (users|identities) " > auth.list
   pg_restore -L auth.list --data-only --no-owner -d "$NEW_DB" bestman-YYYY-MM-DD.dump
   ```
5. Restore the POS schemas (tables, data, then constraints and triggers):
   ```bash
   pg_restore --no-owner -n public -n private -n supabase_migrations -d "$NEW_DB" bestman-YYYY-MM-DD.dump
   ```
   An error like `schema "public" already exists` is expected; anything else, read it.
6. Recreate the storage buckets and their rules: run the part of `supabase/migrations/20261030120500_security.sql` that starts at `-- Storage: three public-read image buckets` (the buckets and their policies) in the SQL editor. Re-upload staff, service, and gallery photos from the owner's phone if they are needed (their file names are in the restored tables).
7. Check the result (last section), then point the app at the new project (below).

Passwords are kept with this path (the login tables are restored as they were).

## Path B: from a daily JSON (`npm run restore:import`)

1. Create a new Supabase project. Link this repository to it and apply every migration:
   ```bash
   npx supabase link --project-ref <new ref>
   npx supabase db push
   ```
   Use the code version that made the backup: the file's `schema_version` is the newest migration it expects. A recent backup works with the current code; an older one needs the commit whose newest migration matches (`git log -- supabase/migrations`).
2. Create `.env.restore` in the repository (it is not committed):
   ```
   RESTORE_SUPABASE_URL=https://<new ref>.supabase.co
   RESTORE_SUPABASE_SERVICE_ROLE_KEY=<the new project's service-role key>
   RESTORE_ALLOWED_PROJECT_REFS=<new ref>
   PRODUCTION_PROJECT_REF=<the live (or lost) project's ref>
   ```
3. Run it:
   ```bash
   npm run restore:import -- path\to\bestman-backup-YYYY-MM-DD.json
   ```
   It refuses production, any project not listed, and any project that already has data. It recreates every POS login with its original id and a random password (never shown), restores the tables in order, and prints whether the row counts and the last day's revenue match the file.
4. Set new passwords: the owner's in the Supabase dashboard (Authentication > Users), the counter accounts' with "New password" in POS Settings. Re-upload photos if needed.

## Path C: Supabase's own backups (Pro plan)

Supabase dashboard > the project > Database > Backups: restore a daily backup (the last 7 days). This replaces the project's data with that day's, so use it only when the live data itself is wrong, and check with the day reports afterwards.

## Point the app at the restored project

In Vercel > the project > Settings > Environment Variables, change `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the new project's values, then redeploy (the public values are built into the app). Update the GitHub secrets for the weekly backup the same way.

## Check a restore

1. Sign in to the restored POS as the owner and as a counter account (after setting passwords).
2. Open Reports > Daily for the last full day before the backup and compare revenue, number of sales, payment methods, and services per staff with that day's saved `day-report-YYYY-MM-DD.html`.
3. Open a sale from that day: the "Recorded by" name must be the right person.
4. Sales made after the backup are not in it: enter them from the paper sheets or receipts with "Record a past sale".

Record each drill (date, file, path, result) in `context/progress-tracker.md`.
