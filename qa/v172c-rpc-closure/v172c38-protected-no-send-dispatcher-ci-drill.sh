#!/usr/bin/env bash
# V17.2C.38 — GitHub Actions ephemeral PostgreSQL 17 only, NO SEND.
set -euo pipefail
[[ "$PGHOST" == "127.0.0.1" && "$PGPORT" == "5432" &&
   "$PGDATABASE" == "postgres" && "$PGUSER" == "postgres" ]] || {
 echo 'DENY_NOT_ISOLATED_CI_POSTGRES';exit 91; }
root=qa/v172c-rpc-closure
s=tien404_v172c38_dispatch_qa
x=tien404_v172c37_outbox_qa
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
q(){ psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
simulate(){ q "SELECT $s.simulate_attempt_no_send('$1',$2,'$3');"; }
detail(){ q "SELECT state||','||attempt_count FROM $s.delivery_queue WHERE delivery_id=$1;"; }
attempts(){ q "SELECT count(*) FROM $s.delivery_attempts WHERE delivery_id=$1;"; }
delivery_id(){
 q "SELECT delivery_id FROM $s.delivery_queue
 WHERE order_ref='SYN36-v37-$1' AND event_type='order.$2' AND channel='$3';"
}
denied(){
 local label="$1" marker="$2" sql="$3"
 if q "$sql" >"$tmp/err" 2>&1;then
   echo "FAIL: $label unexpectedly permitted";exit 2;
 fi
 grep -Fq "$marker" "$tmp/err" || {
  echo "FAIL: $label expected $marker, got";tail -n 4 "$tmp/err";exit 3; }
}
psql -X -q -v ON_ERROR_STOP=1 \
 -f "$root/v172c38-protected-no-send-dispatcher-ci-only.sql"

[[ "$(q "SELECT has_schema_privilege('anon','$s','USAGE');")" == f &&
   "$(q "SELECT has_schema_privilege('authenticated','$s','USAGE');")" == f &&
   "$(q "SELECT has_function_privilege('authenticated','$s.simulate_attempt_no_send(text,bigint,text,text)','EXECUTE');")" == f ]] || {
 echo 'FAIL: public Data API can invoke private fake dispatcher';exit 4; }
[[ "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema='$s'
 AND column_name IN ('recipient','recipient_id','access_token','provider_token','provider_url','sent_at','external_message_id');")" == 0 ]] || {
 echo 'FAIL: queue exposes recipient or provider credentials';exit 5; }
denied 'cannot turn send gate on' 'violates check constraint' \
 "UPDATE $s.private_gate SET allow_real_delivery=true WHERE singleton=true;"
denied 'cannot create queue in SENT state' 'violates check constraint' \
 "INSERT INTO $s.delivery_queue(source_event_id,tenant_ref,store_ref,order_ref,event_type,channel,state)
 VALUES(1,'tenant-1','store-B','SYN36-v37-hold-B','order.reserved','zalo','SENT');"
[[ "$(q "SELECT count(*) FROM $s.delivery_queue;")" == 0 ]] || {
 echo 'FAIL: invalid sends created a queue item';exit 6; }
echo 'No-send DB constraints and client role revocation PASS'

[[ "$(q "SELECT $s.admit_committed_events_no_send();")" == 10 ]] || {
 echo 'FAIL: expected 10 already committed synthetic outbox events';exit 7; }
[[ "$(q "SELECT $s.admit_committed_events_no_send();")" == 0 ]] || {
 echo 'FAIL: source event re-admission produced duplicates';exit 8; }
[[ "$(q "SELECT $s.preview_due_no_send('worker-zalo-B');")" == 8 &&
   "$(q "SELECT $s.preview_due_no_send('worker-messenger-C');")" == 2 ]] || {
 echo 'FAIL: route-scope due counts';exit 9; }
[[ "$(q "SELECT count(*) FROM $s.delivery_queue
 WHERE order_ref IN ('SYN36-v37-outbox-fail-B','SYN36-v37-reserve-fault-B');")" == 0 ]] || {
 echo 'FAIL: rolled-back outbox event leaked into dispatcher';exit 10; }
[[ "$(q "SELECT count(*) FROM $s.delivery_queue q JOIN $x.notification_outbox o
 ON q.source_event_id=o.event_id WHERE q.tenant_ref<>o.tenant_ref
 OR q.store_ref<>o.store_ref OR q.order_ref<>o.order_ref
 OR q.event_type<>o.event_type;")" == 0 ]] || {
 echo 'FAIL: queue source scoped identity mismatch';exit 11; }
denied 'forged queue Store binding' 'violates foreign key constraint' \
 "INSERT INTO $s.delivery_queue(source_event_id,tenant_ref,store_ref,order_ref,event_type,channel)
 SELECT event_id,'tenant-2','store-C',order_ref,event_type,'messenger'
 FROM $x.notification_outbox WHERE order_ref='SYN36-v37-hold-B'
 AND event_type='order.reserved';"
echo 'Committed outbox admission exactly once, protected Store scope PASS'

hold="$(delivery_id hold-B reserved zalo)"
due="$(delivery_id due-B expired zalo)"
cancel="$(delivery_id cancel-B cancelled zalo)"
c_res="$(delivery_id due-C reserved messenger)"
c_exp="$(delivery_id due-C expired messenger)"
# V37 deliberately races cancel vs expire; either terminal event is valid.
# Never hardcode a nondeterministic race winner in a downstream contract.
b_retry="$(q "SELECT delivery_id FROM $s.delivery_queue
 WHERE order_ref='SYN36-v37-race-B' AND channel='zalo'
 AND event_type IN ('order.cancelled','order.expired');")"
[[ -n "$hold" && -n "$due" && -n "$cancel" &&
   -n "$c_res" && -n "$c_exp" && -n "$b_retry" ]] || {
 echo 'FAIL: required synthetic source events missing';exit 12; }

[[ "$(simulate worker-messenger-C "$hold" ok)" == DENY_SCOPE_OR_LOCKED_NO_WRITE ]] || {
 echo 'FAIL: worker C claimed Store B source';exit 13; }
denied 'disabled worker admission' DENY_WORKER_ADMISSION \
 "SELECT $s.simulate_attempt_no_send('worker-disabled-B',$hold,'ok');"
denied 'unattested worker admission' DENY_WORKER_ADMISSION \
 "SELECT $s.simulate_attempt_no_send('worker-unattested-C',$c_res,'ok');"
denied 'unregistered worker admission' DENY_WORKER_ADMISSION \
 "SELECT $s.simulate_attempt_no_send('worker-other',$hold,'ok');"
q "UPDATE $s.private_gate SET enabled=false WHERE singleton=true;" >/dev/null
denied 'disabled global dispatch gate' DENY_PRIVATE_DISPATCH_GATE \
 "SELECT $s.simulate_attempt_no_send('worker-zalo-B',$hold,'ok');"
q "UPDATE $s.private_gate SET enabled=true WHERE singleton=true;" >/dev/null
q "UPDATE $s.private_routes SET consent_attested=false
 WHERE tenant_ref='tenant-1' AND store_ref='store-B';" >/dev/null
denied 'revoked route consent' DENY_ROUTE_ADMISSION \
 "SELECT $s.simulate_attempt_no_send('worker-zalo-B',$hold,'ok');"
q "UPDATE $s.private_routes SET consent_attested=true,
 subscription_active=false WHERE tenant_ref='tenant-1' AND store_ref='store-B';" >/dev/null
denied 'expired subscription' DENY_ROUTE_ADMISSION \
 "SELECT $s.simulate_attempt_no_send('worker-zalo-B',$hold,'ok');"
q "UPDATE $s.private_routes SET subscription_active=true,
 merchant_opt_in=false WHERE tenant_ref='tenant-1' AND store_ref='store-B';" >/dev/null
denied 'merchant disabled route' DENY_ROUTE_ADMISSION \
 "SELECT $s.simulate_attempt_no_send('worker-zalo-B',$hold,'ok');"
q "UPDATE $s.private_routes SET merchant_opt_in=true
 WHERE tenant_ref='tenant-1' AND store_ref='store-B';" >/dev/null
[[ "$(attempts "$hold")" == 0 ]] || {
 echo 'FAIL: revoked authority consumed an attempt';exit 14; }
echo 'Store admission, consent, subscription, opt-in, worker gates DENY PASS'

for fault in after_attempt_log after_queue_update;do
 denied "simulated dispatcher $fault" QA_FAIL_ \
 "SELECT $s.simulate_attempt_no_send('worker-zalo-B',$due,'transient','$fault');"
 [[ "$(detail "$due")" == READY_NO_SEND,0 && "$(attempts "$due")" == 0 ]] || {
 echo "FAIL: $fault left partial queue or attempt ledger";exit 15; }
done
[[ "$(simulate worker-zalo-B "$due" ok)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND ]] || {
 echo 'FAIL: fault recovery failed';exit 16; }
[[ "$(detail "$due")" == PREVIEW_OK_NO_SEND,1 && "$(attempts "$due")" == 1 &&
   "$(simulate worker-zalo-B "$due" ok)" == ALREADY_FINAL_NO_WRITE ]] || {
 echo 'FAIL: simulated success duplicated';exit 17; }
echo 'Fault injection atomic rollback, simulated preview retry PASS'

[[ "$(simulate worker-zalo-B "$hold" transient)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND &&
   "$(detail "$hold")" == RETRY_NO_SEND,1 &&
   "$(simulate worker-zalo-B "$hold" transient)" == NOT_DUE_NO_WRITE ]] || {
 echo 'FAIL: retry backoff not enforced';exit 18; }
q "UPDATE $s.delivery_queue SET next_attempt_at=clock_timestamp()-interval '1 second'
 WHERE delivery_id=$hold;" >/dev/null
[[ "$(simulate worker-zalo-B "$hold" transient)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND &&
   "$(detail "$hold")" == RETRY_NO_SEND,2 ]] || {
 echo 'FAIL: second retry';exit 19; }
q "UPDATE $s.delivery_queue SET next_attempt_at=clock_timestamp()-interval '1 second'
 WHERE delivery_id=$hold;" >/dev/null
[[ "$(simulate worker-zalo-B "$hold" transient)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND &&
   "$(detail "$hold")" == TERMINAL_NO_SEND,3 &&
   "$(attempts "$hold")" == 3 &&
   "$(simulate worker-zalo-B "$hold" ok)" == ALREADY_FINAL_NO_WRITE ]] || {
 echo 'FAIL: max attempts not enforced';exit 20; }
echo 'Transient backoff and bounded 3 attempts PASS'

[[ "$(simulate worker-zalo-B "$cancel" permanent)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND &&
   "$(detail "$cancel")" == TERMINAL_NO_SEND,1 &&
   "$(simulate worker-zalo-B "$cancel" transient)" == ALREADY_FINAL_NO_WRITE ]] || {
 echo 'FAIL: permanent error not terminal';exit 21; }
[[ "$(simulate worker-zalo-B "$b_retry" transient)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND ]] || {
 echo 'FAIL: transient retry setup';exit 22; }
q "UPDATE $s.delivery_queue SET next_attempt_at=clock_timestamp()-interval '1 second'
 WHERE delivery_id=$b_retry;" >/dev/null
[[ "$(simulate worker-zalo-B "$b_retry" ok)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND &&
   "$(detail "$b_retry")" == PREVIEW_OK_NO_SEND,2 &&
   "$(attempts "$b_retry")" == 2 ]] || {
 echo 'FAIL: transient eventual fake success';exit 23; }
echo 'Permanent error and transient recovery simulation PASS'

q "SELECT $s.simulate_attempt_no_send('worker-messenger-C',$c_res,'ok');" >"$tmp/race1" 2>&1 &
p1=$!
q "SELECT $s.simulate_attempt_no_send('worker-messenger-C',$c_res,'ok');" >"$tmp/race2" 2>&1 &
p2=$!
wait "$p1";wait "$p2"
r1="$(cat "$tmp/race1")";r2="$(cat "$tmp/race2")"
[[ "$r1" == SIMULATED_ATTEMPT_RECORDED_NO_SEND ||
   "$r2" == SIMULATED_ATTEMPT_RECORDED_NO_SEND ]] || {
 echo 'FAIL: neither worker simulated';exit 24; }
[[ "$r1" == DENY_SCOPE_OR_LOCKED_NO_WRITE || "$r1" == ALREADY_FINAL_NO_WRITE ||
   "$r2" == DENY_SCOPE_OR_LOCKED_NO_WRITE || "$r2" == ALREADY_FINAL_NO_WRITE ]] || {
 echo 'FAIL: no worker deduplication';exit 25; }
[[ "$(detail "$c_res")" == PREVIEW_OK_NO_SEND,1 &&
   "$(attempts "$c_res")" == 1 ]] || {
 echo 'FAIL: concurrency duplicate simulation';exit 26; }
[[ "$(simulate worker-messenger-C "$c_exp" ok)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND &&
   "$(simulate worker-zalo-B "$c_exp" ok)" == DENY_SCOPE_OR_LOCKED_NO_WRITE ]] || {
 echo 'FAIL: worker crossed Store/channel';exit 27; }

[[ "$(q "SELECT count(*) FROM $x.notification_outbox
 WHERE dispatch_state<>'HELD_NO_SEND' OR can_send;")" == 0 &&
   "$(q "SELECT count(*) FROM $s.delivery_queue WHERE can_send;")" == 0 &&
   "$(q "SELECT count(*) FROM $s.delivery_attempts WHERE can_send;")" == 0 ]] || {
 echo 'FAIL: no-send boundary was violated';exit 28; }
[[ "$(q "SELECT count(*) FROM $s.delivery_queue d WHERE d.attempt_count<>(
 SELECT count(*) FROM $s.delivery_attempts a WHERE a.delivery_id=d.delivery_id);")" == 0 &&
   "$(q "SELECT count(*) FROM $s.delivery_queue WHERE attempt_count>3;")" == 0 &&
   "$(q "SELECT count(*) FROM $s.delivery_queue;")" == 10 ]] || {
 echo 'FAIL: idempotency/attempt cap/queue count';exit 29; }
[[ "$(q "SELECT count(*) FROM $s.delivery_queue d
 JOIN $x.notification_outbox e ON d.source_event_id=e.event_id
 WHERE d.tenant_ref<>e.tenant_ref OR d.store_ref<>e.store_ref
 OR d.event_type<>e.event_type OR d.order_ref<>e.order_ref;")" == 0 ]] || {
 echo 'FAIL: dispatcher crossed Store/source';exit 30; }
echo 'Concurrent workers, Store scoping and NO SEND invariants PASS'
echo 'V17.2C.38 PROTECTED_DISPATCH_ADMISSION_QA_PASS NO_REAL_DELIVERY NO_SUPABASE_WRITES'
