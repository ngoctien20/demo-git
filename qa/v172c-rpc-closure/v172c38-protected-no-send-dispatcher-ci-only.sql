-- V17.2C.38 — STRICTLY SYNTHETIC PRIVATE DISPATCH ADMISSION / NO SEND.
-- GitHub Actions' ephemeral PostgreSQL 17 only; never a remote migration.
-- Depends on V17.2C.37 outbox fixture and the 10 synthetic events.
DO $guard$
BEGIN
 IF current_database() <> 'postgres'
 OR to_regclass('tien404_v172c37_outbox_qa.notification_outbox') IS NULL
 OR to_regclass('tien404_v172c36_multiline_qa.orders') IS NULL
 THEN RAISE EXCEPTION 'DENY_NON_EPHEMERAL_V172C38'; END IF;
END
$guard$;

CREATE SCHEMA tien404_v172c38_dispatch_qa;
REVOKE ALL ON SCHEMA tien404_v172c38_dispatch_qa FROM PUBLIC,anon,authenticated;

-- Outbox is an immutable source of truth. The added composite unique
-- constraint lets the queue prove source event's exact tenant/store/order/type.
ALTER TABLE tien404_v172c37_outbox_qa.notification_outbox
 ADD CONSTRAINT v172c38_exact_source_event_key
 UNIQUE(event_id,tenant_ref,store_ref,order_ref,event_type);

CREATE TABLE tien404_v172c38_dispatch_qa.private_gate(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT true,
 synthetic_only boolean NOT NULL DEFAULT true CHECK(synthetic_only),
 no_send boolean NOT NULL DEFAULT true CHECK(no_send),
 hosted_enabled boolean NOT NULL DEFAULT false CHECK(NOT hosted_enabled),
 allow_real_delivery boolean NOT NULL DEFAULT false CHECK(NOT allow_real_delivery)
);
INSERT INTO tien404_v172c38_dispatch_qa.private_gate(singleton) VALUES(true);

-- These are SYNTHETIC routes without recipient, provider token or endpoint.
CREATE TABLE tien404_v172c38_dispatch_qa.private_routes(
 tenant_ref text NOT NULL,store_ref text NOT NULL,
 channel text NOT NULL CHECK(channel IN ('zalo','messenger','telegram','gmail','dashboard')),
 route_active boolean NOT NULL,
 merchant_opt_in boolean NOT NULL,
 subscription_active boolean NOT NULL,
 consent_attested boolean NOT NULL,
 synthetic_only boolean NOT NULL DEFAULT true CHECK(synthetic_only),
 no_send boolean NOT NULL DEFAULT true CHECK(no_send),
 PRIMARY KEY(tenant_ref,store_ref,channel),
 FOREIGN KEY(tenant_ref,store_ref)
 REFERENCES tien404_v172c36_multiline_qa.stores(tenant_ref,store_ref)
);
CREATE TABLE tien404_v172c38_dispatch_qa.private_workers(
 worker_ref text PRIMARY KEY,tenant_ref text NOT NULL,
 store_ref text NOT NULL,channel text NOT NULL,
 active boolean NOT NULL,attested boolean NOT NULL,
 max_attempts integer NOT NULL CHECK(max_attempts BETWEEN 1 AND 3),
 synthetic_only boolean NOT NULL DEFAULT true CHECK(synthetic_only),
 no_send boolean NOT NULL DEFAULT true CHECK(no_send),
 FOREIGN KEY(tenant_ref,store_ref,channel)
 REFERENCES tien404_v172c38_dispatch_qa.private_routes(tenant_ref,store_ref,channel)
);
CREATE TABLE tien404_v172c38_dispatch_qa.delivery_queue(
 delivery_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_event_id bigint NOT NULL,
 tenant_ref text NOT NULL,store_ref text NOT NULL,
 order_ref text NOT NULL,event_type text NOT NULL,
 channel text NOT NULL,
 state text NOT NULL DEFAULT 'READY_NO_SEND'
 CHECK(state IN ('READY_NO_SEND','RETRY_NO_SEND',
 'PREVIEW_OK_NO_SEND','TERMINAL_NO_SEND')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 3),
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_failure_kind text,
 can_send boolean NOT NULL DEFAULT false CHECK(NOT can_send),
 UNIQUE(source_event_id,channel),
 UNIQUE(tenant_ref,store_ref,order_ref,event_type,channel),
 FOREIGN KEY(source_event_id,tenant_ref,store_ref,order_ref,event_type)
 REFERENCES tien404_v172c37_outbox_qa.notification_outbox(
 event_id,tenant_ref,store_ref,order_ref,event_type),
 FOREIGN KEY(tenant_ref,store_ref,channel)
 REFERENCES tien404_v172c38_dispatch_qa.private_routes(tenant_ref,store_ref,channel)
);
CREATE TABLE tien404_v172c38_dispatch_qa.delivery_attempts(
 delivery_id bigint NOT NULL,
 attempt_no integer NOT NULL CHECK(attempt_no BETWEEN 1 AND 3),
 simulated_result text NOT NULL
 CHECK(simulated_result IN ('SIMULATED_OK_NOT_SENT',
 'SIMULATED_TRANSIENT_FAILURE','SIMULATED_PERMANENT_FAILURE')),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 can_send boolean NOT NULL DEFAULT false CHECK(NOT can_send),
 PRIMARY KEY(delivery_id,attempt_no),
 FOREIGN KEY(delivery_id)
 REFERENCES tien404_v172c38_dispatch_qa.delivery_queue(delivery_id)
);

