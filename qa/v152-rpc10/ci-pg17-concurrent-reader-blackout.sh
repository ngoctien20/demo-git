#!/usr/bin/env bash
# RPC10-G2: concurrent reader vs M2/M4 six-surface cutover, synthetic PG17 only.
# This is a lock/read-blackout rehearsal, NOT a zero-downtime/hosted certificate.
set -euo pipefail
[[ "$(printenv CI || true)" == "true" &&
   "$(printenv T404_RPC8_DISPOSABLE || true)" == "YES" &&
   "$(printenv PGDATABASE || true)" == "t404_rpc8_ci" &&
   "$(printenv PGHOST || true)" == "postgres" &&
   "$(printenv PGUSER || true)" == "postgres" ]] || { echo RPC10_CONCURRENT_DISPOSABLE_ONLY; exit 2; }
[[ "$(psql -X -Atqc 'show server_version_num')" == 17* ]] || exit 2
[[ "$(psql -X -Atqc "select current_setting('tien404.rpc8_ephemeral',true)")" == "RPC8_DISPOSABLE" ]] || exit 2
psql -X -q -v ON_ERROR_STOP=1 -f qa/v152-rpc8/pg17-synthetic-legacy-fixture.sql >/dev/null
psql -X -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
BEGIN;
\i qa/v152-rpc8/pg17-m1-expand-disposable-only.sql
COMMIT;
SQL
psql -X -q -v ON_ERROR_STOP=1 -f qa/v152-rpc9/pg17-prepare-synthetic-three-store.sql >/dev/null
psql -X -q -v ON_ERROR_STOP=1 -f qa/v152-rpc10/pg17-six-surface-fixture.sql >/dev/null

tmp="$(mktemp -d)"
writer_pid='' reader_pid=''
cleanup(){
  if [[ -n "$reader_pid" ]];then kill "$reader_pid" 2>/dev/null || true;fi
  if [[ -n "$writer_pid" ]];then kill "$writer_pid" 2>/dev/null || true;fi
  rm -rf "$tmp"
}
trap cleanup EXIT
get_flag(){
  local stmt="$1"
  psql -X -qAt -v ON_ERROR_STOP=1 -c "$stmt"
}
wait_for(){
  local stmt="$1" label="$2" ready=0
  for _ in $(seq 1 90);do
    if [[ "$(get_flag "$stmt")" == "1" ]];then ready=1;break;fi
    sleep .1
  done
  [[ "$ready" == "1" ]] || { echo "FAIL: $label timed out";exit 1; }
  echo "PASS: $label"
}
exercise(){
  local decision="$1" expect="$2" observed
  # Even inside the transaction, the old Tenant-wide policy is replaced before
  # other readers can access six locked tables. The writer holds the locks 8s.
  PGAPPNAME=rpc10_writer psql -X -q -v ON_ERROR_STOP=1 >"$tmp/writer" 2>&1 <<SQL &
BEGIN;
\i qa/v152-rpc10/pg17-six-surface-atomic-cutover-disposable-only.sql
SELECT pg_sleep(8);
$decision;
SQL
  writer_pid=$!
  wait_for "SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='rpc10_writer' AND l.locktype='relation' AND l.relation='qa_rpc8.products'::regclass AND l.mode='AccessExclusiveLock' AND l.granted" "writer acquired ACCESS EXCLUSIVE before reader ($decision)"
  PGAPPNAME=rpc10_reader psql -X -qAt -v ON_ERROR_STOP=1 >"$tmp/reader" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL ROLE qa_rpc8_user;
SET LOCAL tien404.synthetic_actor='aaaaaaaa-0000-4000-8000-000000000001';
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='15s';
SELECT
 (SELECT count(*) FROM qa_rpc8.products),
 (SELECT count(*) FROM qa_rpc8.orders),
 (SELECT count(*) FROM qa_rpc8.order_items),
 (SELECT count(*) FROM qa_rpc8.conversations),
 (SELECT count(*) FROM qa_rpc8.messages);
ROLLBACK;
SQL
  reader_pid=$!
  wait_for "SELECT count(*) FROM pg_stat_activity WHERE application_name='rpc10_reader' AND state='active' AND wait_event_type='Lock'" "reader actually blocked by cutover lock ($decision)"
  wait "$writer_pid" || { echo "FAIL writer $decision";cat "$tmp/writer";exit 1; }
  writer_pid=''
  wait "$reader_pid" || { echo "FAIL reader $decision";cat "$tmp/reader";exit 1; }
  reader_pid=''
  observed="$(tr -d '[:space:]' < "$tmp/reader" | tr ',' '|')"
  [[ "$observed" == "$expect" ]] || { echo "FAIL reader $decision expected=$expect observed=$observed";exit 1; }
  echo "PASS: reader saw only $decision-consistent policy and data"
}
# ROLLBACK must restore pre-cutover Tenant-only view: 2 rows in each table.
exercise ROLLBACK '2|2|2|2|2'
[[ "$(get_flag "SELECT count(*) FROM qa_rpc8.products WHERE store_id IS NOT NULL")" == 0 ]] || exit 1
# COMMIT must expose only Store A rows: 1 each, no half-mapped Tenant rows.
exercise COMMIT '1|1|1|1|1'
[[ "$(get_flag "SELECT count(*) FROM qa_rpc8.products WHERE store_id IS NOT NULL")" == 3 ]] || exit 1
[[ "$(get_flag "SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8' AND tablename IN ('products','orders','customers','order_items','conversations','messages') AND policyname IN ('products_member_read','orders_manager_read','customers_manager_read','order_items_manager_read','conversations_manager_read','messages_manager_read')")" == 0 ]] || exit 1
echo 'PASS RPC10-G2 two real concurrent PG17 sessions: lock wait observed; rollback old state, commit Store-scoped state; NO HOSTED claims'
