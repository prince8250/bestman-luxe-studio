// Offline check of the database code, with no Docker and no network:
// runs every migration, the sample seed, and the SQL tests in PGlite
// (real Postgres compiled to WebAssembly), on a throwaway in-memory database.
//
//   npm run test:db:local
//
// Supabase's own schemas (auth, storage) and roles (anon, authenticated,
// service_role) do not exist in plain Postgres, so a small stand-in is created
// first. The real check is npm run test:db on the development project; this
// one catches mistakes in seconds.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const db = new PGlite({ extensions: { btree_gist, pgcrypto } });

const supabaseStandIn = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key, instance_id uuid, aud text, role text, email text,
    raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant execute on function auth.jwt() to anon, authenticated, service_role;
  create table auth.sessions (id uuid primary key, user_id uuid not null, not_after timestamptz);
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public to anon, authenticated, service_role;
`;

async function run(label, sql, database = db) {
  try {
    await database.exec(sql);
    console.log(`✓ ${label}`);
  } catch (error) {
    console.error(`✖ ${label}\n  ${error.message}${error.where ? `\n  where: ${error.where}` : ""}`);
    process.exit(1);
  }
}

const migrationsDir = path.join(root, "supabase/migrations");
async function migrate(database, quiet = false) {
  await run(quiet ? "Supabase stand-in (restore target)" : "Supabase stand-in", supabaseStandIn, database);
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    if (quiet) await database.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
    else await run(`migration ${file}`, readFileSync(path.join(migrationsDir, file), "utf8"), database);
  }
  if (quiet) console.log("✓ migrations (restore target)");
}
await migrate(db);

// Seed with two POS users so the sales part runs too.
await run("test POS users for the seed", `
  insert into auth.users (id, email) values
    ('00000000-0000-4000-8000-0000000000a1', 'owner@bestman.test'),
    ('00000000-0000-4000-8000-0000000000a2', 'counter@bestman.test');
  insert into public.profiles (id, display_name, role) values
    ('00000000-0000-4000-8000-0000000000a1', 'Test Owner', 'owner'),
    ('00000000-0000-4000-8000-0000000000a2', 'Abena (counter)', 'counter');
`);
await run("seed.sql", readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));

const counts = await db.query(`
  select (select count(*) from public.services) as services, (select count(*) from public.staff) as staff,
         (select count(*) from public.sales) as sales, (select count(*) from public.sales where status = 'voided') as voided,
         (select count(*) from public.appointments) as appointments, (select count(*) from public.day_closes) as closes,
         (select count(*) from private.sample_rows) as registered
`);
console.log("  sample rows:", counts.rows[0]);

let failed = 0;
for (const file of readdirSync(path.join(root, "supabase/tests")).filter((name) => name.endsWith(".test.sql")).sort()) {
  try {
    await db.exec(`begin;\n${readFileSync(path.join(root, "supabase/tests", file), "utf8")}`);
    console.error(`✖ ${file} did not report results`);
    failed += 1;
  } catch (error) {
    await db.exec("rollback;").catch(() => {});
    const marker = /DB_TEST_RESULTS failed=(\d+) total=(\d+)/.exec(error.message);
    if (!marker) {
      console.error(`✖ ${file} stopped early: ${error.message}${error.where ? `\n  where: ${error.where}` : ""}`);
      failed += 1;
      continue;
    }
    console.log(`\n# ${file}`);
    for (const line of error.message.split("\n").filter((l) => /^(not )?ok \d+/.test(l))) console.log(line);
    console.log(`# ${Number(marker[2]) - Number(marker[1])}/${marker[2]} passed`);
    if (Number(marker[1]) > 0) failed += 1;
  }
}