CREATE FUNCTION tien404_v172c38_dispatch_qa.admit_committed_events_no_send()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
DECLARE v_added bigint;
BEGIN
 IF NOT EXISTS(
 SELECT 1 FROM tien404_v172c38_dispatch_qa.private_gate
 WHERE singleton AND enabled AND synthetic_only AND no_send AND NOT hosted_enabled
 AND NOT allow_real_delivery
 ) THEN RAISE EXCEPTION 'DENY_PRIVATE_DISPATCH_GATE';END IF;
 -- The event must have committed in V37; a rolled-back transaction has no
 -- source row to stage. There is no sender and no provider API.
 INSERT INTO tien404_v172c38_dispatch_qa.delivery_queue(
 source_event_id,tenant_ref,store_ref,order_ref,event_type,channel)
 SELECT e.event_id,e.tenant_ref,e.store_ref,e.order_ref,e.event_type,r.channel
 FROM tien404_v172c37_outbox_qa.notification_outbox e
 JOIN tien404_v172c38_dispatch_qa.private_routes r
 ON r.tenant_ref=e.tenant_ref AND r.store_ref=e.store_ref
 JOIN tien404_v172c36_multiline_qa.orders o
 ON o.order_ref=e.order_ref AND o.tenant_ref=e.tenant_ref
 AND o.store_ref=e.store_ref
 WHERE e.dispatch_state='HELD_NO_SEND' AND NOT e.can_send
 AND r.route_active AND r.merchant_opt_in AND r.subscription_active
 AND r.consent_attested AND r.synthetic_only AND r.no_send
 ON CONFLICT(source_event_id,channel) DO NOTHING;
 GET DIAGNOSTICS v_added=ROW_COUNT;
 RETURN v_added;
END
$fn$;

