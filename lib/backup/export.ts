import "server-only";

import { BACKUP_TABLES, orderColumns, SCHEMA_VERSION, SNAPSHOT_FORMAT, type BackupTable, type PosAccount } from "@/lib/backup/schema";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

// The full JSON snapshot of every business table (spec 20,
// backup-and-recovery.md): what the studio PC saves each day and the POS
// "Download backup now" button gives. Read with the service-role client.
//
// Supabase's API answers at most 1000 rows per request (the project can set
// less), so every table is read page by page until a page comes back empty;
// a short page is never taken to mean "the end".

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type Row = Record<string, unknown>;

// One page of a table: rows from..to (inclusive), in key order.
export type PageReader = (table: BackupTable, from: number, to: number) => Promise<Row[]>;

export const PAGE_SIZE = 1000;

export function pageReader(admin: Admin): PageReader {
  return async (table, from, to) => {
    // The table name is a string from BACKUP_TABLES; the typed client needs a literal.
    let query = admin.from(table as "sales").select("*");
    for (const column of orderColumns(table)) query = query.order(column as "id", { ascending: true });
    const { data, error } = await query.range(from, to);
    if (error) throw new Error(`backup: reading ${table} failed: ${error.message}`);
    return data as Row[];
  };
}

export async function readAllRows(readPage: PageReader, table: BackupTable): Promise<Row[]> {
  const rows: Row[] = [];
  for (;;) {
    const page = await readPage(table, rows.length, rows.length + PAGE_SIZE - 1);
    if (page.length === 0) return rows;
    rows.push(...page);
  }
}

// Every POS login (auth id = profiles.id) with its email, from the Auth admin
// API, page by page. Never a password hash, a token, or a session.
export async function readPosAccounts(admin: Admin, profiles: Row[]): Promise<PosAccount[]> {
  const emails = new Map<string, string | null>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`backup: reading the POS accounts failed: ${error.message}`);
    for (const user of data.users) emails.set(user.id, user.email ?? null);
    if (data.users.length < 1000) break;
  }
  return profiles.map((profile) => ({
    id: String(profile.id),
    email: emails.get(String(profile.id)) ?? null,
    display_name: String(profile.display_name),
    role: String(profile.role),
    active: Boolean(profile.active),
  }));
}

const encoder = new TextEncoder();

// The snapshot as JSON text, written table by table, so a large backup never
// has to sit in memory as one string. The row counts come last (they are
// known only at the end); a reader finds them by key, so the order does not
// matter. If a read fails half-way the stream errors and the file does not
// parse, so a broken backup can never pass for a good one.
export function snapshotJsonStream(
  readPage: PageReader,
  readAccounts: (profiles: Row[]) => Promise<PosAccount[]>,
  now: Date = new Date(),
  onComplete?: (counts: Record<string, number>) => void,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const counts: Record<string, number> = {};
        let profiles: Row[] = [];
        controller.enqueue(
          encoder.encode(
            `{"format":${JSON.stringify(SNAPSHOT_FORMAT)},"schema_version":${JSON.stringify(SCHEMA_VERSION)},` +
              `"generated_at":${JSON.stringify(now.toISOString())},"tables":{`,
          ),
        );
        for (const [index, table] of BACKUP_TABLES.entries()) {
          const rows = await readAllRows(readPage, table);
          if (table === "profiles") profiles = rows;
          counts[table] = rows.length;
          controller.enqueue(encoder.encode(`${index > 0 ? "," : ""}${JSON.stringify(table)}:${JSON.stringify(rows)}`));
        }
        const accounts = await readAccounts(profiles);
        counts.pos_accounts = accounts.length;
        controller.enqueue(encoder.encode(`},"pos_accounts":${JSON.stringify(accounts)},"row_counts":${JSON.stringify(counts)}}`));
        controller.close();
        onComplete?.(counts);
      } catch (error) {
        console.error("backup export failed", error instanceof Error ? error.message : error);
        controller.error(error);
      }
    },
  });
}

export function adminSnapshotStream(admin: Admin, onComplete?: (counts: Record<string, number>) => void): ReadableStream<Uint8Array> {
  return snapshotJsonStream(pageReader(admin), (profiles) => readPosAccounts(admin, profiles), new Date(), onComplete);
}

export function gzip(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  return stream.pipeThrough(new CompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>);
}
