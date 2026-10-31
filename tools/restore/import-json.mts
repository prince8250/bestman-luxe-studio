// Restores a daily JSON backup into an EMPTY TEST Supabase project (spec 20,
// backup-and-recovery.md "Restore Guide", path 2). Never production.
//
//   1. Create a new Supabase project and apply every migration to it
//      (supabase link --project-ref <test ref>, then supabase db push).
//   2. Put these in .env.restore (or the environment):
//        RESTORE_SUPABASE_URL=https://<test ref>.supabase.co
//        RESTORE_SUPABASE_SERVICE_ROLE_KEY=<that project's service-role key>
//        RESTORE_ALLOWED_PROJECT_REFS=<test ref>[,<another test ref>]
//        PRODUCTION_PROJECT_REF=<the live project's ref>
//   3. npm run restore:import -- path/to/bestman-backup-YYYY-MM-DD.json(.gz)
//
// It refuses to run when the file's schema_version is not the newest
// migration here, or when the target is not an allowed test project (the ref
// is read from the URL; the production ref is always refused). Then it
// recreates every POS login with its original id and a long random password
// (never printed; set new ones with "New password" in POS Settings, or the
// Supabase dashboard for the owner), restores the tables in order, and
// compares the row counts and the last day's revenue with the file.
//
// Plain TypeScript (.mts) run by Node itself (type stripping), so it imports no app
// code: only Node and @supabase/supabase-js.

import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

import { createClient } from "@supabase/supabase-js";

const BATCH = 500;

type Row = Record<string, unknown>;

export interface RestoreSnapshot {
  format: string;
  schema_version: string;
  tables: Record<string, Row[]>;
  pos_accounts: { id: string; email: string | null; display_name: string; role: string; active: boolean }[];
  row_counts: Record<string, number>;
}

// "https://abcd.supabase.co", "HTTPS://ABCD.supabase.co/", or with a path ->
// "abcd". Anything else (another host, not https, no ref) -> null.
export function parseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname.toLowerCase());
  return parsed.protocol === "https:" && match ? match[1] : null;
}

// Throws (before anything is written) unless the target is an allowed test project.
export function checkTarget(env: Record<string, string | undefined>): { ref: string; url: string } {
  const url = env.RESTORE_SUPABASE_URL;
  const ref = parseProjectRef(url);
  if (!ref || !url) throw new Error("RESTORE_SUPABASE_URL is missing or is not a https://<ref>.supabase.co address.");
  const allowed = (env.RESTORE_ALLOWED_PROJECT_REFS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) throw new Error("RESTORE_ALLOWED_PROJECT_REFS is not set: list the test project refs that may be restored into.");
  const production = (env.PRODUCTION_PROJECT_REF ?? "").trim().toLowerCase();
  if (!production) throw new Error("PRODUCTION_PROJECT_REF is not set: give the live project's ref so it can never be the target.");
  if (ref === production) throw new Error(`${ref} is the production project. A restore only goes into a test project.`);
  if (!allowed.includes(ref)) throw new Error(`${ref} is not in RESTORE_ALLOWED_PROJECT_REFS.`);
  if (!env.RESTORE_SUPABASE_SERVICE_ROLE_KEY) throw new Error("RESTORE_SUPABASE_SERVICE_ROLE_KEY is not set.");
  return { ref, url };
}

export function newestMigration(migrationsDir: string): string {
  const newest = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort().at(-1);
  if (!newest) throw new Error(`No migrations in ${migrationsDir}.`);
  return newest.slice(0, 14);
}

export function readSnapshot(file: string): RestoreSnapshot {
  const raw = readFileSync(file);
  const text = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  const snapshot = JSON.parse(text) as RestoreSnapshot;
  if (snapshot.format !== "bestman-backup" || !snapshot.tables || !snapshot.row_counts || !Array.isArray(snapshot.pos_accounts)) {
    throw new Error(`${file} is not a Bestman backup file.`);
  }
  return snapshot;
}

export function checkSchemaVersion(snapshot: RestoreSnapshot, expected: string): void {
  if (snapshot.schema_version !== expected) {
    throw new Error(
      `The backup was made with schema ${snapshot.schema_version}, but these migrations are ${expected}. ` +
        "Restore it with the code version that made it (check out that commit), or take a new backup.",
    );
  }
}

