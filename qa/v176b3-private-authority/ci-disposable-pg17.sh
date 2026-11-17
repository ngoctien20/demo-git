#!/usr/bin/env bash
# V17.6-B.3 — isolated CI-only PostgreSQL 17; NEVER run against Supabase.
set -euo pipefail
if [[ "$CI" != "true" || "$T404_B3_DISPOSABLE_ONLY" != "YES" ]]; then
  echo "V176B3_FAIL_CLOSED_CI_DISPOSABLE_SENTINEL_REQUIRED" >&2
  exit 31
fi
if [[ "$PGHOST" != "127.0.0.1" ||
      "$PGPORT" != "5432" ||
      "$PGDATABASE" != "t404_b3_disposable" ||
      "$PGUSER" != "postgres" ]]; then
  echo "V176B3_FAIL_CLOSED_LOCAL_ONLY_DATABASE_TARGET_REQUIRED" >&2
  exit 32
fi
if [[ -z "$PGPASSWORD" ]]; then
  echo "V176B3_FAIL_CLOSED_DISPOSABLE_TEST_PASSWORD_REQUIRED" >&2
  exit 33
fi
identity="$(psql -XAt -v ON_ERROR_STOP=1 -c "SELECT current_database() || '|' || current_user || '|' || current_setting('server_version_num')")"
IFS='|' read -r db principal pg_version <<< "$identity"
if [[ "$db" != "t404_b3_disposable" || "$principal" != "postgres" ||
      ! "$pg_version" =~ ^17[0-9]{4}$ ]]; then
  echo "V176B3_FAIL_CLOSED_PG17_IDENTITY_MISMATCH" >&2
  exit 34
fi
psql -X -v ON_ERROR_STOP=1 -f qa/v176b3-private-authority/disposable_pg17_store_rls.sql
echo "V176B3_POSTGRES17_DISPOSABLE_ROLLBACK_COMPLETE_NO_HOSTED_SUPABASE_NO_REAL_JWT"
