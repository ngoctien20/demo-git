#!/usr/bin/env bash
# V17.2C.35 — GitHub Actions EPHEMERAL PostgreSQL 17 ONLY.
# Contains synthetic database writes, NEVER to Supabase or real orders.
set -euo pipefail
[[ "${PGHOST:-}" == "127.0.0.1" && "${PGPORT:-}" == "5432" &&
   "${PGDATABASE:-}" == "postgres" && "${PGUSER:-}" == "postgres" ]] || {
 echo 'DENY_NON_EPHEMERAL_DATABASE';exit 91;
}
root='qa/v172c-rpc-closure'
s='tien404_v172c35_atomic_qa'
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
q(){ psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
commit(){ q "SELECT $s.commit_synthetic_order('$1');"; }
fail_sql(){
 local label="$1" marker="$2" sql="$3"
 if q "$sql" >"$tmp/denied" 2>&1;then
  echo "FAIL: $label unexpectedly succeeded";exit 2;
 fi
 if ! grep -Fq "$marker" "$tmp/denied";then
  echo "FAIL: $label returned unexpected error, not $marker";exit 3;
 fi
}
stock(){ q "SELECT stock_on_hand FROM $s.inventory WHERE tenant_ref='$1' AND store_ref='$2' AND sku='SYN-SKU';"; }
orders(){ q "SELECT count(*) FROM $s.orders;"; }
items(){ q "SELECT count(*) FROM $s.order_items;"; }

psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c35-atomic-order-commit-CI_ONLY.sql"
[[ "$(stock tenant-1 store-A)" == 3 && "$(stock tenant-1 store-B)" == 2 &&
   "$(stock tenant-2 store-C)" == 1 ]] || {
 echo 'FAIL: synthetic stock baseline';exit 4; }
[[ "$(orders)" == 0 && "$(items)" == 0 ]] || {
 echo 'FAIL: synthetic order ledger starts nonempty';exit 5; }
# No callable order-writer function or QA schema for external API roles.
[[ "$(q "SELECT has_function_privilege('anon','$s.commit_synthetic_order(text,text)','EXECUTE');")" == f ]] || {
 echo 'FAIL: anon execute privilege';exit 6; }
[[ "$(q "SELECT has_function_privilege('authenticated','$s.commit_synthetic_order(text,text)','EXECUTE');")" == f ]] || {
 echo 'FAIL: authenticated execute privilege';exit 7; }
[[ "$(q "SELECT has_schema_privilege('authenticated','$s','USAGE');")" == f ]] || {
 echo 'FAIL: authenticated schema exposure';exit 8; }
echo 'SQL function and schema permissions: DENY anon/authenticated PASS'

for name in legacy-A bad-confirm-A bad-challenge-A stale-session-A bad-actor-A \
            expired-A;do
 fail_sql "$name" 'DENY_' "SELECT $s.commit_synthetic_order('$name');"
done
fail_sql 'untrusted missing intent' 'DENY_NO_PRIVATE_INTENT' \
 "SELECT $s.commit_synthetic_order('intent-from-public');"
fail_sql 'cross-Store product name not enough' 'DENY_PRODUCT_NOT_IN_STORE' \
 "SELECT $s.commit_synthetic_order('bad-sku-A');"
fail_sql 'mismatched confirmed VND total' 'DENY_PRICE_CHANGED_OR_OVERFLOW' \
 "SELECT $s.commit_synthetic_order('wrong-price-A');"
fail_sql 'insufficient stock' 'DENY_STOCK_INSUFFICIENT' \
 "SELECT $s.commit_synthetic_order('oversell-A');"
# Attempt to forge installation-B into an A-store intent is blocked by FK.
fail_sql 'forged installation/store binding' 'violates foreign key constraint' \
 "INSERT INTO $s.private_intents
   SELECT 'forged-install-A',tenant_ref,store_ref,actor_ref,
     'install-B',channel,'evt-forged-install',sku,quantity,
     expected_total_vnd,source_lane,origin_workflow_id,session_current,
     provider_verified,confirmation_verified,challenge_consumed,valid_until
   FROM $s.private_intents WHERE intent_ref='fault-stock-A';"
[[ "$(orders)" == 0 && "$(items)" == 0 && "$(stock tenant-1 store-A)" == 3 ]] || {
 echo 'FAIL: denied attempts had side effects';exit 9; }
echo 'Legacy, no consent, actor mismatch, price/stock, cross-Store installation DENIED PASS'

# Inject exception after stock decrement. The PostgreSQL transaction must
# roll back stock, order and item together.
fail_sql 'fault injected after stock update' 'QA_INJECTED_FAILURE_AFTER_STOCK' \
 "SELECT $s.commit_synthetic_order('fault-stock-A','after_stock');"
[[ "$(stock tenant-1 store-A)" == 3 && "$(orders)" == 0 && "$(items)" == 0 ]] || {
 echo 'FAIL: partial stock write survived fault';exit 10; }
# After order header insert, an exception must also roll back the header.
fail_sql 'fault injected after order insert' 'QA_INJECTED_FAILURE_AFTER_ORDER' \
 "SELECT $s.commit_synthetic_order('fault-order-A','after_order');"
[[ "$(stock tenant-1 store-A)" == 3 && "$(orders)" == 0 && "$(items)" == 0 ]] || {
 echo 'FAIL: partial order/header write survived fault';exit 11; }
echo 'Injected after-stock and after-order failures: entire transaction ROLLBACK PASS'

# A price changed since confirmation must be rechecked WHILE stock row locked.
q "UPDATE $s.inventory SET price_vnd=160000
   WHERE tenant_ref='tenant-1' AND store_ref='store-A' AND sku='SYN-SKU';" >/dev/null
fail_sql 'price drift before commit' 'DENY_PRICE_CHANGED_OR_OVERFLOW' \
 "SELECT $s.commit_synthetic_order('fault-stock-A');"
q "UPDATE $s.inventory SET price_vnd=159000
   WHERE tenant_ref='tenant-1' AND store_ref='store-A' AND sku='SYN-SKU';" >/dev/null
[[ "$(stock tenant-1 store-A)" == 3 && "$(orders)" == 0 ]] || {
 echo 'FAIL: price drift changed stock/order';exit 12; }
echo 'Price drift fails closed without stock/order side effects PASS'

[[ "$(commit ok-A)" == 'COMMITTED_SYNTHETIC_CI_ONLY' ]] || {
 echo 'FAIL: synthetic Store A order not committed';exit 13; }
[[ "$(commit ok-B)" == 'COMMITTED_SYNTHETIC_CI_ONLY' ]] || {
 echo 'FAIL: synthetic Store B order not committed';exit 14; }
# Same external event reference in different Store AND different channel does
# not collide; Store-scoped idempotency key includes both dimensions.
[[ "$(orders)" == 2 && "$(items)" == 2 &&
   "$(stock tenant-1 store-A)" == 1 && "$(stock tenant-1 store-B)" == 1 ]] || {
 echo 'FAIL: scoped stock/records after A/B';exit 15; }
[[ "$(commit ok-A)" == 'DUPLICATE_SAME_INTENT_NO_WRITE' ]] || {
 echo 'FAIL: same intent replay duplicated';exit 16; }
fail_sql 'same event reused for another intent in Store A' \
 'DENY_EVENT_REUSED_FOR_ANOTHER_INTENT' \
 "SELECT $s.commit_synthetic_order('replay-other-intent-A');"
[[ "$(orders)" == 2 && "$(items)" == 2 && "$(stock tenant-1 store-A)" == 1 ]] || {
 echo 'FAIL: event replay changed order/stock';exit 17; }
echo 'Store-scoped event idempotency: retry exact intent no write, changed intent DENIED PASS'

# Race with DISTINCT events for the final Store A unit. Row-level
# FOR UPDATE on inventory must serialize and prevent selling 2 from 1.
q "SELECT $s.commit_synthetic_order('race-A1');" >"$tmp/race-a1" 2>&1 &
p1=$!
q "SELECT $s.commit_synthetic_order('race-A2');" >"$tmp/race-a2" 2>&1 &
p2=$!
if wait "$p1";then r1=0;else r1=1;fi
if wait "$p2";then r2=0;else r2=1;fi
if [[ $((r1+r2)) != 1 ]];then
 echo "FAIL: oversell race expected 1 success, got failures=$((r1+r2))";exit 18;
fi
if [[ "$r1" == 1 ]];then grep -Fq 'DENY_STOCK_INSUFFICIENT' "$tmp/race-a1";fi
if [[ "$r2" == 1 ]];then grep -Fq 'DENY_STOCK_INSUFFICIENT' "$tmp/race-a2";fi
[[ "$(stock tenant-1 store-A)" == 0 && "$(orders)" == 3 &&
   "$(items)" == 3 ]] || {
 echo 'FAIL: oversell/concurrent order consistency';exit 19; }
echo 'Concurrent distinct events sharing last Store A unit: exactly one commit PASS'

# Separate replay race on Store C: two private intents same event; unique
# tenant/store/channel/event and advisory transaction lock permit one only.
q "INSERT INTO $s.private_intents
 (intent_ref,tenant_ref,store_ref,actor_ref,installation_ref,channel,
 provider_event_ref,sku,quantity,expected_total_vnd,source_lane,
 origin_workflow_id,session_current,provider_verified,
 confirmation_verified,challenge_consumed,valid_until) VALUES
 ('same-C1','tenant-2','store-C','actor-C','install-C','messenger',
 'evt-same-C','SYN-SKU',1,359000,'commerce_v2_candidate',
 'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour'),
 ('same-C2','tenant-2','store-C','actor-C','install-C','messenger',
 'evt-same-C','SYN-SKU',1,359000,'commerce_v2_candidate',
 'commerce_v2_candidate_no_send',true,true,true,true,now()+interval '1 hour');" >/dev/null
q "SELECT $s.commit_synthetic_order('same-C1');" >"$tmp/race-c1" 2>&1 &
p1=$!
q "SELECT $s.commit_synthetic_order('same-C2');" >"$tmp/race-c2" 2>&1 &
p2=$!
if wait "$p1";then r1=0;else r1=1;fi
if wait "$p2";then r2=0;else r2=1;fi
if [[ $((r1+r2)) != 1 ]];then
 echo "FAIL: same event race expected exactly one success";exit 20;
fi
if [[ "$r1" == 1 ]];then grep -Fq 'DENY_EVENT_REUSED_FOR_ANOTHER_INTENT' "$tmp/race-c1";fi
if [[ "$r2" == 1 ]];then grep -Fq 'DENY_EVENT_REUSED_FOR_ANOTHER_INTENT' "$tmp/race-c2";fi
[[ "$(stock tenant-2 store-C)" == 0 && "$(orders)" == 4 &&
   "$(items)" == 4 ]] || {
 echo 'FAIL: concurrent idempotency/order integrity';exit 21; }
echo 'Concurrent same event in Store C: only one transaction can commit PASS'

# A previously valid event cannot be reused to learn about orders after
# owner membership was revoked. Store B remains independently functional.
q "UPDATE $s.store_owners SET active=false
   WHERE tenant_ref='tenant-1' AND store_ref='store-A' AND actor_ref='actor-A';" >/dev/null
fail_sql 'revoked owner duplicate retry' 'DENY_STORE_AUTHORITY' \
 "SELECT $s.commit_synthetic_order('ok-A');"
[[ "$(commit ok-B)" == 'DUPLICATE_SAME_INTENT_NO_WRITE' ]] || {
 echo 'FAIL: Store B impacted by Store A revocation';exit 22; }
# Check exact VND arithmetic and Store isolation on committed synthetic rows.
[[ "$(q "SELECT COALESCE(sum(total_vnd),0) FROM $s.orders
     WHERE tenant_ref='tenant-1' AND store_ref='store-A';")" == 477000 ]] || {
 echo 'FAIL: Store A totals';exit 23; }
[[ "$(q "SELECT COALESCE(sum(total_vnd),0) FROM $s.orders
     WHERE tenant_ref='tenant-1' AND store_ref='store-B';")" == 259000 ]] || {
 echo 'FAIL: Store B totals';exit 24; }
[[ "$(q "SELECT count(*) FROM $s.order_items i JOIN $s.orders o
 ON i.order_ref=o.order_ref WHERE i.tenant_ref<>o.tenant_ref
 OR i.store_ref<>o.store_ref;")" == 0 ]] || {
 echo 'FAIL: Order items crossed Store or Tenant';exit 25; }
echo 'Revocation, unaffected Store B, VND totals and item Store lineage PASS'
echo 'V17.2C.35 EPHEMERAL_ATOMIC_ORDER_QA_PASS NO_REMOTE_WRITES NO_EXTERNAL_SEND'
