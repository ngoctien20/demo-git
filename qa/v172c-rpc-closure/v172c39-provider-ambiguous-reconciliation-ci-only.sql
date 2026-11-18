-- TIEN404 V17.2C.39: CI-ONLY SYNTHETIC PROVIDER ACK RECONCILIATION.
-- NO HOSTED, NO REAL SEND, NO TRUE PROVIDER EVIDENCE.
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR to_regclass('tien404_v172c38_dispatch_qa.delivery_queue') IS NULL
 OR to_regclass('tien404_v172c37_outbox_qa.notification_outbox') IS NULL
 THEN RAISE EXCEPTION 'DENY_NON_EPHEMERAL_V172C39'; END IF;
END
$guard$;
CREATE SCHEMA tien404_v172c39_reconcile_qa;
REVOKE ALL ON SCHEMA tien404_v172c39_reconcile_qa FROM PUBLIC,anon,authenticated;

CREATE TABLE tien404_v172c39_reconcile_qa.private_gate(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT true,
 no_send boolean NOT NULL DEFAULT true CHECK(no_send),
 synthetic_only boolean NOT NULL DEFAULT true CHECK(synthetic_only),
 hosted_enabled boolean NOT NULL DEFAULT false CHECK(NOT hosted_enabled)
);
INSERT INTO tien404_v172c39_reconcile_qa.private_gate(singleton) VALUES(true);

CREATE TABLE tien404_v172c39_reconcile_qa.private_reviewers(
 reviewer_ref text NOT NULL, tenant_ref text NOT NULL,store_ref text NOT NULL,
 channel text NOT NULL, active boolean NOT NULL,attested boolean NOT NULL,
 synthetic_only boolean NOT NULL DEFAULT true CHECK(synthetic_only),
 no_send boolean NOT NULL DEFAULT true CHECK(no_send),
 PRIMARY KEY(reviewer_ref,tenant_ref,store_ref,channel)
);
CREATE TABLE tien404_v172c39_reconcile_qa.reconciliation(
 delivery_id bigint PRIMARY KEY REFERENCES tien404_v172c38_dispatch_qa.delivery_queue,
 state text NOT NULL DEFAULT 'AMBIGUOUS_HELD'
 CHECK(state IN ('AMBIGUOUS_HELD','ACK_OBSERVED_HELD',
 'RETRY_AUTHORIZED_NO_SEND','DLQ_HELD')),
 ambiguous_attempt_no integer NOT NULL CHECK(ambiguous_attempt_no BETWEEN 1 AND 3),
 review_after timestamptz NOT NULL,
 last_proof_ref text,
 can_send boolean NOT NULL DEFAULT false CHECK(NOT can_send)
);
CREATE TABLE tien404_v172c39_reconcile_qa.private_proofs(
 proof_ref text PRIMARY KEY,delivery_id bigint NOT NULL,
 tenant_ref text NOT NULL,store_ref text NOT NULL,
 channel text NOT NULL,source_event_id bigint NOT NULL,
 reviewer_ref text NOT NULL,
 proof_kind text NOT NULL CHECK(proof_kind IN
 ('ACK_OBSERVED_ONLY','PROVEN_NONDELIVERY','MANUAL_DLQ_REVIEW')),
 signature_verified boolean NOT NULL,issuer_trusted boolean NOT NULL,
 scope_bound boolean NOT NULL,proven_not_delivered boolean NOT NULL,
 manual_review_signed boolean NOT NULL,
 valid_until timestamptz NOT NULL,
 synthetic_only boolean NOT NULL DEFAULT true CHECK(synthetic_only),
 no_send boolean NOT NULL DEFAULT true CHECK(no_send),
 FOREIGN KEY(delivery_id) REFERENCES tien404_v172c38_dispatch_qa.delivery_queue,
 FOREIGN KEY(reviewer_ref,tenant_ref,store_ref,channel)
 REFERENCES tien404_v172c39_reconcile_qa.private_reviewers(
 reviewer_ref,tenant_ref,store_ref,channel)
);
CREATE TABLE tien404_v172c39_reconcile_qa.proof_consumptions(
 proof_ref text PRIMARY KEY REFERENCES tien404_v172c39_reconcile_qa.private_proofs,
 delivery_id bigint NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 can_send boolean NOT NULL DEFAULT false CHECK(NOT can_send)
);
CREATE TABLE tien404_v172c39_reconcile_qa.dead_letters(
 delivery_id bigint PRIMARY KEY REFERENCES tien404_v172c38_dispatch_qa.delivery_queue,
 tenant_ref text NOT NULL,store_ref text NOT NULL,channel text NOT NULL,
 source_event_id bigint NOT NULL,
 reason text NOT NULL CHECK(reason IN ('UNRESOLVED_PROVIDER_OUTCOME',
 'PROVIDER_ACK_NOT_DELIVERY_PROOF','EXHAUSTED_RETRY_AMBIGUOUS')),
 review_proof_ref text NOT NULL UNIQUE REFERENCES tien404_v172c39_reconcile_qa.private_proofs,
 no_send boolean NOT NULL DEFAULT true CHECK(no_send),
 can_send boolean NOT NULL DEFAULT false CHECK(NOT can_send)
);
-- No actual recipient, send URL, external provider receipt, or transport.

