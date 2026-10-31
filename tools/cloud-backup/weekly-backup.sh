#!/usr/bin/env bash
# Weekly cloud backup (spec 22, backup-and-recovery.md Layer 2). Run by
# .github/workflows/weekly-backup.yml; needs pg_dump/pg_restore/psql of the
# database's major version, curl, and jq.
#
#   1. pg_dump (custom format, compressed) of the POS schemas (public,
#      private, supabase_migrations) and the logins (auth), through the
#      Supabase session pooler (IPv4; GitHub's runners have no IPv6);
#   2. checks the file opens with pg_restore;
#   3. uploads it to the private "backups" bucket as weekly/bestman-YYYY-MM-DD.dump;
#   4. deletes weekly dumps older than 12 weeks;
#   5. reports the run (success or failure) to the POS heartbeat with
#      BACKUP_WEBHOOK_TOKEN, or, before the POS is deployed (no POS_URL),
#      writes the backup_runs row with the service-role key.
#
# Environment (GitHub secrets; never printed):
#   SUPABASE_DB_URL            session pooler string: postgresql://postgres.<ref>:<password>@<host>:5432/postgres
#   SUPABASE_URL               https://<ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY  for Storage (and the fallback row)
#   BACKUP_WEBHOOK_TOKEN       the POS heartbeat token for weekly_cloud runs
#   POS_URL                    optional until the POS is deployed, e.g. https://bestman-pos.vercel.app
#   PG_BIN                     folder with pg_dump/pg_restore/psql (default: on PATH)

set -uo pipefail

KEEP_DAYS=84 # 12 weeks
BUCKET="backups"
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
day="$(date -u +%F)"
file="bestman-${day}.dump"
object="weekly/${file}"
workdir="$(mktemp -d)"
bin="${PG_BIN:+${PG_BIN}/}"
status="failed"
message=""
size=""
counts=""

log() { echo "[weekly-backup] $*"; }
fail() {
  message="$*"
  log "FAILED: $message"
  report
  exit 1
}

for name in SUPABASE_DB_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY BACKUP_WEBHOOK_TOKEN; do
  if [ -z "${!name:-}" ]; then
    log "FAILED: the GitHub secret ${name} is not set (Settings > Secrets and variables > Actions)."
    exit 1
  fi
done
SUPABASE_URL="${SUPABASE_URL%/}"

# Reports the run: to the POS heartbeat, or straight into backup_runs before
# the POS is deployed. A failure to report is logged, never hides the result.
report() {
  local finished body
  finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  body="$(jq -n \
    --arg status "$status" --arg started "$started" --arg finished "$finished" \
    --arg file "$file" --arg path "$object" --arg size "$size" --arg counts "$counts" --arg message "$message" \
    '{kind: "weekly_cloud", status: $status, started_at: $started, finished_at: $finished}
     + (if $status == "success" then {file_name: $file, storage_path: $path, size_bytes: ($size | tonumber)} else {} end)
     + (if $counts != "" then {row_counts: ($counts | fromjson)} else {} end)
     + (if $message != "" then {message: ($message | .[0:1900])} else {} end)')"
  if [ -n "${POS_URL:-}" ]; then
    if curl -fsS -o /dev/null -X POST "${POS_URL%/}/api/backup/heartbeat" \
      -H "Authorization: Bearer ${BACKUP_WEBHOOK_TOKEN}" -H "Content-Type: application/json" --data "$body"; then
      log "Reported the run to the POS."
    else
      log "Could not report the run to the POS heartbeat."
    fi
  else
    if curl -fsS -o /dev/null -X POST "${SUPABASE_URL}/rest/v1/backup_runs" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" -H "Prefer: return=minimal" --data "$body"; then
      log "POS_URL is not set yet: wrote the backup_runs row directly."
    else
      log "Could not write the backup_runs row."
    fi
  fi
}

storage() { # method path [curl args...]
  local method="$1" path="$2"
  shift 2
  curl -fsS -X "$method" "${SUPABASE_URL}/storage/v1/${path}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" "$@"
}

# 1. Dump.
log "Dumping the database (${day})..."
"${bin}pg_dump" --dbname="$SUPABASE_DB_URL" --format=custom --compress=9 --no-password \
  --schema=public --schema=private --schema=supabase_migrations --schema=auth \
  --file="${workdir}/${file}" 2>"${workdir}/pg_dump.err" ||
  fail "pg_dump failed: $(tail -c 600 "${workdir}/pg_dump.err" | tr '\n' ' ')"
size="$(stat -c %s "${workdir}/${file}")"
counts="$("${bin}psql" "$SUPABASE_DB_URL" --no-psqlrc -At -c 'select private.restore_counts()' 2>/dev/null || true)"
log "Dump ready: ${size} bytes."

# 2. Check it opens and holds the sales data.
"${bin}pg_restore" --list "${workdir}/${file}" >"${workdir}/list.txt" 2>"${workdir}/restore.err" ||
  fail "The dump does not open: $(tail -c 400 "${workdir}/restore.err" | tr '\n' ' ')"
grep -q "TABLE DATA public sales " "${workdir}/list.txt" || fail "The dump has no sales data."

# 3. Upload (replaces a file of the same day if the workflow ran twice).
storage POST "object/${BUCKET}/${object}" -H "Content-Type: application/octet-stream" -H "x-upsert: true" \
  --data-binary "@${workdir}/${file}" -o /dev/null || fail "Upload to the ${BUCKET} bucket failed (is the file over the bucket's size limit?)."
log "Uploaded to ${BUCKET}/${object}."

# 4. Delete weekly dumps older than 12 weeks (by the date in the name).
cutoff="$(date -u -d "-${KEEP_DAYS} days" +%F)"
old="$(storage POST "object/list/${BUCKET}" -H "Content-Type: application/json" \
  --data '{"prefix": "weekly/", "limit": 1000, "offset": 0, "sortBy": {"column": "name", "order": "asc"}}' |
  jq -c --arg cutoff "$cutoff" '[.[] | .name | select(test("^bestman-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.dump$")) | select(.[8:18] < $cutoff) | "weekly/" + .]')" ||
  old="[]"
if [ "$old" != "[]" ] && [ -n "$old" ]; then
  if storage DELETE "object/${BUCKET}" -H "Content-Type: application/json" --data "{\"prefixes\": ${old}}" -o /dev/null; then
    log "Deleted dumps older than 12 weeks: ${old}"
  else
    message="Could not delete old dumps: ${old}"
    log "$message"
  fi
fi

status="success"
report
rm -rf "$workdir"
log "Weekly backup finished."
