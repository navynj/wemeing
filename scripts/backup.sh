#!/usr/bin/env bash
# A backup of the production project, because the free tier keeps none.
#
#   backups/<stamp>.sql                  schema then data
#   backups/<stamp>/storage/<bucket>/…   every object in ripple-media and avatars
#   backups/<stamp>/storage/manifest.json  object count, bytes, one row per object
#
# All gitignored. Locally it uses the linked project and, for storage, the
# service key the logged-in Supabase CLI hands over; it never prints it. An
# object unchanged since the previous local backup (same etag) is hard-linked
# from there instead of downloaded, and every folder stays complete on its own.
#
# In CI (.github/workflows/backup.yml) the same script runs with
# SUPABASE_DB_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from secrets,
# and BACKUP_OUT naming a folder outside the repo.
set -euo pipefail
set +x # Never trace: the commands carry credentials in their environment.

out="${BACKUP_OUT:-backups}"
mkdir -p "$out"
stamp="$(date +%Y%m%d-%H%M%S)"
dump="${out}/${stamp}.sql"

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  source_flags=(--db-url "$SUPABASE_DB_URL")
  label="the configured database"
else
  ref_file="supabase/.temp/project-ref"
  if [ ! -f "$ref_file" ]; then
    echo "✖ No linked project. Run: supabase link --project-ref <ref>" >&2
    exit 1
  fi
  ref="$(cat "$ref_file")"
  source_flags=(--linked)
  label="${ref}"
  export SUPABASE_URL="${SUPABASE_URL:-https://${ref}.supabase.co}"
  if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    # Read once into the environment of this run; never echoed.
    SUPABASE_SERVICE_ROLE_KEY="$(
      supabase projects api-keys --project-ref "$ref" -o json 2>/dev/null |
        python3 -c 'import json,sys; print(next(r["api_key"] for r in json.load(sys.stdin) if r.get("name") == "service_role"))'
    )" || {
      echo "✖ Could not read the service key from the Supabase CLI (supabase login?)." >&2
      exit 1
    }
    export SUPABASE_SERVICE_ROLE_KEY
  fi
fi

echo "→ dumping ${label}"
{
  echo "-- Weming backup ${stamp}"
  echo "-- schema"
} > "$dump"
# Tool chatter goes to a file, not the log: it may echo connection details.
# On failure only its last lines are shown, with anything shaped like a
# connection string, a pooler user or a database host redacted.
redacted() {
  tail -n 8 "$1" | sed -E \
    -e 's#postgres(ql)?://[^[:space:]"]+#<db-url>#g' \
    -e 's#postgres\.[A-Za-z0-9]+#<db-user>#g' \
    -e 's#[A-Za-z0-9.-]+\.(pooler\.)?supabase\.(com|co)#<db-host>#g' \
    -e 's#(password[=:][[:space:]]*)[^[:space:]]+#\1<redacted>#gI' >&2
}
supabase db dump "${source_flags[@]}" >> "$dump" 2> "${out}/.dump-schema.err" || {
  echo "✖ schema dump failed:" >&2
  redacted "${out}/.dump-schema.err"
  exit 1
}
echo "-- data" >> "$dump"
supabase db dump "${source_flags[@]}" --data-only >> "$dump" 2> "${out}/.dump-data.err" || {
  echo "✖ data dump failed:" >&2
  redacted "${out}/.dump-data.err"
  exit 1
}
rm -f "${out}/.dump-schema.err" "${out}/.dump-data.err"
echo "✓ ${dump} ($(wc -l < "$dump" | tr -d ' ') lines)"

echo "→ downloading storage"
previous="$(ls -d "${out}"/*/storage 2>/dev/null | grep -v "/${stamp}/" | sort | tail -1 || true)"
node scripts/backup-storage.mjs "${out}/${stamp}/storage" ${previous:+--previous "$previous"}
