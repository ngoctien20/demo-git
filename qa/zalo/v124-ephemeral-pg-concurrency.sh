#!/usr/bin/env bash
# V12.4: independent PostgreSQL QA on an EPHEMERAL GitHub Actions database.
# NOT Supabase staging. No project secrets or customer data.
set -Eeuo pipefail
set +x
[ "$TIEN404_EPHEMERAL_PG_QA" = "yes" ] || exit 2
[ "$PGHOST" = "127.0.0.1" ] || exit 2
[ "$PGPORT" = "5432" ] || exit 2
command -v psql >/dev/null || exit 2
tmp="$(mktemp -d)"
holder=""
cleanup() {
  status=$?
  trap - EXIT
  if [ -n "$holder" ]; then kill "$holder" 2>/dev/null || true; wait "$holder" 2>/dev/null || true; fi
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT
psql -w -X -q -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA dialogue_qa;
REVOKE ALL ON SCHEMA dialogue_qa FROM PUBLIC;
CREATE TABLE dialogue_qa.sessions(id text primary key, revision integer not null default 0);
CREATE TABLE dialogue_qa.receipts(id text primary key, scope_key text not null references dialogue_qa.sessions(id));
INSERT INTO dialogue_qa.sessions(id) VALUES ('qa-store-b-owner-fixture');
SQL
# First connection: lock row for 7 seconds, then ROLLBACK
psql -w -X -qAt -v ON_ERROR_STOP=1 >"$tmp/holder.out" 2>"$tmp/holder.err" <<'SQL' &
BEGIN;
SET LOCAL statement_timeout='15000ms';
SELECT pg_backend_pid();
SELECT id FROM dialogue_qa.sessions WHERE id='qa-store-b-owner-fixture' FOR UPDATE;
\echo ROW_LOCK_HELD
SELECT pg_sleep(7);
ROLLBACK;
SQL
holder=$!
seen=0
for i in {1..80}; do
  if grep -Fqx 'ROW_LOCK_HELD' "$tmp/holder.out" 2>/dev/null; then seen=1; break; fi
  if ! kill -0 "$holder" 2>/dev/null; then break; fi
  sleep .075
done
[ "$seen" = "1" ] || { echo "HOLDER_NOT_READY" >&2; exit 1; }
# Second connection: the same FOR UPDATE must wait until holder rollback.
psql -w -X -qAt -v ON_ERROR_STOP=1 >"$tmp/waiter.out" 2>"$tmp/waiter.err" <<'SQL'
BEGIN;
SET LOCAL statement_timeout='15000ms';
CREATE TEMP TABLE result_lock(pid integer, waited numeric) ON COMMIT DROP;
DO $$
DECLARE t timestamptz; wait_s numeric;
BEGIN
  t:=clock_timestamp();
  PERFORM id FROM dialogue_qa.sessions WHERE id='qa-store-b-owner-fixture' FOR UPDATE;
  wait_s:=EXTRACT(EPOCH FROM clock_timestamp()-t);
  INSERT INTO result_lock VALUES (pg_backend_pid(),wait_s);
  IF wait_s<1.5 THEN RAISE EXCEPTION 'NO_LOCK_CONTENTION: %',wait_s; END IF;
END $$;
SELECT pid,round(waited,3) FROM result_lock;
ROLLBACK;
SQL
wait "$holder"
holder=""
holder_backend="$(grep -E '^[0-9]+$' "$tmp/holder.out" | head -1)"
waiter_line="$(grep -E '^[0-9]+\|[0-9.]+' "$tmp/waiter.out" | tail -1)"
waiter_backend="$(printf '%s' "$waiter_line" | cut -d'|' -f1)"
waited="$(printf '%s' "$waiter_line" | cut -d'|' -f2)"
[ -n "$holder_backend" ] && [ -n "$waiter_backend" ] && [ "$holder_backend" != "$waiter_backend" ] || exit 1
echo "PASS ROW_LOCK: independent_backends=true waited_seconds=$waited"
# Third connection: a receipt insert remains uncommitted for 7 s.
psql -w -X -qAt -v ON_ERROR_STOP=1 >"$tmp/receipt_holder.out" 2>"$tmp/receipt_holder.err" <<'SQL' &
BEGIN;
SET LOCAL statement_timeout='15000ms';
INSERT INTO dialogue_qa.receipts(id,scope_key) VALUES ('same-event','qa-store-b-owner-fixture');
\echo RECEIPT_UNCOMMITTED
SELECT pg_sleep(7);
COMMIT;
SQL
holder=$!
seen=0
for i in {1..80}; do
  if grep -Fqx 'RECEIPT_UNCOMMITTED' "$tmp/receipt_holder.out" 2>/dev/null; then seen=1; break; fi
  if ! kill -0 "$holder" 2>/dev/null; then break; fi
  sleep .075
done
[ "$seen" = "1" ] || { echo "RECEIPT_HOLDER_NOT_READY" >&2; exit 1; }
# Fourth connection: unique receipt insertion must wait and insert 0 rows.
psql -w -X -qAt -v ON_ERROR_STOP=1 >"$tmp/receipt_waiter.out" 2>"$tmp/receipt_waiter.err" <<'SQL'
BEGIN;
SET LOCAL statement_timeout='15000ms';
CREATE TEMP TABLE receipt_metrics(inserted int, waited numeric) ON COMMIT DROP;
DO $$
DECLARE t timestamptz; inserted int; elapsed numeric;
BEGIN
  t:=clock_timestamp();
  INSERT INTO dialogue_qa.receipts(id,scope_key) VALUES ('same-event','qa-store-b-owner-fixture') ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  elapsed:=EXTRACT(EPOCH FROM clock_timestamp()-t);
  INSERT INTO receipt_metrics VALUES(inserted,elapsed);
  IF inserted<>0 OR elapsed<1.5 THEN RAISE EXCEPTION 'DUPLICATE_NOT_SUPPRESSED_OR_NOT_CONCURRENT'; END IF;
END $$;
SELECT inserted,round(waited,3) FROM receipt_metrics;
ROLLBACK;
SQL
wait "$holder"
holder=""
receipt_line="$(grep -E '^0\|[0-9.]+' "$tmp/receipt_waiter.out" | tail -1)"
[ -n "$receipt_line" ] || { echo "RECEIPT_RACE_FAILED" >&2; exit 1; }
rows="$(psql -w -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM dialogue_qa.receipts WHERE id='same-event';")"
[ "$rows" = "1" ] || exit 1
echo "PASS RECEIPT_UNIQUE: total_receipts=1 concurrent_conflict_wait_seconds=$(printf '%s' "$receipt_line" | cut -d'|' -f2)"
echo "PASS EPHEMERAL_POSTGRES_QA (NOT Supabase staging)"
