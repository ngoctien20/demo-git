-- TIEN404 G0.12 — DISPOSABLE PostgreSQL 17 ONLY.
-- Creates a NO-SEND operator queue over G0.11's disposable event ledger.
-- NEVER execute on hosted Supabase/n8n production, never use real Page/MID/PII.
-- Operator/reviewer identifiers in QA are synthetic aliases, NOT real identities.
BEGIN;
CREATE SCHEMA IF NOT EXISTS t404_g12_disposable_qa;
REVOKE ALL ON SCHEMA t404_g12_disposable_qa FROM PUBLIC;

CREATE TABLE t404_g12_disposable_qa.review_cases (
 case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider text NOT NULL CHECK (provider='MESSENGER'),
 installation_digest bytea NOT NULL CHECK (octet_length(installation_digest)=32),
 event_digest bytea NOT NULL CHECK (octet_length(event_digest)=32),
 reason text NOT NULL CHECK (reason IN ('LEASE_TIMEOUT_NO_SEND','SEND_UNCERTAIN')),
 status text NOT NULL DEFAULT 'OPEN'
   CHECK (status IN ('OPEN','IN_REVIEW','WAITING_COSIGN','RESOLVED')),
 first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 review_token uuid,
 review_lease_until timestamptz,
 operator_tag text,
 evidence_digest bytea CHECK (evidence_digest IS NULL OR octet_length(evidence_digest)=32),
 evidence_kind text CHECK (evidence_kind IS NULL OR evidence_kind IN
   ('PRIVATE_SYSTEM_LOG','PROVIDER_RECEIPT','NO_SEND_RUNTIME_PROOF')),
 reviewer_tag text,
 resolution text CHECK (resolution IS NULL OR resolution IN
   ('PROVIDER_ACCEPTED_CONFIRMED','DUPLICATE_CONFIRMED','NO_SEND_CLOSED')),
 CONSTRAINT g12_one_case_per_event UNIQUE(provider,installation_digest,event_digest),
 CONSTRAINT g12_private_aliases CHECK (
   (operator_tag IS NULL OR operator_tag ~ '^qaop_[a-z0-9_]{3,32}$') AND
   (reviewer_tag IS NULL OR reviewer_tag ~ '^qarev_[a-z0-9_]{3,32}$')
 ),
 CONSTRAINT g12_state_invariants CHECK (
   (status='OPEN' AND review_token IS NULL AND review_lease_until IS NULL
     AND evidence_digest IS NULL AND reviewer_tag IS NULL AND resolution IS NULL)
   OR
   (status='IN_REVIEW' AND review_token IS NOT NULL AND review_lease_until IS NOT NULL
     AND operator_tag IS NOT NULL AND evidence_digest IS NULL AND reviewer_tag IS NULL)
   OR
   (status='WAITING_COSIGN' AND review_token IS NULL AND review_lease_until IS NULL
     AND operator_tag IS NOT NULL AND evidence_digest IS NOT NULL
     AND evidence_kind IS NOT NULL AND reviewer_tag IS NULL AND resolution IS NULL)
   OR
   (status='RESOLVED' AND review_token IS NULL AND review_lease_until IS NULL
     AND operator_tag IS NOT NULL AND reviewer_tag IS NOT NULL
     AND evidence_digest IS NOT NULL AND resolution IS NOT NULL)
 ),
 CONSTRAINT g12_ledger_fk FOREIGN KEY(provider,installation_digest,event_digest)
   REFERENCES t404_g11_disposable_qa.event_ledger(provider,installation_digest,event_digest)
   ON DELETE RESTRICT
);
CREATE INDEX g12_queue_status_idx ON t404_g12_disposable_qa.review_cases(status,first_seen_at,case_id);
REVOKE ALL ON TABLE t404_g12_disposable_qa.review_cases FROM PUBLIC;
ALTER TABLE t404_g12_disposable_qa.review_cases ENABLE ROW LEVEL SECURITY;

