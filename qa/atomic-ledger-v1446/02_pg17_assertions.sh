#!/usr/bin/env bash
# TIEN404 V14.4.6 — PG17 disposable SQL assertions, NOT HOSTED.
set -euo pipefail
if [[ "$CI_V1446_DISPOSABLE" != YES ||
      "$PGDATABASE" != tien404_v1446_ci ||
      "$PGUSER" != postgres ||
      "$PGHOST" != postgres ||
      "$PGOPTIONS" != *tien404.v1446_ephemeral=YES* ]]; then
  echo 'BLOCKED: exact disposable CI PG17 required'; exit 42
fi
version=$(psql -X -qAt -v ON_ERROR_STOP=1 -c 'show server_version_num')
[[ "$version" == 17* ]] || { echo 'BLOCKED: PG17 required'; exit 42; }
psql -X -qAt -v ON_ERROR_STOP=1 -f \
 qa/atomic-ledger-v1446/01_DISPOSABLE_PG17_ONLY.sql >/dev/null
passed=0
check() {
 local want="$1" sql="$2" title="$3" got
 got=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "$sql")
 if [[ "$got" != "$want" ]]; then
   echo "FAIL $title"; echo "EXPECTED $want GOT $got"; exit 1
 fi
 passed=$((passed+1)); echo "PASS $title"
}
deny(){
 local match="$1" sql="$2" title="$3" out rc
 set +e; out=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "$sql" 2>&1);rc=$?;set -e
 if [[ "$rc" == 0 || "$out" != *"$match"* ]]; then
   echo "FAIL $title: denial missing"; exit 1
 fi
 passed=$((passed+1)); echo "PASS $title"
}
TA=11111111-1111-4111-8111-111111111111
TB=22222222-2222-4222-8222-222222222222
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
SC=cccccccc-cccc-4ccc-8ccc-cccccccccccc
BA=11111111-aaaa-4aaa-8aaa-111111111111
OA=11111111-bbbb-4bbb-8bbb-111111111111
BB=22222222-aaaa-4aaa-8aaa-222222222222
OB=22222222-bbbb-4bbb-8bbb-222222222222

check "159000|3|0" \
 "select price_vnd,on_hand,reserved from qa_v1446.products where tenant_id='$TA' and store_id='$SA' and sku='SKU-SAME'" \
 "Store A baseline: price/stock/reserve"
check "209000|7|0" \
 "select price_vnd,on_hand,reserved from qa_v1446.products where tenant_id='$TA' and store_id='$SB' and sku='SKU-SAME'" \
 "Store B same tenant SKU with own price and stock"
deny "V1446_HARD_STOP" \
 "SET tien404.v1446_ephemeral=NO; SELECT qa_v1446.assert_ci()" \
 "mutation guard blocks absent CI flag"
check "requested|false|318000" \
 "SET tien404.v1446_actor='$BA';SELECT (j->>'status')||'|'||(j->>'replayed')||'|'||(j->>'total_vnd') FROM (SELECT qa_v1446.request_order('$TA','$SA','req-store-a-00001','SKU-SAME',2,318000) AS j) q" \
 "buyer Shop A creates an order request"
check "3|0" \
 "select on_hand,reserved from qa_v1446.products where tenant_id='$TA' and store_id='$SA' and sku='SKU-SAME'" \
 "request does not reserve or deduct stock"
check "1" \
 "select count(*) from qa_v1446.orders where tenant_id='$TA' and store_id='$SA' and request_id='req-store-a-00001'" \
 "one request row after first submit"
check "true" \
 "SET tien404.v1446_actor='$BA';SELECT qa_v1446.request_order('$TA','$SA','req-store-a-00001','SKU-SAME',2,318000)->>'replayed'" \
 "idempotent same request key and payload"
deny "IDEMPOTENCY_PAYLOAD_CONFLICT" \
 "SET tien404.v1446_actor='$BA';SELECT qa_v1446.request_order('$TA','$SA','req-store-a-00001','SKU-SAME',1,159000)" \
 "key replay with changed quantity denied"
deny "PRICE_TOTAL_MISMATCH" \
 "SET tien404.v1446_actor='$BA';SELECT qa_v1446.request_order('$TA','$SA','req-store-a-00002','SKU-SAME',1,1000)" \
 "tampered price and expected total denied"
deny "STORE_MEMBERSHIP_DENIED" \
 "SET tien404.v1446_actor='$BA';SELECT qa_v1446.request_order('$TA','$SB','req-forbidden-001','SKU-SAME',1,209000)" \
 "same tenant other Store access denied"
deny "STORE_MEMBERSHIP_DENIED" \
 "SET tien404.v1446_actor='$BA';SELECT qa_v1446.request_order('$TB','$SC','req-forbidden-002','SKU-SAME',1,259000)" \
 "other tenant access denied"
