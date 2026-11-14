#!/usr/bin/env bash
# TIEN404 AI V12.4 Free-tier encrypted manual backup helper.
# Does not connect to production. Does not print or store database secrets.
# Run on a trusted computer. NEVER run in public GitHub Actions.
set -Eeuo pipefail
set +x
die(){ printf 'BACKUP BLOCKED: %s\n' "$1" >&2; exit 2; }
[ "$TIEN404_BACKUP_STAGING_CONFIRM" = "I_APPROVE_STAGING_BACKUP" ] || die "staging backup consent flag missing"
[ "$PGDATABASE" = "postgres" ] || die "expected postgres database"
[ "$PGPORT" = "5432" ] || die "direct or session pooler port 5432 required"
[ "$PGSSLMODE" = "require" ] || die "PGSSLMODE must be require"
case "$PGHOST" in
  db.ifxlvrhyjhbzbrkdsida.supabase.co) ;;
  *.pooler.supabase.com)
    [ "$PGUSER" = "postgres.ifxlvrhyjhbzbrkdsida" ] || die "pooler user must match staging project"
    ;;
  *) die "unexpected database host" ;;
esac
[ -n "$PGPASSFILE" ] && [ -f "$PGPASSFILE" ] || die "supply a secure PGPASSFILE, never paste password in chat"
[ -n "$AGE_RECIPIENT" ] || die "AGE_RECIPIENT public recipient required"
[ -n "$AGE_IDENTITY_FILE" ] && [ -f "$AGE_IDENTITY_FILE" ] || die "AGE_IDENTITY_FILE required for local verification"
[ -d "$SECURE_BACKUP_DIR" ] || die "SECURE_BACKUP_DIR must already exist and be private"
for cmd in pg_dump pg_restore age sha256sum grep; do command -v "$cmd" >/dev/null || die "missing tool: $cmd"; done
umask 077
export PGCONNECT_TIMEOUT=10
out="$SECURE_BACKUP_DIR/tien404-staging-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
[ ! -e "$out" ] || die "would overwrite existing backup"
cleanup(){ status=$?; if [ "$status" -ne 0 ]; then rm -f "$out"; fi; exit "$status"; }
trap cleanup EXIT
pg_dump -w --format=custom --no-owner --no-acl --dbname=postgres |
  age -r "$AGE_RECIPIENT" -o "$out"
[ -s "$out" ] || die "encrypted backup empty"
age -d -i "$AGE_IDENTITY_FILE" "$out" | pg_restore --list > /dev/null
age -d -i "$AGE_IDENTITY_FILE" "$out" | pg_restore --list |
  grep -q 'tien404_dialogue_private' || die "missing private dialogue schema"
age -d -i "$AGE_IDENTITY_FILE" "$out" | pg_restore --list |
  grep -q 'tien404_r1_qa' || die "missing source QA schema"
sha256sum "$out"
echo "BACKUP_TOC_VERIFIED - encrypted archive created; restore rehearsal still required"
echo "Never upload this backup or its identity key to public GitHub or ChatGPT."
