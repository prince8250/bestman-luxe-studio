// Loads SAMPLE data into the DEVELOPMENT Supabase project.
//
//   npm run db:seed
//
// 1. Creates (or reuses) a test owner and a test counter account with the
//    Supabase admin API, and their POS profiles. Their emails and passwords
//    are generated once and saved in .env.local (gitignored), never printed.
// 2. Uploads the starter studio photos to the gallery bucket under sample/.
// 3. Runs supabase/seed.sql on the linked project (catalog, staff, two weeks
//    of sample sales, appointments, and day closes).
//
// Safety: refuses to run unless .env.local says SEED_TARGET=development and the
// linked project is the one in NEXT_PUBLIC_SUPABASE_URL. Never run this
// against production. Remove the sample data later with
// npm run db:remove-sample.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = path.join(root, ".env.local");

if (!existsSync(envFile)) fail(".env.local is missing. Copy .env.example and fill it in first.");
process.loadEnvFile(envFile);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
if (process.env.SEED_TARGET !== "development") {
  fail("Refusing to seed: add SEED_TARGET=development to .env.local (only ever on the development project).");
}

const refFile = path.join(root, "supabase/.temp/project-ref");
const linkedRef = existsSync(refFile) ? readFileSync(refFile, "utf8").trim() : null;
const urlRef = new URL(url).hostname.split(".")[0];
if (!linkedRef) fail("No linked Supabase project. Run: npx supabase link --project-ref " + urlRef);
if (linkedRef !== urlRef) fail(`The linked project (${linkedRef}) is not the one in .env.local (${urlRef}).`);

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------------------------------------------------------------------------
// 1. Test accounts
// ---------------------------------------------------------------------------
const accounts = [
  { role: "owner", displayName: "Test Owner", emailVar: "DEV_OWNER_EMAIL", passwordVar: "DEV_OWNER_PASSWORD", email: "owner@bestman.test" },
  { role: "counter", displayName: "Abena (counter)", emailVar: "DEV_COUNTER_EMAIL", passwordVar: "DEV_COUNTER_PASSWORD", email: "counter@bestman.test" },
];

const { data: userList, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
if (listError) fail("Could not list users: " + listError.message);

for (const account of accounts) {
  const email = process.env[account.emailVar] || account.email;
  let password = process.env[account.passwordVar];
  let user = userList.users.find((candidate) => candidate.email === email);

  if (!user) {
    password ||= randomBytes(18).toString("base64url");
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: account.displayName },
    });
    if (error) fail(`Could not create the test ${account.role}: ${error.message}`);
    user = data.user;
    if (!process.env[account.passwordVar]) {
      appendFileSync(envFile, `\n# Test ${account.role} for the development POS (created by npm run db:seed)\n${account.emailVar}=${email}\n${account.passwordVar}=${password}\n`);
    }
    console.log(`Created the test ${account.role} account (${email}). Its password is in .env.local.`);
  } else {
    console.log(`The test ${account.role} account already exists (${email}).`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, display_name: account.displayName, role: account.role, active: true }, { onConflict: "id" });
  if (profileError) fail(`Could not save the ${account.role} profile: ${profileError.message}`);
}

// ---------------------------------------------------------------------------
// 2. Sample gallery photos (studio-08 shows a child: left out until the
//    parent's permission is confirmed).
// ---------------------------------------------------------------------------
const photoDir = path.join(root, "context/studio-assets/photos");
const photos = readdirSync(photoDir).filter((name) => /^studio-\d+\.jpg$/.test(name) && name !== "studio-08.jpg");
for (const name of photos) {
  const body = await sharp(path.join(photoDir, name))
    .rotate()
    .resize({ width: 1080, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  const { error } = await supabase.storage.from("gallery").upload(`sample/${name}`, body, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) fail(`Could not upload ${name}: ${error.message}`);
}
console.log(`Uploaded ${photos.length} sample photos to the gallery bucket.`);

// ---------------------------------------------------------------------------
// 3. Sample rows
// ---------------------------------------------------------------------------
console.log("Loading supabase/seed.sql ...");
const output = execFileSync("npx", ["supabase", "db", "query", "--linked", "-f", "supabase/seed.sql"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
  stdio: ["ignore", "pipe", "pipe"],
});
console.log(output.trim() || "seed.sql finished.");
console.log("Done. Remove all sample data before real use with: npm run db:remove-sample");

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}
