#!/usr/bin/env bash
set -Eeuo pipefail
# CRITICAL: accepts only localhost, exact disposable test database, no cloud credentials.
if [[ "${TIEN404_PG17_DISPOSABLE_QA:-}" != 'ONE_TIME_APPROVED_ONLY' || "${PGHOST:-}" != '127.0.0.1' || "${PGDATABASE:-}" != 'tien404_v15u2_disposable' || "${PGUSER:-}" != 'postgres' ]]; then
  echo 'BLOCKED_DISPOSABLE_TARGET_REQUIRED' >&2; exit 40
fi
if ! command -v psql >/dev/null; then echo 'BLOCKED_PSQL_NOT_INSTALLED' >&2; exit 41; fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
P=(psql -X -v ON_ERROR_STOP=1 -P pager=off)
pgver="$("${P[@]}" -tAc 'SHOW server_version_num' | tr -d '[:space:]')"
db="$("${P[@]}" -tAc 'SELECT current_database()' | tr -d '[:space:]')"
if [[ ! "$pgver" =~ ^17[0-9]{4}$ || "$db" != 'tien404_v15u2_disposable' ]]; then echo 'BLOCKED_REQUIRE_PG17_DISPOSABLE' >&2; exit 42; fi
check="$("${P[@]}" -tAc "SELECT to_regclass('tien404_r1_qa.tenant_identity_map') IS NULL")"
if [[ "$check" != 't' ]]; then echo 'BLOCKED_NONEMPTY_TARGET' >&2;exit 43;fi
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
python3 "$ROOT/guarded_unlock_disposable.py" "$ROOT/01_MAPPING_SCHEMA_REVIEW_ONLY.sql" "$TMP/01.sql"
python3 "$ROOT/guarded_unlock_disposable.py" "$ROOT/02_READER_POLICY_REVIEW_ONLY.sql" "$TMP/02.sql"
python3 "$ROOT/guarded_unlock_disposable.py" "$ROOT/03_ROLLBACK_REVIEW_ONLY.sql" "$TMP/03.sql"
"${P[@]}" -f "$ROOT/00_LEGACY_SYNTHETIC_FIXTURE.sql"
"${P[@]}" -f "$TMP/01.sql"
"${P[@]}" -f "$ROOT/04_V2_SYNTHETIC_FIXTURE.sql"
"${P[@]}" -f "$TMP/02.sql"
"${P[@]}" -f "$ROOT/05_DISPOSABLE_ASSERTIONS.sql"
"${P[@]}" -f "$TMP/03.sql"
"${P[@]}" -f "$ROOT/06_ROLLBACK_ASSERTIONS.sql"
echo 'TIEN404_V15_0_10U2_PG17_DISPOSABLE_COMPLETE; NO_HOSTED_JWT_PROOF'