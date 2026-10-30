import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

// Runs every migration, the sample seed, the SQL tests in supabase/tests, and
// remove_sample_data() in an in-memory PGlite database (tools/db/local-check.mjs).
// The same SQL tests also run against the development project with npm run test:db.
describe("database (local PGlite check)", () => {
  it("applies the migrations, loads the sample seed, passes the SQL tests, and removes the sample data", () => {
    const run = spawnSync(process.execPath, ["tools/db/local-check.mjs"], { encoding: "utf8" });
    const output = `${run.stdout}\n${run.stderr}`;
    expect(output, output).not.toMatch(/not ok|✖/);
    expect(run.status, output).toBe(0);
  }, 120_000);
});
