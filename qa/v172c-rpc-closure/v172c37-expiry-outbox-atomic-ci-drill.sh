#!/usr/bin/env bash
# V17.2C.37: disposable GitHub Actions PostgreSQL only. NO SEND capability.
set -euo pipefail
[[ "$PGHOST" == 127.0.0.1 && "$PGDATABASE" == postgres &&
   "$PGPORT" == 5432 && "$PGUSER" == postgres ]] || {
 echo 'DENY_REMOTE_OR_LIVE_DATABASE';exit 91; }
root=qa/v172c-rpc-closure
s=tien404_v172c36_multiline_qa
x=tien404_v172c37_outbox_qa
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
q(){ psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
reserve(){ q "SELECT $s.reserve_synthetic_multiline('v37-$1');"; }
transition(){ q "SELECT $s.transition_synthetic_order('$1');"; }
worker(){ q "SELECT $x.expire_due_batch_no_send($1);"; }
available(){ q "SELECT on_hand||','||reserved FROM $s.inventory WHERE tenant_ref='$1' AND store_ref='$2' AND sku='$3';"; }
orderstatus(){ q "SELECT status FROM $s.orders WHERE order_ref='SYN36-v37-$1';"; }
eventcount(){ q "SELECT count(*) FROM $x.notification_outbox WHERE order_ref='SYN36-v37-$1' AND event_type='$2';"; }
all_events(){ q "SELECT count(*) FROM $x.notification_outbox;"; }
denied(){
 local label="$1" marker="$2" sql="$3"
 if q "$sql" >"$tmp/fail" 2>&1;then
   echo "FAIL: $label unexpectedly succeeded";exit 3;
 fi
 if ! grep -Fq "$marker" "$tmp/fail";then
   echo "FAIL: $label did not return $marker";tail -n 4 "$tmp/fail";exit 4;
 fi
}
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c37-expiry-outbox-ci-only.sql"
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c37-private-expiry-outbox-fixtures-ci-only.sql"

# V36 earlier transactions predate new triggers: do not generate
# synthetic notifications for old rows without explicit provenance.
[[ "$(all_events)" == 0 ]] || { echo 'FAIL: unexpected backfill/outbox';exit 5; }
[[ "$(q "SELECT has_schema_privilege('anon','$x','USAGE');")" == f &&
   "$(q "SELECT has_schema_privilege('authenticated','$x','USAGE');")" == f &&
   "$(q "SELECT has_function_privilege('authenticated','$x.expire_due_batch_no_send(integer,text)','EXECUTE');")" == f ]] || {
 echo 'FAIL: API role has access to outbox/worker';exit 6; }
[[ "$(q "SELECT count(*) FROM information_schema.columns
 WHERE table_schema='$x' AND table_name='notification_outbox'
 AND column_name IN ('recipient_id','recipient','sent_at','access_token','webhook_url');")" == 0 ]] || {
 echo 'FAIL: synthetic outbox includes delivery/credentials columns';exit 7; }
denied 'outbox cannot mark SENT' 'violates check constraint' \
 "INSERT INTO $x.notification_outbox(tenant_ref,store_ref,order_ref,event_type,dispatch_state)
 VALUES('tenant-1','store-B','SYN36-B-order','order.reserved','SENT');"
denied 'worker gate cannot enable sending' 'violates check constraint' \
 "UPDATE $x.expiry_worker_gate SET no_send=false WHERE singleton=true;"
[[ "$(all_events)" == 0 ]] || { echo 'FAIL: outbox guard attempts persisted';exit 8; }
echo 'Outbox no-send invariants, no PII/sender columns, caller grants denied PASS'

# A failed transaction after the Order header insert rolls back its
# AFTER INSERT outbox event as well as stock reservations and order rows.
denied 'reservation fault after outbox event INSERT' 'QA_FAULT_AFTER_HEADER' \
 "SELECT $s.reserve_synthetic_multiline('v37-reserve-fault-B','after_header');"
[[ "$(eventcount reserve-fault-B order.reserved)" == 0 &&
   "$(q "SELECT count(*) FROM $s.orders WHERE order_ref='SYN36-v37-reserve-fault-B';")" == 0 ]] || {
 echo 'FAIL: orphan reservation event after transaction failure';exit 9; }
# Force outbox recording failure: the complete reservation must roll back.
q "UPDATE $x.outbox_gate SET allow_event_recording=false;" >/dev/null
denied 'outbox recording refusal aborts order' DENY_OUTBOX_GATE \
 "SELECT $s.reserve_synthetic_multiline('v37-outbox-fail-B');"
q "UPDATE $x.outbox_gate SET allow_event_recording=true;" >/dev/null
[[ "$(eventcount outbox-fail-B order.reserved)" == 0 &&
   "$(available tenant-1 store-B SKU-A)" == 5,1 &&
   "$(available tenant-1 store-B SKU-B)" == 5,1 ]] || {
 echo 'FAIL: missing outbox produced partial Order or inventory';exit 10; }
echo 'Failed outbox insert or injected fault => no Order, no stock, no outbox PASS'

[[ "$(reserve hold-B)" == RESERVED_SYNTHETIC_CI_ONLY &&
   "$(reserve due-B)" == RESERVED_SYNTHETIC_CI_ONLY ]] || {
 echo 'FAIL: Store B hold or expiry reservation';exit 11; }
[[ "$(eventcount hold-B order.reserved)" == 1 &&
   "$(eventcount due-B order.reserved)" == 1 &&
   "$(available tenant-1 store-B SKU-A)" == 5,3 ]] || {
 echo 'FAIL: outbox not atomically appended with holds';exit 12; }
[[ "$(reserve hold-B)" == DUPLICATE_RESERVATION_NO_WRITE &&
   "$(eventcount hold-B order.reserved)" == 1 ]] || {
 echo 'FAIL: duplicate message on same-intent replay';exit 13; }

# Only explicit expiry worker call can expire. Preview is read-only count.
q "UPDATE $s.orders SET reservation_expires_at=clock_timestamp()-interval '1 minute'
 WHERE order_ref='SYN36-v37-due-B';" >/dev/null
[[ "$(q "SELECT $x.preview_due_count();")" == 1 ]] || {
 echo 'FAIL: preview did not find exactly one overdue Order';exit 14; }
[[ "$(orderstatus due-B)" == reserved && "$(eventcount due-B order.expired)" == 0 ]] || {
 echo 'FAIL: preview mutated order/outbox';exit 15; }
q "UPDATE $x.expiry_worker_gate SET enabled=false;" >/dev/null
denied 'disabled worker' DENY_EXPIRY_WORKER_GATE \
 "SELECT $x.expire_due_batch_no_send(1);"
q "UPDATE $x.expiry_worker_gate SET enabled=true;" >/dev/null
for fault in after_first_release after_status_outbox;do
 denied "worker $fault" QA_FAULT_EXPIRY \
   "SELECT $x.expire_due_batch_no_send(1,'$fault');"
 [[ "$(orderstatus due-B)" == reserved &&
    "$(eventcount due-B order.expired)" == 0 &&
    "$(available tenant-1 store-B SKU-A)" == 5,3 ]] || {
  echo "FAIL: expiry worker $fault left partial inventory/order/outbox";exit 16;
 }
done
[[ "$(worker 1)" == 1 && "$(worker 1)" == 0 ]] || {
 echo 'FAIL: worker replay processed an already expired order';exit 17; }
[[ "$(orderstatus due-B)" == expired &&
   "$(eventcount due-B order.expired)" == 1 &&
   "$(available tenant-1 store-B SKU-A)" == 5,2 ]] || {
 echo 'FAIL: worker did not release/reserve correctly';exit 18; }
echo 'Read-only expiry preview, disabled worker, injected rollback and replay PASS'

# Confirming a different hold consumes physical on_hand and writes one
# "order.confirmed" HELD_NO_SEND event in the SAME transaction.
[[ "$(transition act37-confirm-hold-B)" == TRANSITIONED_SYNTHETIC_CI_ONLY &&
   "$(transition act37-confirm-hold-B)" == DUPLICATE_TRANSITION_NO_WRITE ]] || {
 echo 'FAIL: confirmed transition/replay';exit 19; }
[[ "$(orderstatus hold-B)" == confirmed &&
   "$(eventcount hold-B order.confirmed)" == 1 &&
   "$(available tenant-1 store-B SKU-A)" == 4,1 ]] || {
 echo 'FAIL: confirmed transaction/outbox mismatch';exit 20; }
echo 'Confirm B held item -> physical on_hand decrement and exactly one no-send event PASS'

[[ "$(reserve cancel-B)" == RESERVED_SYNTHETIC_CI_ONLY ]] || {
 echo 'FAIL: cannot reserve cancel fixture';exit 21; }
q "UPDATE $x.outbox_gate SET allow_event_recording=false;" >/dev/null
denied 'failed terminal outbox atomically aborts cancel' DENY_OUTBOX_GATE \
 "SELECT $s.transition_synthetic_order('act37-cancel-B');"
q "UPDATE $x.outbox_gate SET allow_event_recording=true;" >/dev/null
[[ "$(orderstatus cancel-B)" == reserved &&
   "$(eventcount cancel-B order.cancelled)" == 0 &&
   "$(available tenant-1 store-B SKU-A)" == 4,2 ]] || {
 echo 'FAIL: outbox failure left a partial cancel';exit 22; }
[[ "$(transition act37-cancel-B)" == TRANSITIONED_SYNTHETIC_CI_ONLY &&
   "$(transition act37-cancel-B)" == DUPLICATE_TRANSITION_NO_WRITE ]] || {
 echo 'FAIL: cancel idempotency';exit 23; }
[[ "$(orderstatus cancel-B)" == cancelled &&
   "$(eventcount cancel-B order.cancelled)" == 1 &&
   "$(available tenant-1 store-B SKU-A)" == 4,1 ]] || {
 echo 'FAIL: cancellation event or stock release';exit 24; }
echo 'Terminal outbox errors roll back cancellation, retry succeeds exactly once PASS'

# Expire vs cancel race over same overdue Order: only one terminal
# event may exist. SKIP LOCKED worker can return 0 if cancel holds lock.
[[ "$(reserve race-B)" == RESERVED_SYNTHETIC_CI_ONLY ]] || {
 echo 'FAIL: race fixture hold';exit 25; }
q "UPDATE $s.orders SET reservation_expires_at=clock_timestamp()-interval '1 minute'
 WHERE order_ref='SYN36-v37-race-B';" >/dev/null
q "SELECT $x.expire_due_batch_no_send(1);" >"$tmp/race-worker" 2>&1 &
p1=$!
q "SELECT $s.transition_synthetic_order('act37-race-cancel-B');" >"$tmp/race-cancel" 2>&1 &
p2=$!
if wait "$p1";then wresult="$(cat "$tmp/race-worker")";else
 echo 'FAIL: worker crashed in race';cat "$tmp/race-worker";exit 26;fi
if wait "$p2";then cres=0;else cres=1;fi
[[ "$wresult" == 0 || "$wresult" == 1 ]] || {
 echo "FAIL: unrecognized worker result $wresult";exit 27; }
if [[ "$cres" == 1 ]];then
 grep -Fq DENY_ORDER_NOT_RESERVED "$tmp/race-cancel" || {
 echo 'FAIL: cancel failed for unexpected reason';exit 28; }
fi
[[ "$(orderstatus race-B)" == expired || "$(orderstatus race-B)" == cancelled ]] || {
 echo 'FAIL: race did not terminate';exit 29; }
[[ "$(q "SELECT count(*) FROM $x.notification_outbox
 WHERE order_ref='SYN36-v37-race-B'
 AND event_type IN ('order.expired','order.cancelled');")" == 1 ]] || {
 echo 'FAIL: dual terminal outbox events';exit 30; }
[[ "$(available tenant-1 store-B SKU-A)" == 4,1 ]] || {
 echo 'FAIL: race released stock incorrectly';exit 31; }
echo 'Concurrent cancellation vs expiry: exactly one terminal outbox, no double release PASS'

# Store C has an independent reservation scope despite other tenant/store
# having the same SKU name. Two workers must process a due C order once.
[[ "$(reserve due-C)" == RESERVED_SYNTHETIC_CI_ONLY ]] || {
 echo 'FAIL: Store C hold';exit 32; }
q "UPDATE $s.orders SET reservation_expires_at=clock_timestamp()-interval '1 minute'
 WHERE order_ref='SYN36-v37-due-C';" >/dev/null
q "SELECT $x.expire_due_batch_no_send(1);" >"$tmp/worker-c1" 2>&1 &
p1=$!
q "SELECT $x.expire_due_batch_no_send(1);" >"$tmp/worker-c2" 2>&1 &
p2=$!
wait "$p1";wait "$p2"
c1="$(cat "$tmp/worker-c1")";c2="$(cat "$tmp/worker-c2")"
[[ "$((c1+c2))" == 1 ]] || {
 echo 'FAIL: concurrently scheduled workers expired order twice';exit 33; }
[[ "$(orderstatus due-C)" == expired &&
   "$(eventcount due-C order.expired)" == 1 &&
   "$(available tenant-2 store-C SKU-A)" == 2,1 &&
   "$(available tenant-1 store-B SKU-A)" == 4,1 ]] || {
 echo 'FAIL: concurrent worker crossed Store/tenant';exit 34; }

# No external dispatch path exists and all atomic notifications remain held.
[[ "$(all_events)" == 10 &&
   "$(q "SELECT count(*) FROM $x.notification_outbox
 WHERE dispatch_state<>'HELD_NO_SEND' OR can_send<>false;")" == 0 &&
   "$(q "SELECT $x.preview_due_count();")" == 0 ]] || {
 echo 'FAIL: event count/no-send guard/due backlog';exit 35; }
[[ "$(q "SELECT count(*) FROM $s.inventory i WHERE i.reserved<>COALESCE(
 (SELECT sum(oi.quantity) FROM $s.order_items oi JOIN $s.orders o
 ON o.order_ref=oi.order_ref AND o.tenant_ref=oi.tenant_ref
 AND o.store_ref=oi.store_ref
 WHERE o.status='reserved' AND i.tenant_ref=oi.tenant_ref
 AND i.store_ref=oi.store_ref AND i.sku=oi.sku),0);")" == 0 ]] || {
 echo 'FAIL: reserved warehouse ledger is inconsistent';exit 36; }
[[ "$(q "SELECT count(*) FROM $x.notification_outbox
 GROUP BY tenant_ref,store_ref,order_ref,event_type
 HAVING count(*)>1;")" == '' ]] || {
 echo 'FAIL: duplicate event keys';exit 37; }
echo 'Worker concurrency, Store isolation, unique outbox and stock ledger invariants PASS'
echo 'V17.2C.37 EXPIRY_OUTBOX_ATOMIC_NO_SEND_QA_PASS NO_SCHEDULER NO_EXTERNAL_SEND NO_SUPABASE_WRITE'