// The newest business day with paid sales, and its revenue (pesewas).
export function lastDayRevenue(sales: Row[]): { business_date: string | null; revenue: number } {
  const paid = sales.filter((sale) => sale.status === "paid");
  const last = paid.map((sale) => String(sale.business_date)).sort().at(-1) ?? null;
  const revenue = paid.filter((sale) => String(sale.business_date) === last).reduce((sum, sale) => sum + Number(sale.total), 0);
  return { business_date: last, revenue };
}

export function batches<T>(rows: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < rows.length; start += size) out.push(rows.slice(start, start + size));
  return out;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run restore:import -- <bestman-backup-YYYY-MM-DD.json or .json.gz>");
  if (existsSync(path.join(root, ".env.restore"))) process.loadEnvFile(path.join(root, ".env.restore"));

  // Every check before anything is written.
  const target = checkTarget(process.env);
  const snapshot = readSnapshot(path.resolve(file));
  checkSchemaVersion(snapshot, newestMigration(path.join(root, "supabase", "migrations")));
  console.log(`Restoring ${path.basename(file)} (schema ${snapshot.schema_version}) into test project ${target.ref}.`);

  const supabase = createClient(target.url, process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const begin = await supabase.rpc("restore_begin");
  if (begin.error) throw new Error(`The target refused the restore: ${begin.error.message} ${begin.error.details ?? ""}`);

  // Logins first, with their original ids: every sale, void, close, and
  // change points at them. Stop before any business row if one fails.
  for (const account of snapshot.pos_accounts) {
    const existing = await supabase.auth.admin.getUserById(account.id);
    if (existing.data.user) {
      console.log(`  login ${account.display_name}: already there`);
      continue;
    }
    if (!account.email) throw new Error(`The login of ${account.display_name} has no email; nothing was restored.`);
    const created = await supabase.auth.admin.createUser({
      id: account.id,
      email: account.email,
      password: randomBytes(32).toString("base64url"),
      email_confirm: true,
    });
    if (created.error) throw new Error(`Could not recreate the login of ${account.display_name}: ${created.error.message}. Nothing else was restored.`);
    console.log(`  login ${account.display_name} (${account.role}) recreated`);
  }

  for (const [table, rows] of Object.entries(snapshot.tables)) {
    for (const batch of batches(rows)) {
      const { error } = await supabase.rpc("restore_table", { p_table: table, p_rows: batch });
      if (error) throw new Error(`Restoring ${table} failed: ${error.message} ${error.details ?? ""}`);
    }
    console.log(`  ${table}: ${rows.length}`);
  }

  const links = (snapshot.tables.sales ?? []).filter((sale) => sale.appointment_id).map((sale) => ({ id: sale.id, appointment_id: sale.appointment_id }));
  const finish = await supabase.rpc("restore_finish", { p_links: links });
  if (finish.error) throw new Error(`Finishing the restore failed: ${finish.error.message}`);
  const result = finish.data as { row_counts: Record<string, number>; last_day: { business_date: string | null; revenue: number } };

  const differences = Object.keys(snapshot.tables).filter((table) => Number(result.row_counts[table]) !== snapshot.row_counts[table]);
  const expected = lastDayRevenue(snapshot.tables.sales ?? []);
  const revenueMatches = expected.business_date === result.last_day.business_date && expected.revenue === Number(result.last_day.revenue);
  console.log(
    `\nRow counts: ${differences.length === 0 ? "all match" : `DIFFERENT for ${differences.join(", ")}`}.` +
      `\nLast day ${expected.business_date}: revenue ${(expected.revenue / 100).toFixed(2)} in the file, ` +
      `${(Number(result.last_day.revenue) / 100).toFixed(2)} restored ${revenueMatches ? "(match)" : "(DIFFERENT)"}.` +
      "\nNext: set new passwords for the logins, point a copy of the app at this project, and compare that day with its saved day report.",
  );
  if (differences.length > 0 || !revenueMatches) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(`Restore stopped: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
