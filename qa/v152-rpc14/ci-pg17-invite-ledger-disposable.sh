#!/usr/bin/env bash
# Synthetic PG17 ONLY. No network to Supabase, no real merchant records.
set -euo pipefail
[[ "${CI:-}" == 'true' && "${T404_RPC14_DISPOSABLE:-}" == 'YES' &&
  "${PGDATABASE:-}" == 't404_rpc14_ci' && "${PGHOST:-}" == 'postgres' &&
  "${PGUSER:-}" == 'postgres' ]] || { echo 'RPC14_REFUSES_ANY_NON_DISPOSABLE_DATABASE';exit 3; }
[[ "$(psql -X -Atqc 'show server_version_num')" == 17* ]] || exit 3
[[ "$(psql -X -Atqc "select current_setting('tien404.rpc14_ephemeral',true)")" == 'RPC14_DISPOSABLE' ]] || exit 3
psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc14/pg17-invite-ledger-disposable-only.sql >/dev/null
check(){ local expected="$1" sql="$2" name="$3" got; got="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "$sql")";
 [[ "$expected" == "$got" ]] || { echo "FAIL $name expected=[$expected] got=[$got]";exit 1; };echo "PASS $name";}
call(){ local sql="$1";psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_rpc14_ingest;
$sql
ROLLBACK;
SQL
}
# FOR TEST DURABILITY, explicitly commit state changes. SET LOCAL only applies in transaction.
call_commit(){ local sql="$1"; psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_rpc14_ingest;
$sql
COMMIT;
SQL
}
expect_call(){ local expected="$1" sql="$2" name="$3" got;
 got="$(call_commit "$sql" | grep -E '^[tf]$' | head -1)";
 [[ "$got" == "$expected" ]] || { echo "FAIL $name expected=[$expected] got=[$got]";exit 1; };
 echo "PASS $name";
}
A=aaaaaaaa-0000-4000-8000-000000000001
B=bbbbbbbb-0000-4000-8000-000000000002
I1=11111111-1111-4111-8111-111111111111
I2=22222222-2222-4222-8222-222222222222
I3=33333333-3333-4333-8333-333333333333
I4=44444444-4444-4444-8444-444444444444
R1=aaaa0000-0000-4000-8000-000000000001
R2=bbbb0000-0000-4000-8000-000000000002
R4=dddd0000-0000-4000-8000-000000000004
SQL1="select qa_rpc14.reserve_once('$I1','$A',repeat('a',64),'P1','MERCHANT_ORIGINAL_CATALOG','$R1');"
check 4 'select count(*) from qa_rpc14.invite_ledger' 'four synthetic invitations'
check f 'select has_table_privilege('\''qa_rpc14_ingest'\'','\''qa_rpc14.invite_ledger'\'','\''SELECT'\'')' 'service cannot SELECT authority ledger'
check f 'select has_table_privilege('\''qa_rpc14_ingest'\'','\''qa_rpc14.invite_ledger'\'','\''UPDATE'\'')' 'service cannot UPDATE authority ledger'
check f 'select rolcanlogin from pg_roles where rolname='\''qa_rpc14_ingest'\''' 'service role cannot login'
check f 'select rolbypassrls from pg_roles where rolname='\''qa_rpc14_ingest'\''' 'service role cannot bypass RLS'
check f "select qa_rpc14.reserve_once('$I1','$B',repeat('a',64),'P1','MERCHANT_ORIGINAL_CATALOG','$R1');" 'wrong auth user denied'
check f "select qa_rpc14.reserve_once('$I1','$A',repeat('b',64),'P1','MERCHANT_ORIGINAL_CATALOG','$R1');" 'wrong Access subject digest denied'
check f "select qa_rpc14.reserve_once('$I1','$A',repeat('a',64),'O1','MERCHANT_ORIGINAL_CATALOG','$R1');" 'wrong slot denied'
check f "select qa_rpc14.reserve_once('$I1','$A',repeat('a',64),'P1','VERIFIED_MERCHANT_EXPORT','$R1');" 'wrong source type denied'
check f "select qa_rpc14.reserve_once('$I3','$A',repeat('a',64),'P2','MERCHANT_ORIGINAL_CATALOG','$R4');" 'expired invitation denied'
expect_call t "$SQL1" 'initial reservation atomic committed' # will be checked below
check RESERVED "select state from qa_rpc14.invite_ledger where invite_id='$I1'" 'reservation is durable'
expect_call f "$SQL1" 'replay denied even if same receipt'
expect_call f "select qa_rpc14.finalize_quarantine('$R1',repeat('a',64),0);" 'invalid file size denied'
expect_call f "select qa_rpc14.finalize_quarantine('$R1',repeat('x',64),1024);" 'invalid digest denied'
expect_call t "select qa_rpc14.finalize_quarantine('$R1',repeat('a',64),1024);" 'quarantine finalization committed'
check PENDING_MALWARE_SCAN "select state from qa_rpc14.invite_ledger where invite_id='$I1'" 'quarantine NOT approved'
expect_call f "select qa_rpc14.finalize_quarantine('$R1',repeat('a',64),1024);" 'double finalization denied'
expect_call f "select qa_rpc14.fail_quarantine('$R1');" 'cannot mark scanned pending as failed on stale receipt'
expect_call t "select qa_rpc14.reserve_once('$I4','$A',repeat('a',64),'O2','VERIFIED_MERCHANT_EXPORT','$R4');" 'separate invitation reserved'
expect_call t "select qa_rpc14.fail_quarantine('$R4');" 'quarantine failure recorded'
expect_call f "select qa_rpc14.reserve_once('$I4','$A',repeat('a',64),'O2','VERIFIED_MERCHANT_EXPORT','$R4');" 'failed invitation never reopened'
# Concurrent A/B same invitation: use two psql sessions. Exactly one should reserve.
TMP=$(mktemp -d);trap 'rm -rf "$TMP"' EXIT
QUERY="BEGIN; SET LOCAL ROLE qa_rpc14_ingest; SELECT qa_rpc14.reserve_once('$I2','$B',repeat('b',64),'O1','SIGNED_EXTERNAL_ORDER_SOURCE','$R2'); COMMIT;"
psql -X -qAt -v ON_ERROR_STOP=1 -c "$QUERY" >"$TMP/one" & pid1=$!
psql -X -qAt -v ON_ERROR_STOP=1 -c "$QUERY" >"$TMP/two" & pid2=$!
wait "$pid1";wait "$pid2"
COUNT=$(grep -h '^t$' "$TMP/one" "$TMP/two" | wc -l | tr -d ' ')
[[ "$COUNT" == '1' ]] || { echo "FAIL concurrent replay wins=$COUNT";exit 1; }
echo 'PASS exactly one of two simultaneous reservations wins'
check 3 "select count(*) from qa_rpc14.invite_ledger where state<>'ISSUED'" 'three consumed invitations'
check 1 "select count(*) from qa_rpc14.invite_ledger where state='PENDING_MALWARE_SCAN'" 'no auto-approval or scan bypass'
echo 'PASS RPC14 durable replay synthetic PG17 only; hosted proof/JWT still NO-GO'