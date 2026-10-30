// Runs the SQL tests in supabase/tests/*.test.sql against the linked
// DEVELOPMENT project.
//
//   npm run test:db
//
// Each test file runs as a single transaction and finishes by raising an
// error on purpose ("DB_TEST_RESULTS ..."), which rolls everything back and
// carries the results. This script prints them and exits non-zero on any
// "not ok" line or on an unexpected error. Never point this at production.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const testDir = path.join(root, "supabase/tests");
const files = readdirSync(testDir).filter((name) => name.endsWith(".test.sql")).sort();

let failedFiles = 0;
for (const file of files) {
  const run = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", path.posix.join("supabase/tests", file)], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const marker = output.match(/DB_TEST_RESULTS failed=(\d+) total=(\d+)/);

  console.log(`\n# ${file}`);
  if (!marker) {
    failedFiles += 1;
    console.log("not ok - the test file did not finish. Output:\n" + output.trim());
    continue;
  }

  // The counts in the marker are computed in SQL and are authoritative. The
  // detail lines may be cut short by the API's error-message limit, so the
  // report lists failures first.
  const lines = output
    .slice(marker.index)
    .split(/\\n|\r?\n/)
    .map((line) => line.trim().replace(/\\+$/, ""))
    .filter((line) => /^(not )?ok \d+ - /.test(line));
  for (const line of lines) console.log(line);

  const failed = Number(marker[1]);
  const total = Number(marker[2]);
  if (lines.length < total) console.log(`# (${total - lines.length} result lines were cut off by the message limit)`);
  console.log(`# ${total - failed}/${total} passed`);
  if (failed > 0) failedFiles += 1;
}

process.exit(failedFiles > 0 ? 1 : 0);
