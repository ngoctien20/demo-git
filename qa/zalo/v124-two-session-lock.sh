#!/usr/bin/env bash
# TIEN404 V12.4 — REAL Postgres row-lock QA. STAGING ONLY.
# Two separate psql processes (not MCP concurrent tool calls).
# No Orders, no provider send, no production changes, no credential output.
set +x
set -Eeo pipefail
deny(){ printf 'V12.4 LOCK QA BLOCKED: %s\n' "$1" >&2; exit 2; }
[[ "$TIEN404_V124_STAGING_CONFIRM" == "I_APPROVE_SHOP_B_PG_LOCK_QA" ]] || deny "QA scope flag missing"
[[ "$PGDATABASE" == "postgres" ]] || deny "expected postgres database"
[[ "$PGPORT" == "5432" ]] || deny "requires direct/session pooler 5432, not 6543"
case "$PGHOST" in
  db.ifxlvrhyjhbzbrkdsida.supabase.co) ;;
  *.pooler.supabase.com)
    [[ "$PGUSER" == "postgres.ifxlvrhyjhbzbrkdsida" ]] || deny "pooler project mismatch"
    ;;
  *) deny "unexpected staging Postgres host" ;;
esac
command -v psql >/dev/null 2>&1 || deny "psql CLI required"
export PGCONNECT_TIMEOUT=8
tmp="$(mktemp -d)"
holder_pid=""
fixture_created=0

cleanup(){
  local previous_status=$?
  trap - EXIT INT TERM
  if [[ -n "$holder_pid" ]] && kill -0 "$holder_pid" 2>/dev/null; then
    kill "$holder_pid" 2>/dev/null || true
    wait "$holder_pid" 2>/dev/null || true
  fi
  if [[ "$fixture_created" == 1 ]]; then
    psql -w -X -q -v ON_ERROR_STOP=1 \
      -c "DELETE FROM tien404_dialogue_private.shop_b_sessions WHERE scope_key=repeat('f',64) AND binding_fingerprint='V12_4_PSQL_LOCK_QA_ONLY';" \
      >/dev/null 2>&1 || printf 'WARNING: isolated QA fixture cleanup unsuccessful\n' >&2
  fi
  rm -rf "$tmp"
  exit "$previous_status"
}
trap cleanup EXIT INT TERM

baseline="$(psql -w -X -qAt -v ON_ERROR_STOP=1 -c \
 "SELECT (SELECT count(*) FROM tien404_dialogue_private.shop_b_sessions)::text || ':' || (SELECT count(*) FROM tien404_dialogue_private.shop_b_receipts)::text;")"
[[ "$baseline" == "0:0" ]] || deny "private QA sessions/receipts not empty"

inserted="$(psql -w -X -qAt -v ON_ERROR_STOP=1 -c \
 "INSERT INTO tien404_dialogue_private.shop_b_sessions
 (scope_key,tenant_key,store_key,bot_key,binding_fingerprint,expires_at)
 VALUES(repeat('f',64),'qa-tenant-b','qa-store-b','qa-bot-b',
 'V12_4_PSQL_LOCK_QA_ONLY',now()+interval '15 minutes')
 ON CONFLICT DO NOTHING RETURNING scope_key;")"
[[ "$inserted" == "$(printf 'f%.0s' {1..64})" ]] || deny "fixture insert failed"
fixture_created=1

psql -w -X -qAt -v ON_ERROR_STOP=1 >"$tmp/holder.out" 2>"$tmp/holder.err" <<'SQL' &
BEGIN;
SET LOCAL statement_timeout='14000ms';
SELECT pg_backend_pid();
SELECT scope_key FROM tien404_dialogue_private.shop_b_sessions
 WHERE scope_key=repeat('f',64) FOR UPDATE;
\echo TIEN404_LOCK_HELD
SELECT pg_sleep(8);
ROLLBACK;
SQL
holder_pid=$!
seen=0
for _ in {1..60}; do
  if grep -Fq 'TIEN404_LOCK_HELD' "$tmp/holder.out" 2>/dev/null; then seen=1; break; fi
  if ! kill -0 "$holder_pid" 2>/dev/null; then break; fi
  sleep 0.1
done
[[ "$seen" == 1 ]] || deny "holder lock not confirmed"

psql -w -X -qAt -v ON_ERROR_STOP=1 >"$tmp/waiter.out" 2>"$tmp/waiter.err" <<'SQL'
BEGIN;
SET LOCAL statement_timeout='15000ms';
CREATE TEMP TABLE v124_lock_metrics (pid integer, waited_seconds numeric) ON COMMIT DROP;
DO $$
DECLARE started_at timestamptz; seconds_waiting numeric;
BEGIN
  started_at := clock_timestamp();
  PERFORM scope_key FROM tien404_dialogue_private.shop_b_sessions
   WHERE scope_key=repeat('f',64) FOR UPDATE;
  seconds_waiting := EXTRACT(EPOCH FROM clock_timestamp()-started_at);
  INSERT INTO v124_lock_metrics VALUES (pg_backend_pid(),seconds_waiting);
  IF seconds_waiting < 1.5 THEN
    RAISE EXCEPTION 'LOCK_WAIT_NOT_PROVEN: % seconds',seconds_waiting;
  END IF;
END $$;
SELECT pid, round(waited_seconds,3) FROM v124_lock_metrics;
ROLLBACK;
SQL

wait "$holder_pid"
holder_pid=""
holder_backend_pid="$(grep -E '^[0-9]+$' "$tmp/holder.out" | head -n 1)"
waiter_line="$(grep -E '^[0-9]+\|[0-9.]+' "$tmp/waiter.out" | tail -n 1)"
[[ -n "$holder_backend_pid" && -n "$waiter_line" ]] || deny "missing backend PID or time measurement"
waiter_backend_pid="$(printf '%s' "$waiter_line" | cut -d'|' -f1)"
waiter_secs="$(printf '%s' "$waiter_line" | cut -d'|' -f2)"
[[ "$holder_backend_pid" != "$waiter_backend_pid" ]] || deny "identical backend PID"
printf 'PASS V12.4 independent PostgreSQL row lock: holder=%s waiter=%s wait=%ss\n' \
 "$holder_backend_pid" "$waiter_backend_pid" "$waiter_secs"