-- Existing V38 worker would otherwise treat transient as retryable.
-- Install a PRE-INSERT guard on the attempt ledger to block even direct
-- V38 simulator entry points once an ambiguous receipt is quarantined.
CREATE FUNCTION tien404_v172c39_reconcile_qa.prevent_ambiguous_retry()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM tien404_v172c39_reconcile_qa.reconciliation
 WHERE delivery_id=NEW.delivery_id
 AND state IN ('AMBIGUOUS_HELD','ACK_OBSERVED_HELD','DLQ_HELD'))
 THEN RAISE EXCEPTION 'DENY_UNRESOLVED_PROVIDER_AMBIGUITY';END IF;
 RETURN NEW;
END
$fn$;

-- This AFTER INSERT trigger catches a simulated provider timeout in the
-- same transaction as its attempt ledger and queue state update.
-- Thus no retry window exists between a timeout and quarantine.
CREATE FUNCTION tien404_v172c39_reconcile_qa.quarantine_transient_result()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
BEGIN
 IF NEW.simulated_result='SIMULATED_TRANSIENT_FAILURE' THEN
  INSERT INTO tien404_v172c39_reconcile_qa.reconciliation(
  delivery_id,ambiguous_attempt_no,review_after)
  VALUES(NEW.delivery_id,NEW.attempt_no,
   clock_timestamp()+interval '15 minutes')
  ON CONFLICT(delivery_id) DO UPDATE
  SET state='AMBIGUOUS_HELD',
   ambiguous_attempt_no=EXCLUDED.ambiguous_attempt_no,
   review_after=EXCLUDED.review_after,last_proof_ref=NULL
  WHERE tien404_v172c39_reconcile_qa.reconciliation.state=
   'RETRY_AUTHORIZED_NO_SEND';
 END IF;
 RETURN NEW;
END
$fn$;
CREATE TRIGGER v172c39_guard_ambiguous_retry
 BEFORE INSERT ON tien404_v172c38_dispatch_qa.delivery_attempts
 FOR EACH ROW EXECUTE FUNCTION
 tien404_v172c39_reconcile_qa.prevent_ambiguous_retry();
CREATE TRIGGER v172c39_capture_ambiguous_timeout
 AFTER INSERT ON tien404_v172c38_dispatch_qa.delivery_attempts
 FOR EACH ROW EXECUTE FUNCTION
 tien404_v172c39_reconcile_qa.quarantine_transient_result();

