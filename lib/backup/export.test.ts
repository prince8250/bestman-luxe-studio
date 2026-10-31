import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readAllRows, snapshotJsonStream, type PageReader } from "./export";
import { BACKUP_TABLES, SCHEMA_VERSION, type BackupTable } from "./schema";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

// A fake API with `rows` rows in one table that answers at most `cap` rows per
// request, as Supabase does (1000 by default, less if the project says so).
function fakeReader(tableRows: Partial<Record<BackupTable, number>>, cap = 1000): PageReader & { calls: number } {
  const reader = Object.assign(
    async (table: BackupTable, from: number, to: number) => {
      reader.calls += 1;
      const total = tableRows[table] ?? 0;
      const end = Math.min(to, from + cap - 1, total - 1);
      return Array.from({ length: Math.max(end - from + 1, 0) }, (_, index) => ({ id: from + index }));
    },
    { calls: 0 },
  );
  return reader;
}

describe("readAllRows", () => {
  it("reads every row of a table past 1000 rows", async () => {
    const rows = await readAllRows(fakeReader({ audit_log: 2500 }), "audit_log");
    expect(rows).toHaveLength(2500);
    expect(rows.at(-1)).toEqual({ id: 2499 });
  });

  it("keeps going when the server answers fewer rows than asked for", async () => {
    const reader = fakeReader({ sales: 1234 }, 500);
    const rows = await readAllRows(reader, "sales");
    expect(rows).toHaveLength(1234);
    expect(new Set(rows.map((row) => row.id)).size).toBe(1234);
  });
});

describe("snapshotJsonStream", () => {
  it("writes valid JSON with the format, schema version, every table, the accounts, and row counts", async () => {
    let completed: Record<string, number> | null = null;
    const stream = snapshotJsonStream(
      fakeReader({ profiles: 2, sales: 1500 }),
      async (profiles) => profiles.map((profile) => ({ id: String(profile.id), email: null, display_name: "x", role: "owner", active: true })),
      new Date("2026-10-31T12:00:00Z"),
      (counts) => (completed = counts),
    );
    const snapshot = JSON.parse(await new Response(stream).text());
    expect(snapshot).toMatchObject({ format: "bestman-backup", schema_version: SCHEMA_VERSION, generated_at: "2026-10-31T12:00:00.000Z" });
    expect(Object.keys(snapshot.tables)).toEqual([...BACKUP_TABLES]);
    expect(snapshot.tables.sales).toHaveLength(1500);
    expect(snapshot.pos_accounts).toHaveLength(2);
    expect(snapshot.row_counts).toMatchObject({ sales: 1500, profiles: 2, audit_log: 0, pos_accounts: 2 });
    expect(completed).toEqual(snapshot.row_counts);
  });

  it("errors instead of ending cleanly when a read fails, so a broken backup never parses", async () => {
    const failing: PageReader = async (table) => {
      if (table === "sales") throw new Error("network down");
      return [];
    };
    const stream = snapshotJsonStream(failing, async () => [], new Date());
    await expect(new Response(stream).text()).rejects.toThrow();
  });
});

describe("schema", () => {
  it("SCHEMA_VERSION is the newest migration (update it with each new migration)", () => {
    const newest = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort().at(-1);
    expect(newest?.slice(0, 14)).toBe(SCHEMA_VERSION);
  });

  it("BACKUP_TABLES matches the database's private.backup_tables(), in the same order", () => {
    const sql = readFileSync(path.join(migrationsDir, "20261031130000_backup_and_restore.sql"), "utf8");
    const body = /function private\.backup_tables\(\)[\s\S]*?array\[([\s\S]*?)\]/.exec(sql)?.[1] ?? "";
    const tables = [...body.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(tables).toEqual([...BACKUP_TABLES]);
  });
});
