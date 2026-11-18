#!/usr/bin/env bash
# V17.2C.39 - PRIVATE NO-SEND PG17 CI ONLY
set -euo pipefail
[[ "$PGHOST" == 127.0.0.1 && "$PGDATABASE" == postgres &&
 "$PGPORT" == 5432 && "$PGUSER" == postgres ]] || { echo DENY_LIVE_DB; exit 91; }
s=tien404_v172c39_reconcile_qa
d=tien404_v172c38_dispatch_qa
x=tien404_v172c37_outbox_qa
root=qa/v172c-rpc-closure
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
q(){ psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
fail(){
 if q "$3" >"$tmp/denied" 2>&1;then echo "FAIL unexpected permit $1";exit 2;fi
 grep -Fq "$2" "$tmp/denied" || {
 echo "FAIL $1 expected $2";tail -n 4 "$tmp/denied";exit 3; }
}
id(){ q "SELECT delivery_id FROM $d.delivery_queue
 WHERE order_ref='SYN36-v37-$1' AND event_type='order.$2' AND channel='zalo';"; }
sim(){ q "SELECT $d.simulate_attempt_no_send('worker-zalo-B',$1,'$2');"; }
st(){ q "SELECT state FROM $s.reconciliation WHERE delivery_id=$1;"; }
at(){ q "SELECT count(*) FROM $d.delivery_attempts WHERE delivery_id=$1;"; }
qc(){ q "SELECT state||':'||attempt_count FROM $d.delivery_queue WHERE delivery_id=$1;"; }
dl(){ q "SELECT count(*) FROM $s.dead_letters WHERE delivery_id=$1;"; }
proof(){
 q "INSERT INTO $s.private_proofs(proof_ref,delivery_id,tenant_ref,store_ref,
 channel,source_event_id,reviewer_ref,proof_kind,signature_verified,
 issuer_trusted,scope_bound,proven_not_delivered,manual_review_signed,valid_until)
 SELECT '$1',delivery_id,tenant_ref,store_ref,channel,source_event_id,
 '$9','$3',$4,$5,$6,$7,$8,now()+interval '1 hour'
 FROM $d.delivery_queue WHERE delivery_id=$2;" >/dev/null
}
reconcile(){ q "SELECT $s.reconcile_private_proof('$1');"; }
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c39-provider-ambiguous-reconciliation-ci-only.sql"
[[ "$(q "SELECT has_schema_privilege('anon','$s','USAGE');")" == f &&
   "$(q "SELECT has_schema_privilege('authenticated','$s','USAGE');")" == f &&
   "$(q "SELECT has_function_privilege('authenticated','$s.reconcile_private_proof(text,text)','EXECUTE');")" == f ]] || {
 echo 'FAIL public privileges';exit 4; }
[[ "$(q "SELECT count(*) FROM information_schema.columns
 WHERE table_schema='$s' AND column_name IN ('recipient','recipient_id',
 'provider_token','provider_url','external_message_id','sent_at');")" == 0 ]] || {
 echo 'FAIL provider/recipient fields';exit 5; }
fail 'cannot enable send' 'violates check constraint' \
 "INSERT INTO $s.reconciliation(delivery_id,ambiguous_attempt_no,review_after,can_send)
 SELECT delivery_id,1,now(),true FROM $d.delivery_queue LIMIT 1;"
ack=$(id hold-B confirmed)
retry=$(id due-B reserved)
invalid=$(id cancel-B reserved)
exhaust=$(id race-B reserved)
[[ -n "$ack" && -n "$retry" && -n "$invalid" && -n "$exhaust" ]] || {
 echo 'FAIL: required source fixtures absent';exit 6; }
echo 'Private no-send scope, four untouched source fixtures PASS'

# Timeout/uncertain provider outcome automatically creates a held row.
[[ "$(sim "$ack" transient)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND &&
 "$(st "$ack")" == AMBIGUOUS_HELD && "$(qc "$ack")" == RETRY_NO_SEND:1 ]] || {
 echo 'FAIL: missing atomic ambiguity quarantine';exit 7; }
q "UPDATE $d.delivery_queue SET next_attempt_at=now()-interval '1 second'
 WHERE delivery_id=$ack;" >/dev/null
[[ "$(q "SELECT $d.preview_due_no_send('worker-zalo-B');")" == 3 ]] || {
 echo 'FAIL: preview still exposes ambiguous retry';exit 8; }
fail 'direct V38 automatic retry during unknown outcome' \
 DENY_UNRESOLVED_PROVIDER_AMBIGUITY \
 "SELECT $d.simulate_attempt_no_send('worker-zalo-B',$ack,'ok');"
[[ "$(at "$ack")" == 1 ]] || { echo 'FAIL duplicate simulated attempt';exit 9; }

# Provider ACK only confirms its own receipt signal, not delivery.
proof ack-proof "$ack" ACK_OBSERVED_ONLY true true true false false reviewer-B
[[ "$(reconcile ack-proof)" == RECONCILED_SYNTHETIC_NO_SEND &&
 "$(st "$ack")" == ACK_OBSERVED_HELD &&
 "$(reconcile ack-proof)" == PROOF_ALREADY_CONSUMED_NO_WRITE ]] || {
 echo 'FAIL: ACK-only status/idempotency';exit 10; }
fail 'ack-only must stay held' DENY_UNRESOLVED_PROVIDER_AMBIGUITY \
 "SELECT $d.simulate_attempt_no_send('worker-zalo-B',$ack,'ok');"
[[ "$(dl "$ack")" == 0 && "$(at "$ack")" == 1 ]] || {
 echo 'FAIL ACK fabricated message delivery';exit 11; }
echo 'ACK is not recipient delivery, ambiguous retries denied PASS'

[[ "$(sim "$retry" transient)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND &&
 "$(st "$retry")" == AMBIGUOUS_HELD ]] || {
 echo 'FAIL: retry fixture no quarantine';exit 12; }
q "UPDATE $d.delivery_queue SET next_attempt_at=now()-interval '1 second'
 WHERE delivery_id=$retry;" >/dev/null
proof bad-signature "$retry" PROVEN_NONDELIVERY false true true true false reviewer-B
proof stale-proof "$retry" PROVEN_NONDELIVERY true true true true false reviewer-B
q "UPDATE $s.private_proofs SET valid_until=now()-interval '1 minute'
 WHERE proof_ref='stale-proof';" >/dev/null
proof no-proof "$retry" PROVEN_NONDELIVERY true true true false false reviewer-B
proof revoked-reviewer "$retry" PROVEN_NONDELIVERY true true true true false reviewer-revoked
proof forged-store "$retry" PROVEN_NONDELIVERY true true true true false reviewer-C
q "UPDATE $s.private_proofs SET tenant_ref='tenant-2',
 store_ref='store-C',channel='messenger' WHERE proof_ref='forged-store';" >/dev/null
fail 'signature' DENY_PROOF_ATTESTATION "SELECT $s.reconcile_private_proof('bad-signature');"
fail 'expired proof' DENY_PROOF_ATTESTATION "SELECT $s.reconcile_private_proof('stale-proof');"
fail 'insufficient proof' DENY_NONDELIVERY_RETRY_GATE "SELECT $s.reconcile_private_proof('no-proof');"
fail 'revoked reviewer' DENY_PROOF_ATTESTATION "SELECT $s.reconcile_private_proof('revoked-reviewer');"
fail 'forged Store evidence' DENY_PROOF_SOURCE_SCOPE "SELECT $s.reconcile_private_proof('forged-store');"
[[ "$(st "$retry")" == AMBIGUOUS_HELD ]] || {
 echo 'FAIL: negative evidence mutated state';exit 13; }
proof good-nd "$retry" PROVEN_NONDELIVERY true true true true false reviewer-B
for fault in after_proof_ledger after_reconciliation_state;do
 fail "rollback $fault" QA_FAULT_ \
 "SELECT $s.reconcile_private_proof('good-nd','$fault');"
 [[ "$(st "$retry")" == AMBIGUOUS_HELD &&
 "$(q "SELECT count(*) FROM $s.proof_consumptions WHERE proof_ref='good-nd';")" == 0 ]] || {
 echo 'FAIL: partial proof reconciliation';exit 14; }
done
[[ "$(reconcile good-nd)" == RECONCILED_SYNTHETIC_NO_SEND &&
 "$(st "$retry")" == RETRY_AUTHORIZED_NO_SEND &&
 "$(sim "$retry" ok)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND &&
 "$(qc "$retry")" == PREVIEW_OK_NO_SEND:2 ]] || {
 echo 'FAIL: proven NON-DELIVERY did not selectively release retry';exit 15; }
echo 'Independent synthetic non-delivery proof, rollback and gated retry PASS'

# ACK-only case: private human-style review, after a synthetic time window.
proof early-review "$ack" MANUAL_DLQ_REVIEW true true true false true reviewer-B
fail 'review before deadline' DENY_MANUAL_REVIEW_GATE \
 "SELECT $s.reconcile_private_proof('early-review');"
q "UPDATE $s.reconciliation SET review_after=now()-interval '1 minute'
 WHERE delivery_id=$ack;" >/dev/null
proof unsigned-review "$ack" MANUAL_DLQ_REVIEW true true true false false reviewer-B
fail 'unsigned review' DENY_MANUAL_REVIEW_GATE \
 "SELECT $s.reconcile_private_proof('unsigned-review');"
proof signed-review "$ack" MANUAL_DLQ_REVIEW true true true false true reviewer-B
for fault in after_proof_ledger after_reconciliation_state after_dead_letter;do
 fail "DLQ rollback $fault" QA_FAULT_ \
 "SELECT $s.reconcile_private_proof('signed-review','$fault');"
 [[ "$(st "$ack")" == ACK_OBSERVED_HELD &&
 "$(dl "$ack")" == 0 &&
 "$(q "SELECT count(*) FROM $s.proof_consumptions WHERE proof_ref='signed-review';")" == 0 ]] || {
 echo 'FAIL: partial DLQ transaction';exit 16; }
done
[[ "$(reconcile signed-review)" == RECONCILED_SYNTHETIC_NO_SEND &&
 "$(reconcile signed-review)" == PROOF_ALREADY_CONSUMED_NO_WRITE &&
 "$(st "$ack")" == DLQ_HELD && "$(dl "$ack")" == 1 ]] || {
 echo 'FAIL: DLQ transition not idempotent';exit 17; }
[[ "$(q "SELECT reason FROM $s.dead_letters WHERE delivery_id=$ack;")" == PROVIDER_ACK_NOT_DELIVERY_PROOF ]] || {
 echo 'FAIL: ACK-only misclassified';exit 18; }
fail 'DLQ may not auto-retry' DENY_UNRESOLVED_PROVIDER_AMBIGUITY \
 "SELECT $d.simulate_attempt_no_send('worker-zalo-B',$ack,'ok');"
echo 'ACK-only manual review -> DLQ, rollback, one-time proof PASS'

# Repeated uncertain outcomes with independent proven non-delivery.
for n in 1 2 3;do
 if [[ "$n" != 1 ]];then
 q "UPDATE $d.delivery_queue SET next_attempt_at=now()-interval '1 second'
 WHERE delivery_id=$exhaust;" >/dev/null;fi
 [[ "$(sim "$exhaust" transient)" == SIMULATED_ATTEMPT_RECORDED_NO_SEND &&
 "$(st "$exhaust")" == AMBIGUOUS_HELD ]] || {
 echo 'FAIL: ambiguous attempt number '$n;exit 19; }
 if [[ "$n" != 3 ]];then
  proof "nd-$n" "$exhaust" PROVEN_NONDELIVERY true true true true false reviewer-B
  [[ "$(reconcile "nd-$n")" == RECONCILED_SYNTHETIC_NO_SEND &&
  "$(st "$exhaust")" == RETRY_AUTHORIZED_NO_SEND ]] || {
  echo 'FAIL: bounded non-delivery retry '$n;exit 20; }
 fi
done
[[ "$(qc "$exhaust")" == TERMINAL_NO_SEND:3 && "$(at "$exhaust")" == 3 ]] || {
 echo 'FAIL: max retries';exit 21; }
proof retry-over-limit "$exhaust" PROVEN_NONDELIVERY true true true true false reviewer-B
fail 'retry beyond attempt cap' DENY_NONDELIVERY_RETRY_GATE \
 "SELECT $s.reconcile_private_proof('retry-over-limit');"
q "UPDATE $s.reconciliation SET review_after=now()-interval '1 minute'
 WHERE delivery_id=$exhaust;" >/dev/null
proof review-exhaust "$exhaust" MANUAL_DLQ_REVIEW true true true false true reviewer-B
[[ "$(reconcile review-exhaust)" == RECONCILED_SYNTHETIC_NO_SEND &&
 "$(st "$exhaust")" == DLQ_HELD && "$(dl "$exhaust")" == 1 ]] || {
 echo 'FAIL: exhausted ambiguous case not in DLQ';exit 22; }
[[ "$(q "SELECT reason FROM $s.dead_letters WHERE delivery_id=$exhaust;")" == EXHAUSTED_RETRY_AMBIGUOUS ]] || {
 echo 'FAIL: DLQ wrong reason';exit 23; }

[[ "$(q "SELECT count(*) FROM $s.dead_letters WHERE can_send OR NOT no_send;")" == 0 &&
 "$(q "SELECT count(*) FROM $x.notification_outbox
 WHERE dispatch_state<>'HELD_NO_SEND' OR can_send;")" == 0 &&
 "$(q "SELECT count(*) FROM $d.delivery_queue WHERE can_send;")" == 0 &&
 "$(q "SELECT count(*) FROM $d.delivery_attempts WHERE can_send;")" == 0 &&
 "$(q "SELECT count(*) FROM $s.dead_letters;")" == 2 ]] || {
 echo 'FAIL: no-send integrity or DLQ duplicates';exit 24; }
[[ "$(q "SELECT count(*) FROM $d.delivery_queue q WHERE q.attempt_count<>
 (SELECT count(*) FROM $d.delivery_attempts a WHERE a.delivery_id=q.delivery_id);")" == 0 ]] || {
 echo 'FAIL: simulated attempt ledger mismatch';exit 25; }
[[ "$(q "SELECT count(*) FROM $s.reconciliation r WHERE r.state='DLQ_HELD'
 AND NOT EXISTS(SELECT 1 FROM $s.dead_letters d WHERE d.delivery_id=r.delivery_id);")" == 0 ]] || {
 echo 'FAIL: DLQ and reconciliation state differ';exit 26; }
echo 'V17.2C.39 AMBIGUOUS_ACK_DLQ_NO_SEND_QA_PASS NO_PROVIDER_SEND NO_SUPABASE_WRITE'