-- Private, exact-Store reconciliation, synthetic proof ONLY.
CREATE FUNCTION tien404_v172c39_reconcile_qa.reconcile_private_proof(
 p_proof_ref text,p_fault text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
DECLARE
 p tien404_v172c39_reconcile_qa.private_proofs%ROWTYPE;
 q tien404_v172c38_dispatch_qa.delivery_queue%ROWTYPE;
 r tien404_v172c39_reconcile_qa.reconciliation%ROWTYPE;
 v_new_state text;v_reason text;
 v_max_attempts integer;
BEGIN
 IF p_proof_ref IS NULL OR length(p_proof_ref)<3
 OR length(p_proof_ref)>160
 OR (p_fault IS NOT NULL AND p_fault NOT IN
 ('after_proof_ledger','after_reconciliation_state','after_dead_letter'))
 THEN RAISE EXCEPTION 'DENY_PROOF_ARGUMENT';END IF;
 IF NOT EXISTS(SELECT 1 FROM tien404_v172c39_reconcile_qa.private_gate
 WHERE singleton AND enabled AND no_send AND synthetic_only AND NOT hosted_enabled)
 THEN RAISE EXCEPTION 'DENY_RECONCILIATION_GATE';END IF;
 SELECT * INTO p FROM tien404_v172c39_reconcile_qa.private_proofs
 WHERE proof_ref=p_proof_ref;
 IF NOT FOUND THEN RAISE EXCEPTION 'DENY_UNKNOWN_PRIVATE_PROOF';END IF;
 SELECT * INTO q FROM tien404_v172c38_dispatch_qa.delivery_queue
 WHERE delivery_id=p.delivery_id FOR UPDATE;
 IF NOT FOUND OR q.tenant_ref<>p.tenant_ref OR q.store_ref<>p.store_ref
 OR q.channel<>p.channel OR q.source_event_id<>p.source_event_id
 THEN RAISE EXCEPTION 'DENY_PROOF_SOURCE_SCOPE';END IF;
 IF NOT p.signature_verified OR NOT p.issuer_trusted
 OR NOT p.scope_bound OR p.valid_until<=clock_timestamp()
 OR NOT p.synthetic_only OR NOT p.no_send
 OR NOT EXISTS(
 SELECT 1 FROM tien404_v172c39_reconcile_qa.private_reviewers v
 WHERE v.reviewer_ref=p.reviewer_ref
 AND v.tenant_ref=p.tenant_ref AND v.store_ref=p.store_ref
 AND v.channel=p.channel AND v.active AND v.attested
 AND v.synthetic_only AND v.no_send)
 THEN RAISE EXCEPTION 'DENY_PROOF_ATTESTATION';END IF;
 IF EXISTS(SELECT 1 FROM tien404_v172c39_reconcile_qa.proof_consumptions
 WHERE proof_ref=p_proof_ref) THEN RETURN 'PROOF_ALREADY_CONSUMED_NO_WRITE';END IF;
 SELECT * INTO r FROM tien404_v172c39_reconcile_qa.reconciliation
 WHERE delivery_id=p.delivery_id FOR UPDATE;
 IF NOT FOUND OR r.state NOT IN ('AMBIGUOUS_HELD','ACK_OBSERVED_HELD')
 THEN RAISE EXCEPTION 'DENY_RECONCILIATION_STATE';END IF;
 SELECT max_attempts INTO v_max_attempts
 FROM tien404_v172c38_dispatch_qa.private_workers
 WHERE tenant_ref=q.tenant_ref AND store_ref=q.store_ref
 AND channel=q.channel AND active AND attested
 ORDER BY max_attempts LIMIT 1;
 IF p.proof_kind='ACK_OBSERVED_ONLY' THEN
  IF r.state<>'AMBIGUOUS_HELD' OR p.proven_not_delivered
  THEN RAISE EXCEPTION 'DENY_ACK_EVIDENCE'; END IF;
  v_new_state:='ACK_OBSERVED_HELD';
 ELSIF p.proof_kind='PROVEN_NONDELIVERY' THEN
  IF r.state<>'AMBIGUOUS_HELD' OR NOT p.proven_not_delivered
    OR v_max_attempts IS NULL OR q.attempt_count>=v_max_attempts
  THEN RAISE EXCEPTION 'DENY_NONDELIVERY_RETRY_GATE';END IF;
  v_new_state:='RETRY_AUTHORIZED_NO_SEND';
 ELSIF p.proof_kind='MANUAL_DLQ_REVIEW' THEN
  IF NOT p.manual_review_signed OR r.review_after>clock_timestamp()
  THEN RAISE EXCEPTION 'DENY_MANUAL_REVIEW_GATE';END IF;
  v_new_state:='DLQ_HELD';
  v_reason:=CASE WHEN r.state='ACK_OBSERVED_HELD'
   THEN 'PROVIDER_ACK_NOT_DELIVERY_PROOF'
   WHEN q.attempt_count>=COALESCE(v_max_attempts,3)
   THEN 'EXHAUSTED_RETRY_AMBIGUOUS'
   ELSE 'UNRESOLVED_PROVIDER_OUTCOME' END;
 ELSE RAISE EXCEPTION 'DENY_PROOF_KIND';END IF;
 INSERT INTO tien404_v172c39_reconcile_qa.proof_consumptions(
 proof_ref,delivery_id)VALUES(p.proof_ref,p.delivery_id);
 IF p_fault='after_proof_ledger'
 THEN RAISE EXCEPTION 'QA_FAULT_AFTER_PROOF_LEDGER';END IF;
 UPDATE tien404_v172c39_reconcile_qa.reconciliation
 SET state=v_new_state,last_proof_ref=p.proof_ref
 WHERE delivery_id=q.delivery_id;
 IF p_fault='after_reconciliation_state'
 THEN RAISE EXCEPTION 'QA_FAULT_AFTER_RECONCILIATION';END IF;
 IF v_new_state='DLQ_HELD' THEN
  INSERT INTO tien404_v172c39_reconcile_qa.dead_letters(
  delivery_id,tenant_ref,store_ref,channel,source_event_id,
  reason,review_proof_ref)
  VALUES(q.delivery_id,q.tenant_ref,q.store_ref,q.channel,
  q.source_event_id,v_reason,p.proof_ref);
 END IF;
 IF p_fault='after_dead_letter'
 THEN RAISE EXCEPTION 'QA_FAULT_AFTER_DLQ';END IF;
 RETURN 'RECONCILED_SYNTHETIC_NO_SEND';
END
$fn$;

-- New safe preview excludes unresolved, ACK-only and DLQ records.
CREATE FUNCTION tien404_v172c39_reconcile_qa.preview_safe_due_no_send(
 p_worker_ref text)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
DECLARE w tien404_v172c38_dispatch_qa.private_workers%ROWTYPE;
 n bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tien404_v172c39_reconcile_qa.private_gate
 WHERE singleton AND enabled AND synthetic_only AND no_send AND NOT hosted_enabled)
 OR NOT EXISTS(SELECT 1 FROM tien404_v172c38_dispatch_qa.private_gate
 WHERE singleton AND enabled AND synthetic_only AND no_send
 AND NOT hosted_enabled AND NOT allow_real_delivery)
 THEN RAISE EXCEPTION 'DENY_RECONCILIATION_GATE';END IF;
 SELECT * INTO w FROM tien404_v172c38_dispatch_qa.private_workers
 WHERE worker_ref=p_worker_ref;
 IF NOT FOUND OR NOT w.active OR NOT w.attested OR NOT w.no_send
 THEN RAISE EXCEPTION 'DENY_WORKER_SCOPE';END IF;
 SELECT count(*) INTO n FROM tien404_v172c38_dispatch_qa.delivery_queue q
 JOIN tien404_v172c38_dispatch_qa.private_routes rt
 ON rt.tenant_ref=q.tenant_ref AND rt.store_ref=q.store_ref
 AND rt.channel=q.channel
 LEFT JOIN tien404_v172c39_reconcile_qa.reconciliation r
 ON r.delivery_id=q.delivery_id
 WHERE q.tenant_ref=w.tenant_ref AND q.store_ref=w.store_ref
 AND q.channel=w.channel AND q.state IN('READY_NO_SEND','RETRY_NO_SEND')
 AND q.attempt_count<w.max_attempts AND q.next_attempt_at<=clock_timestamp()
 AND (r.delivery_id IS NULL OR r.state='RETRY_AUTHORIZED_NO_SEND')
 AND rt.route_active AND rt.merchant_opt_in
 AND rt.subscription_active AND rt.consent_attested
 AND rt.synthetic_only AND rt.no_send;
 RETURN n;
END
$fn$;

-- Replace only the earlier ephemeral V38 preview, not actual n8n/Supabase.
CREATE OR REPLACE FUNCTION tien404_v172c38_dispatch_qa.preview_due_no_send(
 p_worker_ref text)
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
SELECT tien404_v172c39_reconcile_qa.preview_safe_due_no_send(p_worker_ref);
$fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172c39_reconcile_qa
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tien404_v172c39_reconcile_qa
 FROM PUBLIC,anon,authenticated;
INSERT INTO tien404_v172c39_reconcile_qa.private_reviewers VALUES
('reviewer-B','tenant-1','store-B','zalo',true,true),
('reviewer-C','tenant-2','store-C','messenger',true,true),
('reviewer-revoked','tenant-1','store-B','zalo',false,true);