check "requested|false|418000" \
 "SET tien404.v1446_actor='$BB';SELECT (j->>'status')||'|'||(j->>'replayed')||'|'||(j->>'total_vnd') FROM (SELECT qa_v1446.request_order('$TA','$SB','req-store-b-00001','SKU-SAME',2,418000) AS j) q" \
 "Store B uses own correct price"
ORDER_A=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "select id from qa_v1446.orders where request_id='req-store-a-00001'")
ORDER_B=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "select id from qa_v1446.orders where request_id='req-store-b-00001'")
deny "STORE_MEMBERSHIP_DENIED" \
 "SET tien404.v1446_actor='$BA';SELECT qa_v1446.accept_order('$TA','$SA','$ORDER_A')" \
 "buyer cannot accept order as merchant"
deny "ORDER_NOT_FOUND_IN_STORE" \
 "SET tien404.v1446_actor='$OB';SELECT qa_v1446.accept_order('$TA','$SB','$ORDER_A')" \
 "merchant B cannot accept merchant A order"
check "confirmed" \
 "SET tien404.v1446_actor='$OA';SELECT qa_v1446.accept_order('$TA','$SA','$ORDER_A')" \
 "merchant A reserves exactly 2 on acceptance"
check "3|2" \
 "select on_hand,reserved from qa_v1446.products where tenant_id='$TA' and store_id='$SA' and sku='SKU-SAME'" \
 "confirmed reserves, does not deduct physical"
check "confirmed_replay" \
 "SET tien404.v1446_actor='$OA';SELECT qa_v1446.accept_order('$TA','$SA','$ORDER_A')" \
 "merchant acceptance replay idempotent"
check "1" \
 "select count(*) from qa_v1446.inventory_ledger where order_id='$ORDER_A' and kind='RESERVE'" \
 "only one reservation ledger event"
check "fulfilled" \
 "SET tien404.v1446_actor='$OA';SELECT qa_v1446.fulfil_order('$TA','$SA','$ORDER_A')" \
 "fulfil consumes reserved on-hand stock"
check "1|0" \
 "select on_hand,reserved from qa_v1446.products where tenant_id='$TA' and store_id='$SA' and sku='SKU-SAME'" \
 "physical stock now 1, reserved 0"
check "fulfilled_replay" \
 "SET tien404.v1446_actor='$OA';SELECT qa_v1446.fulfil_order('$TA','$SA','$ORDER_A')" \
 "fulfil retry does not double deduct"
deny "FULFILLED_REFUND_REQUIRES_SEPARATE_POLICY" \
 "SET tien404.v1446_actor='$OA';SELECT qa_v1446.cancel_order('$TA','$SA','$ORDER_A')" \
 "refund after fulfil blocked pending policy"
deny "IMMUTABLE_LEDGER_NO_UPDATE_OR_DELETE" \
 "UPDATE qa_v1446.inventory_ledger SET delta_on_hand=0 WHERE order_id='$ORDER_A'" \
 "inventory ledger update forbidden"
deny "IMMUTABLE_LEDGER_NO_UPDATE_OR_DELETE" \
 "DELETE FROM qa_v1446.inventory_ledger WHERE order_id='$ORDER_A'" \
 "inventory ledger delete forbidden"
check "confirmed" \
 "SET tien404.v1446_actor='$OB';SELECT qa_v1446.accept_order('$TA','$SB','$ORDER_B')" \
 "merchant B reserves own store"
check "7|2" \
 "select on_hand,reserved from qa_v1446.products where tenant_id='$TA' and store_id='$SB' and sku='SKU-SAME'" \
 "Store B reserved 2 independently"
check "cancelled" \
 "SET tien404.v1446_actor='$OB';SELECT qa_v1446.cancel_order('$TA','$SB','$ORDER_B')" \
 "cancel B releases 2 reserved"
check "7|0" \
 "select on_hand,reserved from qa_v1446.products where tenant_id='$TA' and store_id='$SB' and sku='SKU-SAME'" \
 "B cancellation restores availability"
check "cancelled_replay" \
 "SET tien404.v1446_actor='$OB';SELECT qa_v1446.cancel_order('$TA','$SB','$ORDER_B')" \
 "double cancel causes no duplicate release"
check "1|1|1" \
 "select count(*) filter(where kind='RESERVE'),count(*) filter(where kind='FULFIL'),count(*) filter(where kind='RELEASE') from qa_v1446.inventory_ledger where order_id='$ORDER_A' or order_id='$ORDER_B'" \
 "ledger event partition expected only single relevant kinds"
echo "V1446_FUNCTIONAL_SQL_CHECKS=$passed"
echo "PASS V1446 initial functional PG17 SQL safety checks. Not hosted."
