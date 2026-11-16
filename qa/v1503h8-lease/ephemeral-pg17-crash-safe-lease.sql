\set ON_ERROR_STOP on
-- TIEN404 V15.0-03H.8. EPHEMERAL POSTGRES 17 ONLY.
-- Do NOT apply to Supabase, real projects, or non-disposable databases.
DO $guard$
BEGIN
  IF current_database() <> 'tien404_h8_ephemeral' THEN
    RAISE EXCEPTION 'H8 refuses database %: EPHEMERAL FIXTURE ONLY',current_database();
  END IF;
END
$guard$;

CREATE SCHEMA h8_lease_qa;
REVOKE ALL ON SCHEMA h8_lease_qa FROM PUBLIC;

CREATE TABLE h8_lease_qa.approvals (
  receipt_ref text PRIMARY KEY,
  project_ref text NOT NULL CHECK(project_ref='QA_EPHEMERAL_ONLY'),
  operation text NOT NULL CHECK(operation='SIMULATE_BACKUP_NO_EXPORT'),
  request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  nonce_digest text NOT NULL UNIQUE CHECK(nonce_digest ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'ready'
    CHECK(state IN ('ready','leased','needs_review','revoked','succeeded')),
  authorization_expires_at timestamptz NOT NULL,
  lease_owner text,
  lease_deadline timestamptz,
  lease_hard_deadline timestamptz,
  fence bigint NOT NULL DEFAULT 0 CHECK(fence>=0),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  completed_digest text CHECK(completed_digest ~ '^[a-f0-9]{64}$'),
  completed_at timestamptz,
  CHECK (
    (state='leased' AND lease_owner IS NOT NULL AND lease_deadline IS NOT NULL
      AND lease_hard_deadline IS NOT NULL AND completed_at IS NULL AND completed_digest IS NULL)
    OR
    (state='succeeded' AND lease_owner IS NULL AND lease_deadline IS NULL
      AND lease_hard_deadline IS NULL AND completed_at IS NOT NULL AND completed_digest IS NOT NULL)
    OR
    (state IN ('ready','needs_review','revoked') AND lease_owner IS NULL
      AND lease_deadline IS NULL AND lease_hard_deadline IS NULL
      AND completed_at IS NULL AND completed_digest IS NULL)
  )
);
ALTER TABLE h8_lease_qa.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE h8_lease_qa.approvals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA h8_lease_qa FROM PUBLIC;

-- Fencing token + atomic transition is the *local DB* linearization point.
-- NOT a proof of actual external side-effect exactly-once behavior.
CREATE FUNCTION h8_lease_qa.reserve_once(
  p_receipt text,p_request_digest text,p_nonce_digest text,p_worker text,p_seconds integer
) RETURNS bigint LANGUAGE sql SECURITY INVOKER
SET search_path=pg_catalog,h8_lease_qa AS $fn$
  WITH claimed AS (
    UPDATE h8_lease_qa.approvals
    SET state='leased',lease_owner=p_worker,
        lease_deadline=clock_timestamp()+make_interval(secs=>p_seconds),
        lease_hard_deadline=clock_timestamp()+interval '5 minutes',
        fence=fence+1,attempt_count=attempt_count+1
    WHERE receipt_ref=p_receipt AND request_digest=p_request_digest
      AND nonce_digest=p_nonce_digest AND project_ref='QA_EPHEMERAL_ONLY'
      AND operation='SIMULATE_BACKUP_NO_EXPORT'
      AND state='ready'
      AND authorization_expires_at>clock_timestamp()+make_interval(secs=>p_seconds)
      AND p_seconds BETWEEN 1 AND 60
      AND p_worker ~ '^QA_WORKER_[A-Z0-9_]{4,60}$'
    RETURNING fence
  )
  SELECT COALESCE((SELECT fence FROM claimed),0::bigint);
$fn$;
REVOKE ALL ON FUNCTION h8_lease_qa.reserve_once(text,text,text,text,integer) FROM PUBLIC;

CREATE FUNCTION h8_lease_qa.renew_lease(
  p_receipt text,p_worker text,p_fence bigint,p_seconds integer
) RETURNS boolean LANGUAGE sql SECURITY INVOKER
SET search_path=pg_catalog,h8_lease_qa AS $fn$
 WITH updated AS (
  UPDATE h8_lease_qa.approvals
  SET lease_deadline=LEAST(clock_timestamp()+make_interval(secs=>p_seconds),
                           lease_hard_deadline,authorization_expires_at)
  WHERE receipt_ref=p_receipt AND state='leased' AND lease_owner=p_worker
    AND fence=p_fence AND p_fence>0 AND p_seconds BETWEEN 1 AND 60
    AND lease_deadline>clock_timestamp() AND lease_hard_deadline>clock_timestamp()
    AND authorization_expires_at>clock_timestamp()+interval '1 second'
  RETURNING 1
 )
 SELECT EXISTS(SELECT 1 FROM updated);
$fn$;
REVOKE ALL ON FUNCTION h8_lease_qa.renew_lease(text,text,bigint,integer) FROM PUBLIC;

-- Accept a claimed artifact *digest only* (synthetic). No actual bytes or
-- backup delivery. Stale or stolen worker/fence cannot complete.
CREATE FUNCTION h8_lease_qa.finish_once(
  p_receipt text,p_worker text,p_fence bigint,p_artifact_digest text
) RETURNS boolean LANGUAGE sql SECURITY INVOKER
SET search_path=pg_catalog,h8_lease_qa AS $fn$
  WITH updated AS (
    UPDATE h8_lease_qa.approvals
       SET state='succeeded',lease_owner=NULL,lease_deadline=NULL,
           lease_hard_deadline=NULL,completed_at=clock_timestamp(),
           completed_digest=p_artifact_digest
     WHERE receipt_ref=p_receipt AND state='leased'
       AND lease_owner=p_worker AND fence=p_fence AND p_fence>0
       AND lease_deadline>clock_timestamp() AND authorization_expires_at>clock_timestamp()
       AND p_artifact_digest ~ '^[a-f0-9]{64}$'
     RETURNING 1
  )
  SELECT EXISTS(SELECT 1 FROM updated);
$fn$;
REVOKE ALL ON FUNCTION h8_lease_qa.finish_once(text,text,bigint,text) FROM PUBLIC;

-- Crash/timeout -> NEEDS_REVIEW; NEVER automatically rearm, avoiding
-- duplicate backup if external side effect happened just before crash.
CREATE FUNCTION h8_lease_qa.quarantine_stale()
RETURNS integer LANGUAGE sql SECURITY INVOKER
SET search_path=pg_catalog,h8_lease_qa AS $fn$
  WITH u AS (
    UPDATE h8_lease_qa.approvals
       SET state='needs_review',lease_owner=NULL,lease_deadline=NULL,
           lease_hard_deadline=NULL
     WHERE state='leased' AND (
       lease_deadline<=clock_timestamp() OR
       lease_hard_deadline<=clock_timestamp() OR
       authorization_expires_at<=clock_timestamp())
    RETURNING 1
  )
  SELECT count(*)::integer FROM u;
$fn$;
REVOKE ALL ON FUNCTION h8_lease_qa.quarantine_stale() FROM PUBLIC;

CREATE FUNCTION h8_lease_qa.revoke_once(p_receipt text,p_digest text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER
SET search_path=pg_catalog,h8_lease_qa AS $fn$
 WITH u AS (
   UPDATE h8_lease_qa.approvals
   SET state='revoked',lease_owner=NULL,lease_deadline=NULL,lease_hard_deadline=NULL
   WHERE receipt_ref=p_receipt AND request_digest=p_digest
     AND state IN ('ready','leased','needs_review')
   RETURNING 1
 )
 SELECT EXISTS(SELECT 1 FROM u);
$fn$;
REVOKE ALL ON FUNCTION h8_lease_qa.revoke_once(text,text) FROM PUBLIC;

INSERT INTO h8_lease_qa.approvals
  (receipt_ref,project_ref,operation,request_digest,nonce_digest,authorization_expires_at)
VALUES
 ('QA_H8_ONCE','QA_EPHEMERAL_ONLY','SIMULATE_BACKUP_NO_EXPORT',repeat('a',64),repeat('1',64),now()+interval '1 hour'),
 ('QA_H8_BAD_DIGEST','QA_EPHEMERAL_ONLY','SIMULATE_BACKUP_NO_EXPORT',repeat('b',64),repeat('2',64),now()+interval '1 hour'),
 ('QA_H8_EXPIRED','QA_EPHEMERAL_ONLY','SIMULATE_BACKUP_NO_EXPORT',repeat('c',64),repeat('3',64),now()-interval '1 second'),
 ('QA_H8_REVOKE','QA_EPHEMERAL_ONLY','SIMULATE_BACKUP_NO_EXPORT',repeat('d',64),repeat('4',64),now()+interval '1 hour'),
 ('QA_H8_STALE','QA_EPHEMERAL_ONLY','SIMULATE_BACKUP_NO_EXPORT',repeat('e',64),repeat('5',64),now()+interval '1 hour'),
 ('QA_H8_CONCURRENT','QA_EPHEMERAL_ONLY','SIMULATE_BACKUP_NO_EXPORT',repeat('f',64),repeat('6',64),now()+interval '1 hour'),
 ('QA_H8_RENEW','QA_EPHEMERAL_ONLY','SIMULATE_BACKUP_NO_EXPORT',repeat('0',64),repeat('7',64),now()+interval '1 hour');

DO $tests$
DECLARE f bigint;
BEGIN
 IF h8_lease_qa.reserve_once('QA_H8_EXPIRED',repeat('c',64),repeat('3',64),'QA_WORKER_AAAA',60)<>0 THEN
   RAISE EXCEPTION 'expired request should be denied';
 END IF;
 IF h8_lease_qa.reserve_once('QA_H8_BAD_DIGEST',repeat('0',64),repeat('2',64),'QA_WORKER_AAAA',60)<>0 THEN
   RAISE EXCEPTION 'tampered request digest should be denied';
 END IF;
 IF h8_lease_qa.reserve_once('QA_H8_BAD_DIGEST',repeat('b',64),repeat('0',64),'QA_WORKER_AAAA',60)<>0 THEN
   RAISE EXCEPTION 'tampered nonce should be denied';
 END IF;
 IF h8_lease_qa.reserve_once('QA_H8_BAD_DIGEST',repeat('b',64),repeat('2',64),'bad-worker',60)<>0 THEN
   RAISE EXCEPTION 'untrusted worker should be denied';
 END IF;
 IF h8_lease_qa.reserve_once('QA_H8_BAD_DIGEST',repeat('b',64),repeat('2',64),'QA_WORKER_AAAA',61)<>0 THEN
   RAISE EXCEPTION 'overlong lease should be denied';
 END IF;
 f=h8_lease_qa.reserve_once('QA_H8_ONCE',repeat('a',64),repeat('1',64),'QA_WORKER_AAAA',30);
 IF f<>1 THEN RAISE EXCEPTION 'initial lease must fence as 1'; END IF;
 IF h8_lease_qa.reserve_once('QA_H8_ONCE',repeat('a',64),repeat('1',64),'QA_WORKER_BBBB',30)<>0 THEN
   RAISE EXCEPTION 'leased request cannot be claimed again';
 END IF;
 IF h8_lease_qa.renew_lease('QA_H8_ONCE','QA_WORKER_BBBB',f,30) THEN
   RAISE EXCEPTION 'wrong worker cannot renew';
 END IF;
 IF h8_lease_qa.renew_lease('QA_H8_ONCE','QA_WORKER_AAAA',f+1,30) THEN
   RAISE EXCEPTION 'wrong fence cannot renew';
 END IF;
 IF NOT h8_lease_qa.renew_lease('QA_H8_ONCE','QA_WORKER_AAAA',f,30) THEN
   RAISE EXCEPTION 'matching worker/fence should renew';
 END IF;
 IF h8_lease_qa.finish_once('QA_H8_ONCE','QA_WORKER_BBBB',f,repeat('e',64)) THEN
   RAISE EXCEPTION 'wrong worker cannot finish';
 END IF;
 IF h8_lease_qa.finish_once('QA_H8_ONCE','QA_WORKER_AAAA',f+1,repeat('e',64)) THEN
   RAISE EXCEPTION 'wrong fence cannot finish';
 END IF;
 IF h8_lease_qa.finish_once('QA_H8_ONCE','QA_WORKER_AAAA',f,'INVALID') THEN
   RAISE EXCEPTION 'invalid artifact digest cannot finish';
 END IF;
 IF NOT h8_lease_qa.finish_once('QA_H8_ONCE','QA_WORKER_AAAA',f,repeat('e',64)) THEN
   RAISE EXCEPTION 'first valid finish must succeed';
 END IF;
 IF h8_lease_qa.finish_once('QA_H8_ONCE','QA_WORKER_AAAA',f,repeat('e',64)) THEN
   RAISE EXCEPTION 'duplicate finish must fail';
 END IF;
 IF h8_lease_qa.reserve_once('QA_H8_ONCE',repeat('a',64),repeat('1',64),'QA_WORKER_BBBB',30)<>0 THEN
   RAISE EXCEPTION 'succeeded approval cannot be leased again';
 END IF;
 f=h8_lease_qa.reserve_once('QA_H8_REVOKE',repeat('d',64),repeat('4',64),'QA_WORKER_AAAA',30);
 IF f<>1 THEN RAISE EXCEPTION 'revoke fixture lease missing'; END IF;
 IF NOT h8_lease_qa.revoke_once('QA_H8_REVOKE',repeat('d',64)) THEN
   RAISE EXCEPTION 'revocation failed';
 END IF;
 IF h8_lease_qa.finish_once('QA_H8_REVOKE','QA_WORKER_AAAA',f,repeat('e',64)) THEN
   RAISE EXCEPTION 'revoked lease completed';
 END IF;
 IF h8_lease_qa.reserve_once('QA_H8_REVOKE',repeat('d',64),repeat('4',64),'QA_WORKER_AAAA',30)<>0 THEN
   RAISE EXCEPTION 'revoked request reclaimed';
 END IF;
 f=h8_lease_qa.reserve_once('QA_H8_STALE',repeat('e',64),repeat('5',64),'QA_WORKER_AAAA',30);
 IF f<>1 THEN RAISE EXCEPTION 'stale fixture lease missing'; END IF;
 UPDATE h8_lease_qa.approvals SET lease_deadline=clock_timestamp()-interval '1 second'
 WHERE receipt_ref='QA_H8_STALE';
 IF h8_lease_qa.quarantine_stale()<>1 THEN
   RAISE EXCEPTION 'stale lease not quarantined';
 END IF;
 IF (SELECT state FROM h8_lease_qa.approvals WHERE receipt_ref='QA_H8_STALE')<>'needs_review' THEN
   RAISE EXCEPTION 'timed out lease not needs_review';
 END IF;
 IF h8_lease_qa.reserve_once('QA_H8_STALE',repeat('e',64),repeat('5',64),'QA_WORKER_BBBB',30)<>0 THEN
   RAISE EXCEPTION 'automatic retry after crash must NOT occur';
 END IF;
 IF h8_lease_qa.finish_once('QA_H8_STALE','QA_WORKER_AAAA',f,repeat('e',64)) THEN
   RAISE EXCEPTION 'stale worker must NOT finish';
 END IF;
 IF h8_lease_qa.revoke_once('QA_H8_ONCE',repeat('a',64)) THEN
   RAISE EXCEPTION 'succeeded record cannot be revoked into a new state';
 END IF;
END
$tests$;
SELECT 'PASS: H8 disposable lease, renewal, revoke, crash quarantine, fencing, no automatic retry' AS status;
