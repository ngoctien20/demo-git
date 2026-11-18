#!/usr/bin/env bash
# V17.2C.36 — ONLY GitHub Actions' disposable Postgres 17.
set -euo pipefail
[[ "${PGHOST:-}" == '127.0.0.1' && "${PGPORT:-}" == '5432' &&
   "${PGDATABASE:-}" == 'postgres' && "${PGUSER:-}" == 'postgres' ]] || {
 echo 'DENY_REMOTE_DATABASE';exit 91;
}
s=tien404_v172c36_multiline_qa
root=qa/v172c-rpc-closure
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
q(){ psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
reserve(){ q "SELECT $s.reserve_synthetic_multiline('$1');"; }
trans(){ q "SELECT $s.transition_synthetic_order('$1');"; }
stock(){ q "SELECT on_hand||','||reserved FROM $s.inventory WHERE tenant_ref='$1' AND store_ref='$2' AND sku='$3';"; }
status(){ q "SELECT status FROM $s.orders WHERE order_ref='SYN36-$1';"; }
count_orders(){ q "SELECT count(*) FROM $s.orders;"; }
expect_fail(){
 local label="$1" expected="$2" sql="$3"
 if q "$sql" >"$tmp/err" 2>&1;then
   echo "FAIL: $label unexpectedly succeeded";exit 2;
 fi
 if ! grep -Fq "$expected" "$tmp/err";then
   echo "FAIL: $label expected $expected, got";tail -n 3 "$tmp/err";exit 3;
 fi
}
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c36-multiline-reservation-ci-only.sql"
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c36-multiline-private-fixtures-ci-only.sql"

[[ "$(q "SELECT has_function_privilege('anon','$s.reserve_synthetic_multiline(text,text)','EXECUTE');")" == f &&
   "$(q "SELECT has_function_privilege('authenticated','$s.transition_synthetic_order(text,text)','EXECUTE');")" == f &&
   "$(q "SELECT has_schema_privilege('authenticated','$s','USAGE');")" == f ]] || {
 echo 'FAIL: API role can invoke private multi-SKU transaction';exit 4; }
[[ "$(stock tenant-1 store-A SKU-A)" == '6,0' &&
   "$(stock tenant-1 store-A SKU-B)" == '7,0' &&
   "$(stock tenant-1 store-B SKU-A)" == '5,0' ]] || {
 echo 'FAIL: initial warehouse fixture';exit 5; }
echo 'Private functions and synthetic Store inventory baseline PASS'

for ref in legacy-A no-confirm-A no-challenge-A session-stale-A wrong-actor-A;do
 expect_fail "$ref" DENY_ "SELECT $s.reserve_synthetic_multiline('$ref');"
done
expect_fail 'missing Store A SKU even if present elsewhere' DENY_MISSING_STORE_SKU \
 "SELECT $s.reserve_synthetic_multiline('missing-sku-A');"
expect_fail 'incorrect cart total' DENY_TOTAL_MISMATCH \
 "SELECT $s.reserve_synthetic_multiline('bad-total-A');"
expect_fail 'untrusted opaque intent' DENY_NO_PRIVATE_INTENT \
 "SELECT $s.reserve_synthetic_multiline('invented-intent');"
# Unit price is locked/revalidated even if price changed after confirmation.
q "UPDATE $s.inventory SET price_vnd=160000 WHERE tenant_ref='tenant-1'
 AND store_ref='store-A' AND sku='SKU-A';" >/dev/null
expect_fail 'repricing after approved cart' DENY_PRICE_CHANGED \
 "SELECT $s.reserve_synthetic_multiline('price-drift-A');"
q "UPDATE $s.inventory SET price_vnd=159000 WHERE tenant_ref='tenant-1'
 AND store_ref='store-A' AND sku='SKU-A';" >/dev/null
[[ "$(count_orders)" == 0 && "$(stock tenant-1 store-A SKU-A)" == '6,0' &&
   "$(stock tenant-1 store-A SKU-B)" == '7,0' ]] || {
 echo 'FAIL: denied requests touched inventory';exit 6; }
echo 'Legacy, cross-Store SKU, price/total and unauthorized intent DENIED PASS'

# Inject faults at each stage. Every individual SELECT is a PostgreSQL
# transaction; errors roll back all affected inventory/order/item rows.
for mode in after_first_reserve after_header after_first_item;do
 expect_fail "$mode" 'QA_FAULT_' \
  "SELECT $s.reserve_synthetic_multiline('fault-A','$mode');"
 [[ "$(stock tenant-1 store-A SKU-A)" == '6,0' &&
    "$(stock tenant-1 store-A SKU-B)" == '7,0' &&
    "$(count_orders)" == 0 ]] || {
  echo "FAIL: $mode left a partial reservation";exit 7;
 }
done
echo 'Reserve faults after first SKU, header and first item: full rollback PASS'

[[ "$(reserve confirm-A)" == 'RESERVED_SYNTHETIC_CI_ONLY' &&
   "$(reserve B-order)" == 'RESERVED_SYNTHETIC_CI_ONLY' &&
   "$(reserve C-order)" == 'RESERVED_SYNTHETIC_CI_ONLY' ]] || {
 echo 'FAIL: independent Store A/B/C reservations';exit 8; }
# Reserving does NOT consume physical on_hand (unlike the V35 committed order).
[[ "$(stock tenant-1 store-A SKU-A)" == '6,2' &&
   "$(stock tenant-1 store-A SKU-B)" == '7,1' &&
   "$(stock tenant-1 store-B SKU-A)" == '5,1' &&
   "$(stock tenant-1 store-B SKU-B)" == '5,1' &&
   "$(stock tenant-2 store-C SKU-A)" == '2,1' ]] || {
 echo 'FAIL: reserved stock, on_hand or cross-Store consistency';exit 9; }
[[ "$(status confirm-A)" == reserved && "$(count_orders)" == 3 ]] || {
 echo 'FAIL: missing reserved order A/B/C';exit 10; }
[[ "$(reserve confirm-A)" == DUPLICATE_RESERVATION_NO_WRITE ]] || {
 echo 'FAIL: same intent created duplicate reservation';exit 11; }
expect_fail 'one provider event reused in Store A for different cart' \
 DENY_PROVIDER_EVENT_REUSED \
 "SELECT $s.reserve_synthetic_multiline('replay-other-A');"
[[ "$(count_orders)" == 3 && "$(stock tenant-1 store-A SKU-A)" == '6,2' ]] || {
 echo 'FAIL: replay mutated stock/order';exit 12; }
echo 'Multi-line reserves keep on_hand intact, scoped A/B/C and exact replay no-op PASS'

# Confirm consumes precisely the previously reserved quantities, once.
for mode in after_first_stock after_status;do
 expect_fail "confirm $mode" QA_FAULT_ \
 "SELECT $s.transition_synthetic_order('act-confirm-A','$mode');"
 [[ "$(status confirm-A)" == reserved &&
    "$(stock tenant-1 store-A SKU-A)" == '6,2' &&
    "$(stock tenant-1 store-A SKU-B)" == '7,1' ]] || {
 echo "FAIL: confirmed transaction partial after $mode";exit 13; }
done
[[ "$(trans act-confirm-A)" == TRANSITIONED_SYNTHETIC_CI_ONLY ]] || {
 echo 'FAIL: confirmation did not consume reservation';exit 14; }
[[ "$(status confirm-A)" == confirmed &&
   "$(stock tenant-1 store-A SKU-A)" == '4,0' &&
   "$(stock tenant-1 store-A SKU-B)" == '6,0' &&
   "$(trans act-confirm-A)" == DUPLICATE_TRANSITION_NO_WRITE ]] || {
 echo 'FAIL: confirmed stock consumed twice';exit 15; }
echo 'Confirmed order consumes stock once, injected transition faults rollback PASS'

# Cancellation releases reserved quantities without increasing physical stock.
[[ "$(reserve cancel-A)" == RESERVED_SYNTHETIC_CI_ONLY ]] || {
 echo 'FAIL: cancel fixture not reserved';exit 16; }
[[ "$(stock tenant-1 store-A SKU-A)" == '4,1' &&
   "$(stock tenant-1 store-A SKU-B)" == '6,1' ]] || {
 echo 'FAIL: cancel reservation missing';exit 17; }
for mode in after_first_stock after_status;do
 expect_fail "cancel $mode" QA_FAULT_ \
 "SELECT $s.transition_synthetic_order('act-cancel-A','$mode');"
 [[ "$(status cancel-A)" == reserved &&
    "$(stock tenant-1 store-A SKU-A)" == '4,1' ]] || {
 echo "FAIL: failed cancel $mode partially released";exit 18; }
done
expect_fail 'early expiry before ttl' DENY_NOT_EXPIRED \
 "SELECT $s.transition_synthetic_order('act-tooearly-A');"
expect_fail 'other Store principal cannot cancel A order' DENY_ORDER_SCOPE \
 "SELECT $s.transition_synthetic_order('act-cross-B');"
expect_fail 'unauthorized transition flag' DENY_ACTION_AUTH \
 "SELECT $s.transition_synthetic_order('act-noauth-A');"
expect_fail 'stale transition session' DENY_ACTION_AUTH \
 "SELECT $s.transition_synthetic_order('act-stale-A');"
[[ "$(trans act-cancel-A)" == TRANSITIONED_SYNTHETIC_CI_ONLY &&
   "$(trans act-cancel-A)" == DUPLICATE_TRANSITION_NO_WRITE ]] || {
 echo 'FAIL: idempotent cancellation';exit 19; }
[[ "$(status cancel-A)" == cancelled &&
   "$(stock tenant-1 store-A SKU-A)" == '4,0' &&
   "$(stock tenant-1 store-A SKU-B)" == '6,0' ]] || {
 echo 'FAIL: cancellation modified on_hand or leaked reserved stock';exit 20; }
echo 'Cancelled order released reserved stock only, never doubled physical stock PASS'

# Expiry releases held stock, cannot confirm after TTL, cannot expire early.
[[ "$(reserve expire-A)" == RESERVED_SYNTHETIC_CI_ONLY ]] || {
 echo 'FAIL: expiring order not reserved';exit 21; }
expect_fail 'expire too early' DENY_NOT_EXPIRED \
 "SELECT $s.transition_synthetic_order('act-expire-A');"
q "UPDATE $s.orders SET reservation_expires_at=clock_timestamp()-interval '1 minute'
 WHERE order_ref='SYN36-expire-A';" >/dev/null
expect_fail 'confirm expired reservation' DENY_RESERVATION_EXPIRED \
 "SELECT $s.transition_synthetic_order('act-expired-confirm');"
[[ "$(trans act-expire-A)" == TRANSITIONED_SYNTHETIC_CI_ONLY &&
   "$(trans act-expire-A)" == DUPLICATE_TRANSITION_NO_WRITE ]] || {
 echo 'FAIL: expiry not idempotent';exit 22; }
[[ "$(status expire-A)" == expired &&
   "$(stock tenant-1 store-A SKU-A)" == '4,0' ]] || {
 echo 'FAIL: expiry did not release stock';exit 23; }
echo 'Expiry deadline, denied late confirm, atomic release PASS'

# Last physical unit of SKU-RACE in Store A: two different events reserve
# distinct multi-line carts; only one may reserve the SKU-RACE.
q "SELECT $s.reserve_synthetic_multiline('race-A1');" >"$tmp/race-1" 2>&1 &
p1=$!
q "SELECT $s.reserve_synthetic_multiline('race-A2');" >"$tmp/race-2" 2>&1 &
p2=$!
if wait "$p1";then r1=0;else r1=1;fi
if wait "$p2";then r2=0;else r2=1;fi
[[ $((r1+r2)) == 1 ]] || { echo 'FAIL: final-stock reservation race';exit 24; }
if [[ "$r1" == 1 ]];then grep -Fq DENY_INSUFFICIENT_AVAILABLE_STOCK "$tmp/race-1";fi
if [[ "$r2" == 1 ]];then grep -Fq DENY_INSUFFICIENT_AVAILABLE_STOCK "$tmp/race-2";fi
[[ "$(stock tenant-1 store-A SKU-RACE)" == '1,1' ]] || {
 echo 'FAIL: final unit oversubscribed';exit 25; }
echo 'Concurrent different-event multi-line reservations cannot oversell last SKU PASS'

# Two distinct intents with exactly the same provider event must serialize.
q "SELECT $s.reserve_synthetic_multiline('same-event-A1');" >"$tmp/idem-1" 2>&1 &
p1=$!
q "SELECT $s.reserve_synthetic_multiline('same-event-A2');" >"$tmp/idem-2" 2>&1 &
p2=$!
if wait "$p1";then r1=0;else r1=1;fi
if wait "$p2";then r2=0;else r2=1;fi
[[ $((r1+r2)) == 1 ]] || { echo 'FAIL: simultaneous same-event requests';exit 26; }
if [[ "$r1" == 1 ]];then grep -Fq DENY_PROVIDER_EVENT_REUSED "$tmp/idem-1";fi
if [[ "$r2" == 1 ]];then grep -Fq DENY_PROVIDER_EVENT_REUSED "$tmp/idem-2";fi
echo 'Concurrent same-event idempotency: exactly one reservation PASS'

# Racing terminal actions on a reserved order: confirm OR cancel, never both.
[[ "$(reserve terminal-A)" == RESERVED_SYNTHETIC_CI_ONLY ]] || {
 echo 'FAIL: terminal fixture missing';exit 27; }
q "SELECT $s.transition_synthetic_order('act-terminal-confirm');" >"$tmp/terminal-confirm" 2>&1 &
p1=$!
q "SELECT $s.transition_synthetic_order('act-terminal-cancel');" >"$tmp/terminal-cancel" 2>&1 &
p2=$!
if wait "$p1";then r1=0;else r1=1;fi
if wait "$p2";then r2=0;else r2=1;fi
[[ $((r1+r2)) == 1 ]] || { echo 'FAIL: double finalization race';exit 28; }
if [[ "$r1" == 1 ]];then grep -Fq DENY_ORDER_NOT_RESERVED "$tmp/terminal-confirm";fi
if [[ "$r2" == 1 ]];then grep -Fq DENY_ORDER_NOT_RESERVED "$tmp/terminal-cancel";fi
[[ "$(status terminal-A)" == confirmed || "$(status terminal-A)" == cancelled ]] || {
 echo 'FAIL: final state not terminal';exit 29; }
[[ "$(q "SELECT count(*) FROM $s.transition_receipts
 WHERE order_ref='SYN36-terminal-A';")" == 1 ]] || {
 echo 'FAIL: double transition ledger';exit 30; }
echo 'Concurrent confirm-vs-cancel: exactly one terminal action PASS'

# Inventory invariants across all Stores: reserved stock exactly equals
# quantities in outstanding reserved order items (no hidden leaks).
[[ "$(q "SELECT count(*) FROM $s.inventory i WHERE i.reserved<>COALESCE((
 SELECT sum(oi.quantity) FROM $s.order_items oi JOIN $s.orders o
 ON o.order_ref=oi.order_ref AND o.tenant_ref=oi.tenant_ref
 AND o.store_ref=oi.store_ref
 WHERE o.status='reserved' AND oi.tenant_ref=i.tenant_ref
 AND oi.store_ref=i.store_ref AND oi.sku=i.sku),0);")" == 0 ]] || {
 echo 'FAIL: reserved inventory differs from pending order items';exit 31; }
[[ "$(q "SELECT count(*) FROM $s.orders o WHERE
 o.total_vnd<>(SELECT COALESCE(sum(i.total_vnd),0) FROM $s.order_items i
 WHERE i.order_ref=o.order_ref)
 OR (SELECT count(*) FROM $s.order_items i WHERE i.order_ref=o.order_ref)<2;")" == 0 ]] || {
 echo 'FAIL: multiline totals or minimum line count';exit 32; }
[[ "$(q "SELECT count(*) FROM $s.order_items i JOIN $s.orders o
 ON i.order_ref=o.order_ref
 WHERE i.tenant_ref<>o.tenant_ref OR i.store_ref<>o.store_ref;")" == 0 ]] || {
 echo 'FAIL: cross-Store order lines';exit 33; }

# Previously accepted actor is revoked: retry and transition must fail,
# but other Store B and C remain unaffected and pending.
q "UPDATE $s.actors SET active=false WHERE tenant_ref='tenant-1'
 AND store_ref='store-A' AND actor_ref='actor-A';" >/dev/null
expect_fail 'revoked A retry' DENY_STORE_AUTHORITY \
 "SELECT $s.reserve_synthetic_multiline('confirm-A');"
expect_fail 'revoked A transition retry' DENY_ACTION_STORE_AUTHORITY \
 "SELECT $s.transition_synthetic_order('act-confirm-A');"
[[ "$(stock tenant-1 store-B SKU-A)" == '5,1' &&
   "$(stock tenant-2 store-C SKU-A)" == '2,1' &&
   "$(status B-order)" == reserved && "$(status C-order)" == reserved ]] || {
 echo 'FAIL: Store A revocation impacted Store B or C';exit 34; }
echo 'Stock ledger, VND totals, Store lineage, revocation and unaffected B/C PASS'
echo 'V17.2C.36 ISOLATED_MULTILINE_RESERVATION_RELEASE_QA_PASS NO_EXTERNAL_SEND NO_SUPABASE_WRITE'