CREATE FUNCTION tien404_v172c38_dispatch_qa.preview_due_no_send(p_worker_ref text)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
DECLARE v_worker tien404_v172c38_dispatch_qa.private_workers%ROWTYPE;
 v_count bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tien404_v172c38_dispatch_qa.private_gate
 WHERE singleton AND enabled AND synthetic_only AND no_send AND NOT hosted_enabled
 AND NOT allow_real_delivery) THEN RAISE EXCEPTION 'DENY_PRIVATE_DISPATCH_GATE';END IF;
 SELECT * INTO v_worker FROM tien404_v172c38_dispatch_qa.private_workers
 WHERE worker_ref=p_worker_ref;
 IF NOT FOUND OR NOT v_worker.active OR NOT v_worker.attested
 OR NOT v_worker.synthetic_only OR NOT v_worker.no_send
 THEN RAISE EXCEPTION 'DENY_WORKER_ADMISSION';END IF;
 SELECT count(*) INTO v_count
 FROM tien404_v172c38_dispatch_qa.delivery_queue q
 JOIN tien404_v172c38_dispatch_qa.private_routes r
 ON r.tenant_ref=q.tenant_ref AND r.store_ref=q.store_ref AND r.channel=q.channel
 WHERE q.tenant_ref=v_worker.tenant_ref AND q.store_ref=v_worker.store_ref
 AND q.channel=v_worker.channel
 AND q.state IN ('READY_NO_SEND','RETRY_NO_SEND')
 AND q.attempt_count<v_worker.max_attempts
 AND q.next_attempt_at<=clock_timestamp()
 AND r.route_active AND r.merchant_opt_in
 AND r.subscription_active AND r.consent_attested AND r.synthetic_only AND r.no_send;
 RETURN v_count;
END
$fn$;

