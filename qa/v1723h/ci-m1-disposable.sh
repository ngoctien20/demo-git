#!/usr/bin/env bash
set -euo pipefail
# No customer data, no hosted Supabase, no network beyond local disposable Postgres.
if [[ "${CI:-}" != "true" || "${T404_B3_DISPOSABLE_ONLY:-}" != "YES" ]]; then
 echo "V1723H_BLOCK_CI_SENTINEL_MISSING" >&2; exit 41
fi
if [[ "${PGHOST:-}" != "127.0.0.1" || "${PGPORT:-}" != "5432" || "${PGDATABASE:-}" != "t404_b3_disposable" || "${PGUSER:-}" != "postgres" || -z "${PGPASSWORD:-}" ]]; then
 echo "V1723H_BLOCK_PG17_DISPOSABLE_ENDPOINT_INVALID" >&2; exit 42
fi
if ! command -v psql >/dev/null 2>&1; then echo "V1723H_BLOCK_PSQL_MISSING" >&2; exit 74; fi
identity="$(psql -XAt -v ON_ERROR_STOP=1 -c "SELECT current_database() || '|' || current_user || '|' || current_setting('server_version_num')")"
IFS='|' read -r db actor ver <<< "$identity"
if [[ "$db" != "t404_b3_disposable" || "$actor" != "postgres" || ! "$ver" =~ ^17[0-9]{4}$ ]]; then echo "V1723H_BLOCK_RUNTIME_MISMATCH" >&2; exit 43; fi
psql -X -v ON_ERROR_STOP=1 -f qa/v1723h/pg17-m1-compatibility-disposable.sql
echo "V1723H_DISPOSABLE_ONLY_ROLLBACK_VERIFIED_NO_HOSTED_MIGRATION"
