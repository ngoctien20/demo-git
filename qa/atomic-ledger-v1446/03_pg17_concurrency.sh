#!/usr/bin/env bash
# V14.4.6 concurrency test after 02_pg17_assertions.sh on exact CI DB.
set -euo pipefail
if [[ "$CI_V1446_DISPOSABLE" != YES || "$PGDATABASE" != tien404_v1446_ci ||
 "$PGHOST" != postgres || "$PGUSER" != postgres ||
 "$PGOPTIONS" != *tien404.v1446_ephemeral=YES* ]]; then
 echo 'BLOCKED: V1446 DISPOSABLE PG17 ONLY'; exit 42
fi
TA=11111111-1111-4111-8111-111111111111
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
BA=11111111-aaaa-4aaa-8aaa-111111111111
OA=11111111-bbbb-4bbb-8bbb-111111111111
BB=22222222-aaaa-4aaa-8aaa-222222222222
TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT
db(){
 psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"
}
db "INSERT INTO qa_v1446.products
(tenant_id,store_id,sku,price_vnd,on_hand)
VALUES('$TA','$SA','SKU-RACE',100000,3)" >/dev/null
db "SET tien404.v1446_actor='$BA';
 SELECT qa_v1446.request_order('$TA','$SA','req-race-first-001','SKU-RACE',2,200000)" >/dev/null
db "SET tien404.v1446_actor='$BA';
 SELECT qa_v1446.request_order('$TA','$SA','req-race-second-01','SKU-RACE',2,200000)" >/dev/null
ONE=$(db "select id from qa_v1446.orders where request_id='req-race-first-001'")
TWO=$(db "select id from qa_v1446.orders where request_id='req-race-second-01'")
set +e
psql -X -qAt -v ON_ERROR_STOP=1 -c "SET tien404.v1446_actor='$OA';
 SELECT qa_v1446.accept_order('$TA','$SA','$ONE')" >"$TEMP/one.out" 2>"$TEMP/one.err" &
p1=$!
psql -X -qAt -v ON_ERROR_STOP=1 -c "SET tien404.v1446_actor='$OA';
 SELECT qa_v1446.accept_order('$TA','$SA','$TWO')" >"$TEMP/two.out" 2>"$TEMP/two.err" &
p2=$!
wait "$p1"; r1=$?
wait "$p2"; r2=$?
set -e
if [[ "$r1:$r2" != '0:3' && "$r1:$r2" != '3:0' ]]; then
 echo "FAIL concurrent accept expected one winner/one insufficient-stock reject (rc1=$r1 rc2=$r2)";exit 1
fi
if ! grep -q 'INSUFFICIENT_AVAILABLE_STOCK_AT_ACCEPT' "$TEMP/one.err" &&
   ! grep -q 'INSUFFICIENT_AVAILABLE_STOCK_AT_ACCEPT' "$TEMP/two.err"; then
 echo 'FAIL concurrent accept did not reject oversell explicitly';exit 1
fi
echo 'PASS concurrent accept: one succeeds, the other atomically rejects insufficient stock'
actual=$(db "select on_hand||'|'||reserved from qa_v1446.products
 where tenant_id='$TA' and store_id='$SA' and sku='SKU-RACE'")
[[ "$actual" == '3|2' ]] || { echo "FAIL oversell inventory state $actual";exit 1; }
echo 'PASS concurrent accept: physical=3, reserved=2, available=1'
actual=$(db "select count(*) filter(where status='confirmed')||'|'||
 count(*) filter(where status='requested') from qa_v1446.orders
 where request_id in ('req-race-first-001','req-race-second-01')")
[[ "$actual" == '1|1' ]] || { echo "FAIL statuses after accept: $actual";exit 1; }
echo 'PASS concurrent accept: one confirmed, one still requested'
actual=$(db "select count(*) from qa_v1446.inventory_ledger
 where sku='SKU-RACE' and kind='RESERVE'")
[[ "$actual" == 1 ]] || { echo "FAIL double reserve ledger: $actual";exit 1; }
echo 'PASS concurrent accept: one reserve ledger event'

# Two independent clients send the EXACT SAME idempotency key concurrently.
# Both are valid and should produce one DB row with one replay=true response.
set +e
psql -X -qAt -v ON_ERROR_STOP=1 -c "SET tien404.v1446_actor='$BA';
 SELECT qa_v1446.request_order('$TA','$SA','req-race-same-key-01','SKU-RACE',1,100000)->>'replayed'" \
 >"$TEMP/dup1.out" 2>"$TEMP/dup1.err" &
p1=$!
psql -X -qAt -v ON_ERROR_STOP=1 -c "SET tien404.v1446_actor='$BA';
 SELECT qa_v1446.request_order('$TA','$SA','req-race-same-key-01','SKU-RACE',1,100000)->>'replayed'" \
 >"$TEMP/dup2.out" 2>"$TEMP/dup2.err" &
p2=$!
wait "$p1"; r1=$?
wait "$p2"; r2=$?
set -e
if [[ "$r1" != 0 || "$r2" != 0 ]]; then
 echo 'FAIL duplicate parallel request unexpectedly errored';exit 1
fi
wins=$(cat "$TEMP/dup1.out" "$TEMP/dup2.out" | grep -xc false || true)
replays=$(cat "$TEMP/dup1.out" "$TEMP/dup2.out" | grep -xc true || true)
if [[ "$wins" != 1 || "$replays" != 1 ]]; then
 echo "FAIL same-key response replay mix $wins $replays"; exit 1
fi
echo 'PASS concurrent same-key request: exactly one creator and one replay'
actual=$(db "select count(*) from qa_v1446.orders
 where tenant_id='$TA' and store_id='$SA' and request_id='req-race-same-key-01'")
[[ "$actual" == 1 ]] || { echo 'FAIL concurrent same-key duplicate orders';exit 1; }
echo 'PASS same-key concurrency: 1 unique committed Order row'
actual=$(db "select count(*) from qa_v1446.orders
 where tenant_id='$TA' and store_id='$SA' and request_id like 'req-race-%'")
[[ "$actual" == 3 ]] || { echo 'FAIL three race Requests not found';exit 1; }
echo 'PASS concurrency: precisely three distinct intentional requests'
# Confirm no cross-store stock change from racing on Store A.
actual=$(db "select on_hand||'|'||reserved from qa_v1446.products
 where tenant_id='$TA' and store_id='$SB' and sku='SKU-SAME'")
[[ "$actual" == '7|0' ]] || { echo 'FAIL Store B changed by Store A concurrency';exit 1; }
echo 'PASS Store B independent despite same tenant Store A race'
echo 'PASS V1446_REAL_PG17_ATOMIC_CONCURRENCY: 8 safety checks, NO HOSTED USE'
