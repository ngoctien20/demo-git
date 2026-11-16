#!/bin/sh
# TIEN404 V15.0-09C synthetic and disposable only.
# Executed ONLY inside postgres:17-alpine on a GitHub Actions service DB.
set -eu
test "$PGDATABASE" = 'tien404_ci_rehearsal' || {
 echo "BLOCKED: not the exact disposable CI source database" >&2; exit 2;
}
test "$PGHOST" = '127.0.0.1' || { echo "BLOCKED: PGHOST must be local CI" >&2; exit 2; }
test -d /recovery && test -r /work/qa/v1509b-hosted-rls/ephemeral-postgres17-rls-rehearsal.sql
dump=/recovery/v1509c-synthetic-only.dump
trap 'rm -f "$dump"' EXIT INT TERM

# Source DB is born in an ephemeral PostgreSQL Docker service (NOT Supabase).
psql -X -v ON_ERROR_STOP=1 \
  -f /work/qa/v1509b-hosted-rls/ephemeral-postgres17-rls-rehearsal.sql
pg_dump --format=custom --no-owner --file="$dump"
test -s "$dump"
sha_before="$(sha256sum "$dump" | cut -d' ' -f1)"
test "$(printf %s "$sha_before" | wc -c)" -eq 64
createdb --template=template0 tien404_ci_restored
pg_restore --no-owner --clean --if-exists --exit-on-error \
  --single-transaction --dbname=tien404_ci_restored "$dump"
sha_after="$(sha256sum "$dump" | cut -d' ' -f1)"
test "$sha_before" = "$sha_after" || {
 echo "FAIL: synthetic dump corrupted between export and restore" >&2; exit 3;
}
psql -X -v ON_ERROR_STOP=1 --dbname=tien404_ci_restored \
  -f /work/qa/v1509c-owner-recovery/assert-restored-ephemeral.sql

echo "PASS: SYNTHETIC PG17 pg_dump/pg_restore checksum matched and restored RLS/Store scope checked."
echo "SHA256: $sha_before (synthetic ephemeral dump, not uploaded)."
echo "NOT VERIFIED: any actual hosted backup, signed Auth JWT or merchant consent."