-- This function has no transport adapter. A "success" result means only
-- a SIMULATED attempt completed, NEVER actual delivery.
CREATE FUNCTION tien404_v172c38_dispatch_qa.simulate_attempt_no_send(
 p_worker_ref text,p_delivery_id bigint,
 p_simulated_outcome text,p_fault text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $fn$
DECLARE
 v_worker tien404_v172c38_dispatch_qa.private_workers%ROWTYPE;
 v_queue tien404_v172c38_dispatch_qa.delivery_queue%ROWTYPE;
 v_next integer;v_status text;v_result text;
BEGIN
 IF p_worker_ref IS NULL OR p_delivery_id IS NULL OR p_delivery_id<=0
 OR p_simulated_outcome NOT IN ('ok','transient','permanent')
 OR p_simulated_outcome IS NULL
 OR (p_fault IS NOT NULL AND p_fault NOT IN
 ('after_attempt_log','after_queue_update'))
 THEN RAISE EXCEPTION 'DENY_DISPATCH_ARGUMENT';END IF;
 IF NOT EXISTS(SELECT 1 FROM tien404_v172c38_dispatch_qa.private_gate
 WHERE singleton AND enabled AND synthetic_only AND no_send AND NOT hosted_enabled
 AND NOT allow_real_delivery) THEN RAISE EXCEPTION 'DENY_PRIVATE_DISPATCH_GATE';END IF;
 SELECT * INTO v_worker
 FROM tien404_v172c38_dispatch_qa.private_workers
 WHERE worker_ref=p_worker_ref;
 IF NOT FOUND OR NOT v_worker.active OR NOT v_worker.attested
 OR NOT v_worker.synthetic_only OR NOT v_worker.no_send
 THEN RAISE EXCEPTION 'DENY_WORKER_ADMISSION';END IF;
 -- Store+channel constraints are applied BEFORE claiming a queue row.
 -- SKIP LOCKED prevents simultaneous duplicate attempt numbering.
 SELECT * INTO v_queue FROM tien404_v172c38_dispatch_qa.delivery_queue q
 WHERE q.delivery_id=p_delivery_id
 AND q.tenant_ref=v_worker.tenant_ref AND q.store_ref=v_worker.store_ref
 AND q.channel=v_worker.channel
 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN 'DENY_SCOPE_OR_LOCKED_NO_WRITE';END IF;
 IF v_queue.state IN ('PREVIEW_OK_NO_SEND','TERMINAL_NO_SEND')
 THEN RETURN 'ALREADY_FINAL_NO_WRITE';END IF;
 IF v_queue.next_attempt_at>clock_timestamp()
 THEN RETURN 'NOT_DUE_NO_WRITE';END IF;
 IF v_queue.attempt_count>=v_worker.max_attempts
 THEN RAISE EXCEPTION 'DENY_ATTEMPT_LIMIT';END IF;
 IF NOT EXISTS(
 SELECT 1 FROM tien404_v172c38_dispatch_qa.private_routes r
 WHERE r.tenant_ref=v_queue.tenant_ref AND r.store_ref=v_queue.store_ref
 AND r.channel=v_queue.channel AND r.route_active
 AND r.merchant_opt_in AND r.subscription_active AND r.consent_attested
 AND r.synthetic_only AND r.no_send
 ) THEN RAISE EXCEPTION 'DENY_ROUTE_ADMISSION';END IF;
 IF NOT EXISTS(
 SELECT 1 FROM tien404_v172c37_outbox_qa.notification_outbox e
 WHERE e.event_id=v_queue.source_event_id AND e.tenant_ref=v_queue.tenant_ref
 AND e.store_ref=v_queue.store_ref AND e.order_ref=v_queue.order_ref
 AND e.event_type=v_queue.event_type AND e.dispatch_state='HELD_NO_SEND'
 AND NOT e.can_send
 ) THEN RAISE EXCEPTION 'DENY_SOURCE_EVENT';END IF;
 v_next:=v_queue.attempt_count+1;
 v_result:=CASE p_simulated_outcome
 WHEN 'ok' THEN 'SIMULATED_OK_NOT_SENT'
 WHEN 'transient' THEN 'SIMULATED_TRANSIENT_FAILURE'
 ELSE 'SIMULATED_PERMANENT_FAILURE' END;
 INSERT INTO tien404_v172c38_dispatch_qa.delivery_attempts(
 delivery_id,attempt_no,simulated_result)
 VALUES(p_delivery_id,v_next,v_result);
 IF p_fault='after_attempt_log' THEN
 RAISE EXCEPTION 'QA_FAIL_AFTER_ATTEMPT_LOG';END IF;
 v_status:=CASE
 WHEN p_simulated_outcome='ok' THEN 'PREVIEW_OK_NO_SEND'
 WHEN p_simulated_outcome='permanent' OR v_next>=v_worker.max_attempts
 THEN 'TERMINAL_NO_SEND'
 ELSE 'RETRY_NO_SEND' END;
 UPDATE tien404_v172c38_dispatch_qa.delivery_queue SET
 attempt_count=v_next,state=v_status,
 last_failure_kind=CASE WHEN p_simulated_outcome='ok' THEN NULL
 WHEN p_simulated_outcome='transient' THEN 'TRANSIENT' ELSE 'PERMANENT' END,
 next_attempt_at=CASE WHEN v_status='RETRY_NO_SEND'
 THEN clock_timestamp()+make_interval(secs=>v_next*60)
 ELSE clock_timestamp() END
 WHERE delivery_id=p_delivery_id;
 IF p_fault='after_queue_update' THEN
 RAISE EXCEPTION 'QA_FAIL_AFTER_QUEUE_UPDATE';END IF;
 RETURN 'SIMULATED_ATTEMPT_RECORDED_NO_SEND';
END
$fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172c38_dispatch_qa
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tien404_v172c38_dispatch_qa
 FROM PUBLIC,anon,authenticated;

-- Guarded CI-only routes/identities, NO real recipients.
INSERT INTO tien404_v172c38_dispatch_qa.private_routes(
 tenant_ref,store_ref,channel,route_active,merchant_opt_in,
 subscription_active,consent_attested)
 VALUES('tenant-1','store-B','zalo',true,true,true,true),
 ('tenant-2','store-C','messenger',true,true,true,true),
 ('tenant-1','store-A','telegram',false,false,false,false);
INSERT INTO tien404_v172c38_dispatch_qa.private_workers(
 worker_ref,tenant_ref,store_ref,channel,active,attested,max_attempts)
 VALUES('worker-zalo-B','tenant-1','store-B','zalo',true,true,3),
 ('worker-messenger-C','tenant-2','store-C','messenger',true,true,3),
 ('worker-disabled-B','tenant-1','store-B','zalo',false,true,3),
 ('worker-unattested-C','tenant-2','store-C','messenger',true,false,3);
