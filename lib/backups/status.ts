// When a backup counts as stale (backup-and-recovery.md): the last successful
// PC backup older than 36 hours (a weekend with the PC off is normal), or the
// last weekly cloud backup older than 8 days.
export const BACKUP_STALE_AFTER_HOURS = {
  daily_pc: 36,
  weekly_cloud: 8 * 24,
} as const;

export type BackupKind = keyof typeof BACKUP_STALE_AFTER_HOURS;

export function isBackupStale(kind: BackupKind, lastSuccessAt: string | null, now: Date = new Date()): boolean {
  if (!lastSuccessAt) return true;
  const ageMs = now.getTime() - new Date(lastSuccessAt).getTime();
  return ageMs > BACKUP_STALE_AFTER_HOURS[kind] * 3600 * 1000;
}