CREATE TABLE t404_g12_disposable_qa.review_history (
 audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 case_id uuid NOT NULL REFERENCES t404_g12_disposable_qa.review_cases(case_id) ON DELETE RESTRICT,
 action text NOT NULL CHECK (action IN
   ('QUEUED','CLAIMED','CLAIM_EXPIRED_REPLACED','EVIDENCE_SUBMITTED','INDEPENDENT_REVIEWED')),
 actor_kind text NOT NULL CHECK (actor_kind IN ('SYSTEM','OPERATOR','REVIEWER')),
 actor_tag text,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON TABLE t404_g12_disposable_qa.review_history FROM PUBLIC;
ALTER TABLE t404_g12_disposable_qa.review_history ENABLE ROW LEVEL SECURITY;

-- Scan is READ-ONLY to original G11 ledger; it can enqueue review cases,
-- but never transitions G11 event states, never sends, never retries.
CREATE OR REPLACE FUNCTION t404_g12_disposable_qa.enqueue_timeout_and_uncertain(
 p_at timestamptz DEFAULT clock_timestamp(),p_limit integer DEFAULT 100
) RETURNS TABLE(new_cases integer,eligible_cases integer)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,t404_g12_disposable_qa,t404_g11_disposable_qa AS $$
DECLARE
  v record;
  cid uuid;
  added integer:=0;
  eligible integer:=0;
BEGIN
 IF p_at IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='G12_BAD_SCAN_SCOPE';
 END IF;
 FOR v IN
  SELECT provider,installation_digest,event_digest,state,lease_until
  FROM t404_g11_disposable_qa.event_ledger
  WHERE state='SEND_UNCERTAIN'
     OR (state='LEASED' AND lease_until<=p_at)
  ORDER BY CASE WHEN state='SEND_UNCERTAIN' THEN 0 ELSE 1 END,
           updated_at,provider,installation_digest,event_digest
  LIMIT p_limit
 LOOP
   eligible:=eligible+1;
   INSERT INTO t404_g12_disposable_qa.review_cases(
     provider,installation_digest,event_digest,reason,first_seen_at,updated_at)
   VALUES(v.provider,v.installation_digest,v.event_digest,
     CASE WHEN v.state='SEND_UNCERTAIN' THEN 'SEND_UNCERTAIN'
          ELSE 'LEASE_TIMEOUT_NO_SEND' END,p_at,p_at)
   ON CONFLICT(provider,installation_digest,event_digest) DO NOTHING
   RETURNING case_id INTO cid;
   IF cid IS NOT NULL THEN
     added:=added+1;
     INSERT INTO t404_g12_disposable_qa.review_history(
       case_id,action,actor_kind,occurred_at)
     VALUES(cid,'QUEUED','SYSTEM',p_at);
   END IF;
   cid:=NULL;
 END LOOP;
 RETURN QUERY SELECT added,eligible;
END $$;

CREATE OR REPLACE FUNCTION t404_g12_disposable_qa.take_for_review(
 p_case_id uuid,p_actor text,p_at timestamptz DEFAULT clock_timestamp(),
 p_lease_seconds integer DEFAULT 120
) RETURNS TABLE(result text,review_fence uuid)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,t404_g12_disposable_qa AS $$
DECLARE c t404_g12_disposable_qa.review_cases%ROWTYPE;
        prev_status text;
BEGIN
 IF p_case_id IS NULL OR p_actor IS NULL OR
    p_actor !~ '^qaop_[a-z0-9_]{3,32}$' OR p_at IS NULL OR
    p_lease_seconds NOT BETWEEN 30 AND 600 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='G12_OPERATOR_SCOPE_REJECTED';
 END IF;
 SELECT * INTO c FROM t404_g12_disposable_qa.review_cases
 WHERE case_id=p_case_id FOR UPDATE;
 IF NOT FOUND THEN RETURN QUERY SELECT 'not_found'::text,NULL::uuid;RETURN; END IF;
 IF c.status='OPEN' OR
    (c.status='IN_REVIEW' AND c.review_lease_until<=p_at) THEN
   prev_status:=c.status;
   UPDATE t404_g12_disposable_qa.review_cases
   SET status='IN_REVIEW',review_token=gen_random_uuid(),
       review_lease_until=p_at+make_interval(secs=>p_lease_seconds),
       operator_tag=p_actor,updated_at=p_at
   WHERE case_id=p_case_id RETURNING * INTO c;
   INSERT INTO t404_g12_disposable_qa.review_history(
     case_id,action,actor_kind,actor_tag,occurred_at)
   VALUES(p_case_id,CASE WHEN prev_status='OPEN' THEN 'CLAIMED'
      ELSE 'CLAIM_EXPIRED_REPLACED' END,'OPERATOR',p_actor,p_at);
   RETURN QUERY SELECT 'claimed'::text,c.review_token;RETURN;
 END IF;
 RETURN QUERY SELECT
  (CASE WHEN c.status='RESOLVED' THEN 'resolved'
        WHEN c.status='WAITING_COSIGN' THEN 'waiting_cosign'
        ELSE 'busy' END)::text,NULL::uuid;
END $$;

-- Evidence digest is a synthetic private "document commitment" in QA, never
-- proof that the underlying real Meta/Store originals were inspected.
CREATE OR REPLACE FUNCTION t404_g12_disposable_qa.submit_operator_evidence(
 p_case_id uuid,p_operator text,p_fence uuid,p_evidence bytea,p_kind text,
 p_at timestamptz DEFAULT clock_timestamp()
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,t404_g12_disposable_qa AS $$
DECLARE c t404_g12_disposable_qa.review_cases%ROWTYPE;
BEGIN
 IF p_case_id IS NULL OR p_fence IS NULL OR p_at IS NULL OR
   p_operator IS NULL OR p_operator !~ '^qaop_[a-z0-9_]{3,32}$' OR
   p_evidence IS NULL OR octet_length(p_evidence)<>32 OR
   p_kind NOT IN ('PRIVATE_SYSTEM_LOG','PROVIDER_RECEIPT','NO_SEND_RUNTIME_PROOF')
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='G12_EVIDENCE_INVALID';END IF;
 SELECT * INTO c FROM t404_g12_disposable_qa.review_cases
 WHERE case_id=p_case_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'not_found';END IF;
 IF c.status<>'IN_REVIEW' OR c.operator_tag<>p_operator OR
   c.review_token<>p_fence OR c.review_lease_until<=p_at
 THEN RETURN 'fenced_or_expired'; END IF;
 UPDATE t404_g12_disposable_qa.review_cases
 SET status='WAITING_COSIGN',review_token=NULL,review_lease_until=NULL,
     evidence_digest=p_evidence,evidence_kind=p_kind,updated_at=p_at
 WHERE case_id=p_case_id;
 INSERT INTO t404_g12_disposable_qa.review_history(
   case_id,action,actor_kind,actor_tag,occurred_at)
 VALUES(p_case_id,'EVIDENCE_SUBMITTED','OPERATOR',p_operator,p_at);
 RETURN 'waiting_cosign';
END $$;

-- A second reviewer must confirm the SAME evidence digest. It records a QA
-- decision only; it NEVER authorizes provider send or clears SEND_UNCERTAIN
-- from the original G11 ledger.
CREATE OR REPLACE FUNCTION t404_g12_disposable_qa.independent_cosign(
 p_case_id uuid,p_reviewer text,p_rechecked_evidence bytea,
 p_resolution text,p_at timestamptz DEFAULT clock_timestamp()
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,t404_g12_disposable_qa AS $$
DECLARE c t404_g12_disposable_qa.review_cases%ROWTYPE;
BEGIN
 IF p_case_id IS NULL OR p_at IS NULL OR p_reviewer IS NULL OR
   p_reviewer !~ '^qarev_[a-z0-9_]{3,32}$' OR
   p_rechecked_evidence IS NULL OR octet_length(p_rechecked_evidence)<>32 OR
   p_resolution NOT IN ('PROVIDER_ACCEPTED_CONFIRMED',
                         'DUPLICATE_CONFIRMED','NO_SEND_CLOSED')
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='G12_REVIEW_SCOPE_INVALID';END IF;
 SELECT * INTO c FROM t404_g12_disposable_qa.review_cases
 WHERE case_id=p_case_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'not_found';END IF;
 IF c.status='RESOLVED' THEN RETURN 'already_resolved';END IF;
 IF c.status<>'WAITING_COSIGN' OR c.evidence_digest<>p_rechecked_evidence THEN
   RETURN 'not_independently_verified';END IF;
 IF c.reason='SEND_UNCERTAIN' AND p_resolution='NO_SEND_CLOSED' THEN
   RETURN 'uncertain_send_cannot_be_closed_without_provider_receipt';END IF;
 IF c.reason='SEND_UNCERTAIN' AND c.evidence_kind<>'PROVIDER_RECEIPT' THEN
   RETURN 'provider_receipt_required';END IF;
 UPDATE t404_g12_disposable_qa.review_cases
 SET status='RESOLVED',resolution=p_resolution,reviewer_tag=p_reviewer,
     updated_at=p_at
 WHERE case_id=p_case_id;
 INSERT INTO t404_g12_disposable_qa.review_history(
   case_id,action,actor_kind,actor_tag,occurred_at)
 VALUES(p_case_id,'INDEPENDENT_REVIEWED','REVIEWER',p_reviewer,p_at);
 RETURN 'review_recorded_no_send';
END $$;

CREATE OR REPLACE FUNCTION t404_g12_disposable_qa.operator_summary()
RETURNS TABLE(display_state text,number_of_cases bigint)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,t404_g12_disposable_qa AS $$
 SELECT CASE WHEN status IN ('OPEN','IN_REVIEW','WAITING_COSIGN')
   THEN 'CAN_KIEM_TRA' ELSE 'DA_DOI_SOAT' END AS display_state,
   count(*)::bigint
 FROM t404_g12_disposable_qa.review_cases
 GROUP BY 1 ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION t404_g12_disposable_qa.enqueue_timeout_and_uncertain(timestamptz,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION t404_g12_disposable_qa.take_for_review(uuid,text,timestamptz,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION t404_g12_disposable_qa.submit_operator_evidence(uuid,text,uuid,bytea,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION t404_g12_disposable_qa.independent_cosign(uuid,text,bytea,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION t404_g12_disposable_qa.operator_summary() FROM PUBLIC;
COMMIT;
