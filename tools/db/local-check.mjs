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

async function run(label, sql) {
  try {
    await db.exec(sql);
    console.log(`✓ ${label}`);
  } catch (error) {
    console.error(`✖ ${label}\n  ${error.message}${error.where ? `\n  where: ${error.where}` : ""}`);
    process.exit(1);
  }
}

await run("Supabase stand-in", supabaseStandIn);

const migrationsDir = path.join(root, "supabase/migrations");
for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
  await run(`migration ${file}`, readFileSync(path.join(migrationsDir, file), "utf8"));
}

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
