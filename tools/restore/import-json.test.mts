import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "@/lib/backup/schema";

import { batches, checkSchemaVersion, checkTarget, lastDayRevenue, newestMigration, parseProjectRef, readSnapshot } from "./import-json.mjs";

const TEST_REF = "abcdefghijklmnopqrst";
const PROD_REF = "xpcsmqwdpswnvzyterwx";

describe("parseProjectRef", () => {
  it.each([
    [`https://${TEST_REF}.supabase.co`, TEST_REF],
    [`https://${TEST_REF}.supabase.co/`, TEST_REF],
    [`HTTPS://${TEST_REF.toUpperCase()}.SUPABASE.CO`, TEST_REF],
    [`https://${TEST_REF}.supabase.co/rest/v1/`, TEST_REF],
    [` https://${TEST_REF}.supabase.co `, TEST_REF],
  ])("reads %s as the same ref", (url, ref) => {
    expect(parseProjectRef(url)).toBe(ref);
  });

  it.each([undefined, "", "not a url", `http://${TEST_REF}.supabase.co`, "https://example.com", `https://${TEST_REF}.supabase.co.evil.com`, "https://short.supabase.co"])(
    "refuses %j",
    (url) => {
      expect(parseProjectRef(url)).toBeNull();
    },
  );
});

describe("checkTarget", () => {
  const env = {
    RESTORE_SUPABASE_URL: `https://${TEST_REF}.supabase.co/`,
    RESTORE_SUPABASE_SERVICE_ROLE_KEY: "key",
    RESTORE_ALLOWED_PROJECT_REFS: ` ${TEST_REF.toUpperCase()} , other`,
    PRODUCTION_PROJECT_REF: PROD_REF,
  };

  it("accepts an allowed test project", () => {
    expect(checkTarget(env)).toEqual({ ref: TEST_REF, url: env.RESTORE_SUPABASE_URL });
  });

  it("refuses production, an unknown ref, a missing allowlist, an unparseable URL, or a missing production ref", () => {
    expect(() => checkTarget({ ...env, RESTORE_SUPABASE_URL: `https://${PROD_REF}.supabase.co`, RESTORE_ALLOWED_PROJECT_REFS: PROD_REF })).toThrow(
      /is the production project/,
    );
    expect(() => checkTarget({ ...env, RESTORE_ALLOWED_PROJECT_REFS: "someotherrefaaaaaaaa" })).toThrow(/not in RESTORE_ALLOWED_PROJECT_REFS/);
    expect(() => checkTarget({ ...env, RESTORE_ALLOWED_PROJECT_REFS: undefined })).toThrow(/RESTORE_ALLOWED_PROJECT_REFS is not set/);
    expect(() => checkTarget({ ...env, RESTORE_ALLOWED_PROJECT_REFS: " , " })).toThrow(/RESTORE_ALLOWED_PROJECT_REFS is not set/);
    expect(() => checkTarget({ ...env, RESTORE_SUPABASE_URL: "https://example.com" })).toThrow(/not a https:\/\/<ref>\.supabase\.co/);
    expect(() => checkTarget({ ...env, PRODUCTION_PROJECT_REF: "" })).toThrow(/PRODUCTION_PROJECT_REF is not set/);
  });
});

describe("snapshot checks", () => {
  const snapshot = {
    format: "bestman-backup",
    schema_version: SCHEMA_VERSION,
    tables: {
      sales: [
        { id: "a", status: "paid", business_date: "2026-10-30", total: 15000 },
        { id: "b", status: "paid", business_date: "2026-10-31", total: 4000 },
        { id: "c", status: "voided", business_date: "2026-10-31", total: 9000 },
        { id: "d", status: "paid", business_date: "2026-10-31", total: 6000 },
      ],
    },
    pos_accounts: [],
    row_counts: { sales: 4 },
  };

  it("reads a plain or gzipped file and refuses anything else", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "restore-test-"));
    writeFileSync(path.join(dir, "b.json"), JSON.stringify(snapshot));
    writeFileSync(path.join(dir, "b.json.gz"), gzipSync(JSON.stringify(snapshot)));
    writeFileSync(path.join(dir, "other.json"), JSON.stringify({ hello: 1 }));
    expect(readSnapshot(path.join(dir, "b.json")).row_counts.sales).toBe(4);
    expect(readSnapshot(path.join(dir, "b.json.gz")).tables.sales).toHaveLength(4);
    expect(() => readSnapshot(path.join(dir, "other.json"))).toThrow(/not a Bestman backup/);
  });

  it("refuses a backup made with other migrations", () => {
    expect(() => checkSchemaVersion(snapshot, SCHEMA_VERSION)).not.toThrow();
    expect(() => checkSchemaVersion({ ...snapshot, schema_version: "20260101000000" }, SCHEMA_VERSION)).toThrow(/made with schema 20260101000000/);
    expect(newestMigration(path.join(process.cwd(), "supabase", "migrations"))).toBe(SCHEMA_VERSION);
  });

  it("works out the last day's revenue from paid sales only", () => {
    expect(lastDayRevenue(snapshot.tables.sales)).toEqual({ business_date: "2026-10-31", revenue: 10000 });
  });

  it("sends rows in batches of 500", () => {
    expect(batches(Array.from({ length: 1201 }, (_, index) => index)).map((batch) => batch.length)).toEqual([500, 500, 201]);
  });
});
