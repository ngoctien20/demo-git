-- TIEN404 G0.11 — DISPOSABLE POSTGRESQL 17 ONLY. NOT a hosted migration.
-- Lease/fencing ledger for AUTHORIZED no-send QA, with explicit uncertainty
-- barrier before any future provider SEND. NEVER run on real Supabase.
BEGIN;
CREATE SCHEMA IF NOT EXISTS t404_g11_disposable_qa;
REVOKE ALL ON SCHEMA t404_g11_disposable_qa FROM PUBLIC;

CREATE TABLE IF NOT EXISTS t404_g11_disposable_qa.event_ledger (
  provider text NOT NULL CHECK (provider='MESSENGER'),
  installation_digest bytea NOT NULL CHECK (octet_length(installation_digest)=32),
  event_digest bytea NOT NULL CHECK (octet_length(event_digest)=32),
  payload_digest bytea NOT NULL CHECK (octet_length(payload_digest)=32),
  state text NOT NULL DEFAULT 'READY'
    CHECK (state IN ('READY','LEASED','DONE_NO_SEND','SEND_UNCERTAIN')),
  lease_token uuid,
  lease_until timestamptz,
  attempt_no integer NOT NULL DEFAULT 0 CHECK (attempt_no BETWEEN 0 AND 100000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (provider,installation_digest,event_digest),
  CONSTRAINT t404_g11_lease_shape CHECK (
    (state='LEASED' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (state<>'LEASED' AND lease_token IS NULL AND lease_until IS NULL)
  )
);
REVOKE ALL ON TABLE t404_g11_disposable_qa.event_ledger FROM PUBLIC;
ALTER TABLE t404_g11_disposable_qa.event_ledger ENABLE ROW LEVEL SECURITY;

-- Returns claimed/reclaimed with a fenced UUID token, otherwise:
-- leased = another worker owns unexpired lease; done = already committed
-- no-send; conflict = same MID with different payload; manual_review =
-- outbound may have occurred. No result ever authorizes a provider send.
CREATE OR REPLACE FUNCTION t404_g11_disposable_qa.acquire_nosend(
 p_provider text,p_installation bytea,p_event bytea,p_payload bytea,
 p_at timestamptz DEFAULT clock_timestamp(),p_lease_seconds int DEFAULT 45
) RETURNS TABLE(disposition text,worker_token uuid,attempt integer)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,t404_g11_disposable_qa AS $$
DECLARE v t404_g11_disposable_qa.event_ledger%ROWTYPE;
        next_state text;
BEGIN
 IF p_provider IS DISTINCT FROM 'MESSENGER'
 OR p_installation IS NULL OR octet_length(p_installation)<>32
 OR p_event IS NULL OR octet_length(p_event)<>32
 OR p_payload IS NULL OR octet_length(p_payload)<>32
 OR p_at IS NULL OR p_lease_seconds NOT BETWEEN 5 AND 300
 THEN RAISE EXCEPTION USING ERRCODE='22023',
      MESSAGE='G11_INVALID_DISPOSABLE_QA_CLAIM'; END IF;

 -- Index arbitration is atomic ACROSS PostgreSQL sessions. The next
 -- SELECT FOR UPDATE serializes the lease transition and stale-worker fence.
 INSERT INTO t404_g11_disposable_qa.event_ledger
   (provider,installation_digest,event_digest,payload_digest)
 VALUES (p_provider,p_installation,p_event,p_payload)
 ON CONFLICT (provider,installation_digest,event_digest) DO NOTHING;

 SELECT * INTO v FROM t404_g11_disposable_qa.event_ledger
 WHERE provider=p_provider AND installation_digest=p_installation
   AND event_digest=p_event FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE='40001',
      MESSAGE='G11_LEDGER_CONCURRENT_VISIBILITY_UNCERTAIN';
 END IF;
 IF v.payload_digest<>p_payload THEN
   RETURN QUERY SELECT 'conflict'::text,NULL::uuid,v.attempt_no;RETURN;
 END IF;
 IF v.state='DONE_NO_SEND' THEN
   RETURN QUERY SELECT 'done'::text,NULL::uuid,v.attempt_no;RETURN;
 END IF;
 IF v.state='SEND_UNCERTAIN' THEN
   RETURN QUERY SELECT 'manual_review'::text,NULL::uuid,v.attempt_no;RETURN;
 END IF;
 IF v.state='LEASED' AND v.lease_until>p_at THEN
   RETURN QUERY SELECT 'leased'::text,NULL::uuid,v.attempt_no;RETURN;
 END IF;
 IF v.attempt_no>=100000 THEN
   RAISE EXCEPTION USING ERRCODE='22023',
      MESSAGE='G11_ATTEMPT_CAP_REACHED';
 END IF;
 next_state:=CASE WHEN v.state='LEASED' THEN 'reclaimed' ELSE 'claimed' END;
 UPDATE t404_g11_disposable_qa.event_ledger
 SET state='LEASED',lease_token=gen_random_uuid(),
     lease_until=p_at+make_interval(secs=>p_lease_seconds),
     attempt_no=attempt_no+1,updated_at=clock_timestamp()
 WHERE provider=p_provider AND installation_digest=p_installation
   AND event_digest=p_event
 RETURNING * INTO v;
 RETURN QUERY SELECT next_state,v.lease_token,v.attempt_no;
END $$;

-- A no-send task is counted DONE only after operator-controlled handler's
-- no-send result has been durably recorded. Expired/fenced workers cannot
-- complete. Does not read Customer, Order or product tables.
CREATE OR REPLACE FUNCTION t404_g11_disposable_qa.complete_nosend(
 p_provider text,p_installation bytea,p_event bytea,p_worker_token uuid,
 p_at timestamptz DEFAULT clock_timestamp()
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,t404_g11_disposable_qa AS $$
DECLARE v t404_g11_disposable_qa.event_ledger%ROWTYPE;
BEGIN
 IF p_provider IS DISTINCT FROM 'MESSENGER'
 OR p_installation IS NULL OR octet_length(p_installation)<>32
 OR p_event IS NULL OR octet_length(p_event)<>32
 OR p_worker_token IS NULL OR p_at IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='22023',
     MESSAGE='G11_INVALID_COMPLETION'; END IF;
 SELECT * INTO v FROM t404_g11_disposable_qa.event_ledger
 WHERE provider=p_provider AND installation_digest=p_installation
   AND event_digest=p_event FOR UPDATE;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 IF v.state='SEND_UNCERTAIN' THEN RETURN 'manual_review'; END IF;
 IF v.state='DONE_NO_SEND' THEN RETURN 'done'; END IF;
 IF v.state<>'LEASED' OR v.lease_token<>p_worker_token THEN
   RETURN 'stale_worker';
 END IF;
 IF v.lease_until<=p_at THEN RETURN 'lease_expired'; END IF;
 UPDATE t404_g11_disposable_qa.event_ledger
 SET state='DONE_NO_SEND',lease_token=NULL,lease_until=NULL,
     updated_at=clock_timestamp()
 WHERE provider=p_provider AND installation_digest=p_installation
   AND event_digest=p_event;
 RETURN 'completed';
END $$;

-- Safety boundary for FUTURE provider SEND; never called by the G0.11
-- QA workflow. Once send intent is persisted there is NO automatic retry,
-- because a crash may occur after provider acceptance but before ACK.
CREATE OR REPLACE FUNCTION t404_g11_disposable_qa.mark_send_uncertain(
 p_provider text,p_installation bytea,p_event bytea,p_worker_token uuid,
 p_at timestamptz DEFAULT clock_timestamp()
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,t404_g11_disposable_qa AS $$
DECLARE v t404_g11_disposable_qa.event_ledger%ROWTYPE;
BEGIN
 IF p_provider IS DISTINCT FROM 'MESSENGER'
 OR p_installation IS NULL OR octet_length(p_installation)<>32
 OR p_event IS NULL OR octet_length(p_event)<>32
 OR p_worker_token IS NULL OR p_at IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='22023',
     MESSAGE='G11_INVALID_SEND_BOUNDARY'; END IF;
 SELECT * INTO v FROM t404_g11_disposable_qa.event_ledger
 WHERE provider=p_provider AND installation_digest=p_installation
   AND event_digest=p_event FOR UPDATE;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 IF v.state='SEND_UNCERTAIN' THEN RETURN 'manual_review'; END IF;
 IF v.state='DONE_NO_SEND' THEN RETURN 'done'; END IF;
 IF v.state<>'LEASED' OR v.lease_token<>p_worker_token THEN
   RETURN 'stale_worker'; END IF;
 IF v.lease_until<=p_at THEN RETURN 'lease_expired'; END IF;
 UPDATE t404_g11_disposable_qa.event_ledger
 SET state='SEND_UNCERTAIN',lease_token=NULL,lease_until=NULL,
     updated_at=clock_timestamp()
 WHERE provider=p_provider AND installation_digest=p_installation
   AND event_digest=p_event;
 RETURN 'manual_review';
END $$;

REVOKE ALL ON FUNCTION t404_g11_disposable_qa.acquire_nosend(text,bytea,bytea,bytea,timestamptz,int) FROM PUBLIC;
REVOKE ALL ON FUNCTION t404_g11_disposable_qa.complete_nosend(text,bytea,bytea,uuid,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION t404_g11_disposable_qa.mark_send_uncertain(text,bytea,bytea,uuid,timestamptz) FROM PUBLIC;
COMMIT;