// Restore round trip (spec 20): export every backup table as lib/backup does
// (one JSON array per table, in dependency order), with one table past 1,000
// rows; restore into a second database that has only the migrations, the way
// tools/restore/import-json.ts does (accounts first, then restore_begin,
// restore_table in batches of 500, restore_finish); compare.
await run(
  "1,200 extra sign-ins (a table past 1,000 rows)",
  `insert into public.sign_in_events (profile_id, signed_in_at)
   select '00000000-0000-4000-8000-0000000000a2', now() - make_interval(mins => g) from generate_series(1, 1200) g;`,
);
const backupTables = (await db.query("select private.backup_tables() as tables")).rows[0].tables;
const snapshot = {};
for (const table of backupTables) {
  snapshot[table] = (await db.query(`select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as rows from public.${table} t`)).rows[0].rows;
}
const accounts = (await db.query("select u.id, u.email from auth.users u join public.profiles p on p.id = u.id")).rows;
const lastDay = async (database) =>
  (
    await database.query(`select d::text as business_date, (select coalesce(sum(total), 0) from public.sales where status = 'paid' and business_date = d)::int as revenue
                          from (select max(business_date) as d from public.sales where status = 'paid') x`)
  ).rows[0];

const target = new PGlite({ extensions: { btree_gist, pgcrypto } });
await migrate(target, true);
try {
  for (const account of accounts) await target.query("insert into auth.users (id, email) values ($1, $2)", [account.id, account.email]);
  await target.query("select public.restore_begin()");
  for (const table of backupTables) {
    for (let start = 0; start < snapshot[table].length; start += 500) {
      await target.query("select public.restore_table($1, $2::jsonb)", [table, JSON.stringify(snapshot[table].slice(start, start + 500))]);
    }
  }
  const links = snapshot.sales.filter((row) => row.appointment_id).map((row) => ({ id: row.id, appointment_id: row.appointment_id }));
  const finished = (await target.query("select public.restore_finish($1::jsonb) as result", [JSON.stringify(links)])).rows[0].result;

  const mismatched = backupTables.filter((table) => Number(finished.row_counts[table]) !== snapshot[table].length);
  const [sourceDay, targetDay] = [await lastDay(db), await lastDay(target)];
  const checks = (
    await target.query(`
      select
        (select count(*) from public.sales s where s.total <> (select coalesce(sum(line_total), 0) from public.sale_items i where i.sale_id = s.id)
           or s.total <> (select coalesce(sum(amount), 0) from public.sale_payments p where p.sale_id = s.id))::int as unbalanced,
        (select count(*) from public.sales where appointment_id is not null)::int as linked,
        (private.next_receipt_no() > (select max(receipt_no) from public.sales)) as receipts_continue`)
  ).rows[0];
  const ok =
    mismatched.length === 0 &&
    snapshot.sign_in_events.length > 1000 &&
    sourceDay.revenue === targetDay.revenue &&
    sourceDay.business_date === targetDay.business_date &&
    checks.unbalanced === 0 &&
    checks.linked === links.length &&
    checks.receipts_continue;
  console.log(
    `${ok ? "✓" : "✖"} restore round trip: ${backupTables.length} tables, ${snapshot.sign_in_events.length} sign-ins, ` +
      `last day ${targetDay.business_date} revenue ${targetDay.revenue} (source ${sourceDay.revenue}), ` +
      `${checks.linked} appointment links, unbalanced sales ${checks.unbalanced}, receipts continue: ${checks.receipts_continue}` +
      (mismatched.length ? `, row counts differ: ${mismatched.join(", ")}` : ""),
  );
  if (!ok) failed += 1;
} catch (error) {
  console.error(`✖ restore round trip stopped: ${error.message}${error.where ? `\n  where: ${error.where}` : ""}`);
  failed += 1;
}

// Removing sample data leaves nothing sample behind.
await run("remove_sample_data()", "select public.remove_sample_data(false);");
const after = await db.query(`
  select (select count(*) from public.sales) as sales, (select count(*) from public.staff) as staff,
         (select count(*) from public.services) as services, (select count(*) from public.customers) as customers,
         (select count(*) from public.appointments) as appointments, (select count(*) from private.sample_rows) as registered
`);
console.log("  after removal:", after.rows[0]);
const left = Object.values(after.rows[0]).reduce((sum, value) => sum + Number(value), 0);
if (left !== 0) {
  console.error("✖ sample data was not fully removed");
  failed += 1;
}

await db.close();
process.exit(failed > 0 ? 1 : 0);
