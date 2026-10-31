// What a backup snapshot is (backup-and-recovery.md, spec 20). Shared by the
// export (lib/backup/export.ts), the POS download, and the restore script.

export const SNAPSHOT_FORMAT = "bestman-backup";

// The newest migration in supabase/migrations. A snapshot can only be
// restored into a project with exactly these migrations, so the restore
// script refuses any other version. A unit test keeps this in step: add a
// migration, update this value.
export const SCHEMA_VERSION = "20261031130000";

// Every business table, in dependency order (the same list as the database's
// private.backup_tables(), checked by a unit test). Not rate_limits (temporary)
// nor Supabase's auth and storage tables; images are listed by their paths in
// staff, services, categories, offers, and gallery_images.
export const BACKUP_TABLES = [
  "profiles",
  "studio_settings",
  "sign_in_events",
  "staff",
  "service_categories",
  "services",
  "service_staff",
  "staff_hours",
  "staff_time_off",
  "offers",
  "gallery_images",
  "customers",
  "sales",
  "sale_items",
  "sale_payments",
  "appointments",
  "void_requests",
  "day_closes",
  "owner_alerts",
  "receipt_prints",
  "backup_runs",
  "audit_log",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

// The key columns each table is read in order of, so paging is stable.
export function orderColumns(table: BackupTable): string[] {
  return table === "service_staff" ? ["service_id", "staff_id"] : ["id"];
}

// A POS login, so a restore can recreate it with the same id (every sale,
// void, close, and change points at it). Never a password hash or token.
export interface PosAccount {
  id: string;
  email: string | null;
  display_name: string;
  role: string;
  active: boolean;
}

export interface Snapshot {
  format: typeof SNAPSHOT_FORMAT;
  schema_version: string;
  generated_at: string;
  tables: Record<BackupTable, Record<string, unknown>[]>;
  pos_accounts: PosAccount[];
  row_counts: Record<BackupTable | "pos_accounts", number>;
}

export function snapshotFileName(date: string): string {
  return `bestman-backup-${date}.json`;
}
