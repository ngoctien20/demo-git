\set ON_ERROR_STOP on
-- TIEN404 V15.0-03H.10 — EPHEMERAL PostgreSQL 17 ONLY.
-- Source-only metadata; NEVER use against a Supabase or shared database.
DO $guard$
BEGIN
 IF current_database() <> 'tien404_h10_ephemeral' THEN
   RAISE EXCEPTION 'H10 refuses non-ephemeral DB %',current_database();
 END IF;
END
$guard$;

CREATE SCHEMA h10_mock_storage;
REVOKE ALL ON SCHEMA h10_mock_storage FROM PUBLIC;

-- Synthetic approval ledger. This is NOT signed/authorized real human authority.
CREATE TABLE h10_mock_storage.approvals (
 operation_ref text PRIMARY KEY,
 project_ref text NOT NULL CHECK(project_ref='QA_EPHEMERAL_ONLY'),
 request_digest text NOT NULL CHECK(request_digest ~ '^[0-9a-f]{64}$'),
 nonce_digest text NOT NULL UNIQUE CHECK(nonce_digest ~ '^[0-9a-f]{64}$'),
 expected_object_key text NOT NULL UNIQUE,
 worker_ref text NOT NULL,
 fence bigint NOT NULL CHECK(fence>0),
 state text NOT NULL CHECK(state IN ('leased','needs_review','revoked','completed')),
 lease_expires_at timestamptz NOT NULL,
 authorization_expires_at timestamptz NOT NULL
);
ALTER TABLE h10_mock_storage.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE h10_mock_storage.approvals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON h10_mock_storage.approvals FROM PUBLIC;

-- Stand-in for the *metadata* of an external object: no object bytes, no upload.
-- Keys and operation IDs are both unique. Conditional insert acts as a
-- durable object-store compare-and-create *within this disposable database*.
CREATE TABLE h10_mock_storage.objects (
 object_key text PRIMARY KEY,
 operation_ref text NOT NULL UNIQUE REFERENCES h10_mock_storage.approvals(operation_ref),
 project_ref text NOT NULL CHECK(project_ref='QA_EPHEMERAL_ONLY'),
 request_digest text NOT NULL,
 nonce_digest text NOT NULL,
 worker_ref text NOT NULL,
 fence bigint NOT NULL,
 payload_digest text NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 declared_bytes integer NOT NULL CHECK(declared_bytes BETWEEN 1 AND 1000000),
 state text NOT NULL CHECK(state IN ('provisional','sealed')),
 manifest_digest text CHECK(manifest_digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 sealed_at timestamptz,
 CHECK ((state='provisional' AND manifest_digest IS NULL AND sealed_at IS NULL)
     OR (state='sealed' AND manifest_digest IS NOT NULL AND sealed_at IS NOT NULL))
);
ALTER TABLE h10_mock_storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE h10_mock_storage.objects FORCE ROW LEVEL SECURITY;
REVOKE ALL ON h10_mock_storage.objects FROM PUBLIC;

-- Simulated conditional CREATE. Locks ledger row before admitting new object
-- so simultaneous claims and revocations serialize at the local DB boundary.
CREATE FUNCTION h10_mock_storage.conditional_put(
 p_op text,p_key text,p_request_digest text,p_nonce text,
 p_worker text,p_fence bigint,p_payload_digest text,p_bytes integer
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,h10_mock_storage
AS $fn$
DECLARE a h10_mock_storage.approvals%ROWTYPE;
        o h10_mock_storage.objects%ROWTYPE;
        inserted_key text;
BEGIN
 SELECT * INTO a FROM h10_mock_storage.approvals
   WHERE operation_ref=p_op FOR UPDATE;
 IF NOT FOUND OR a.project_ref<>'QA_EPHEMERAL_ONLY' OR a.state<>'leased'
    OR a.expected_object_key IS DISTINCT FROM p_key
    OR a.request_digest IS DISTINCT FROM p_request_digest
    OR a.nonce_digest IS DISTINCT FROM p_nonce
    OR a.worker_ref IS DISTINCT FROM p_worker
    OR a.fence IS DISTINCT FROM p_fence
    OR a.lease_expires_at<=clock_timestamp()
    OR a.authorization_expires_at<=clock_timestamp()
    OR p_payload_digest !~ '^[0-9a-f]{64}$'
    OR p_bytes NOT BETWEEN 1 AND 1000000
 THEN RETURN 'DENIED'; END IF;
 INSERT INTO h10_mock_storage.objects
 (object_key,operation_ref,project_ref,request_digest,nonce_digest,
  worker_ref,fence,payload_digest,declared_bytes,state)
 VALUES(p_key,p_op,'QA_EPHEMERAL_ONLY',p_request_digest,p_nonce,
        p_worker,p_fence,p_payload_digest,p_bytes,'provisional')
 ON CONFLICT DO NOTHING
 RETURNING object_key INTO inserted_key;
 IF inserted_key IS NOT NULL THEN RETURN 'CREATED_MOCK_ONLY'; END IF;
 SELECT * INTO o FROM h10_mock_storage.objects
    WHERE object_key=p_key OR operation_ref=p_op;
 IF FOUND AND o.object_key=p_key AND o.operation_ref=p_op
    AND o.request_digest=p_request_digest AND o.nonce_digest=p_nonce
    AND o.worker_ref=p_worker AND o.fence=p_fence
    AND o.payload_digest=p_payload_digest AND o.declared_bytes=p_bytes
 THEN
   RETURN CASE WHEN o.state='sealed' THEN 'SEALED_NO_WRITE'
               ELSE 'EXISTS_IDENTICAL_NO_WRITE' END;
 END IF;
 UPDATE h10_mock_storage.approvals SET state='needs_review'
 WHERE operation_ref=p_op AND state='leased';
 RETURN 'CONFLICT_NEEDS_REVIEW';
END
$fn$;
REVOKE ALL ON FUNCTION h10_mock_storage.conditional_put(text,text,text,text,text,bigint,text,integer) FROM PUBLIC;

CREATE FUNCTION h10_mock_storage.seal_once(
 p_op text,p_worker text,p_fence bigint,p_manifest_digest text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,h10_mock_storage
AS $fn$
DECLARE a h10_mock_storage.approvals%ROWTYPE;
        changed_key text;
BEGIN
 SELECT * INTO a FROM h10_mock_storage.approvals
  WHERE operation_ref=p_op FOR UPDATE;
 IF NOT FOUND OR a.state<>'leased'
    OR a.worker_ref IS DISTINCT FROM p_worker OR a.fence IS DISTINCT FROM p_fence
    OR a.lease_expires_at<=clock_timestamp()
    OR a.authorization_expires_at<=clock_timestamp()
    OR p_manifest_digest !~ '^[a-f0-9]{64}$'
 THEN RETURN 'DENIED'; END IF;
 UPDATE h10_mock_storage.objects
 SET state='sealed',manifest_digest=p_manifest_digest,sealed_at=clock_timestamp()
 WHERE operation_ref=p_op AND object_key=a.expected_object_key
   AND worker_ref=p_worker AND fence=p_fence AND state='provisional'
 RETURNING object_key INTO changed_key;
 IF changed_key IS NULL THEN RETURN 'DENIED'; END IF;
 UPDATE h10_mock_storage.approvals
 SET state='completed' WHERE operation_ref=p_op AND state='leased';
 RETURN 'SEALED_MOCK_METADATA_NOT_BACKUP';
END
$fn$;
REVOKE ALL ON FUNCTION h10_mock_storage.seal_once(text,text,bigint,text) FROM PUBLIC;

CREATE FUNCTION h10_mock_storage.mark_uncertain()
RETURNS integer LANGUAGE sql SECURITY INVOKER
SET search_path=pg_catalog,h10_mock_storage
AS $fn$
 WITH uncertain AS (
  UPDATE h10_mock_storage.approvals SET state='needs_review'
  WHERE state='leased' AND
   (lease_expires_at<=clock_timestamp() OR authorization_expires_at<=clock_timestamp())
  RETURNING 1
 )
 SELECT count(*)::integer FROM uncertain;
$fn$;
REVOKE ALL ON FUNCTION h10_mock_storage.mark_uncertain() FROM PUBLIC;

CREATE FUNCTION h10_mock_storage.revoke_one(p_op text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER
SET search_path=pg_catalog,h10_mock_storage
AS $fn$
 WITH revoked AS (
  UPDATE h10_mock_storage.approvals SET state='revoked'
  WHERE operation_ref=p_op AND state IN ('leased','needs_review')
  RETURNING 1
 )
 SELECT EXISTS(SELECT 1 FROM revoked);
$fn$;
REVOKE ALL ON FUNCTION h10_mock_storage.revoke_one(text) FROM PUBLIC;

INSERT INTO h10_mock_storage.approvals
(operation_ref,project_ref,request_digest,nonce_digest,expected_object_key,
 worker_ref,fence,state,lease_expires_at,authorization_expires_at)
VALUES
('QA_H10_CONCURRENT','QA_EPHEMERAL_ONLY',repeat('1',64),repeat('a',64),'QA_H10_OBJECT_CONCURRENT','QA_WORKER_H10_A',1,'leased',now()+interval '5 minutes',now()+interval '10 minutes'),
('QA_H10_SEAL','QA_EPHEMERAL_ONLY',repeat('2',64),repeat('b',64),'QA_H10_OBJECT_SEAL','QA_WORKER_H10_A',1,'leased',now()+interval '5 minutes',now()+interval '10 minutes'),
('QA_H10_CONFLICT','QA_EPHEMERAL_ONLY',repeat('3',64),repeat('c',64),'QA_H10_OBJECT_CONFLICT','QA_WORKER_H10_A',1,'leased',now()+interval '5 minutes',now()+interval '10 minutes'),
('QA_H10_CRASH','QA_EPHEMERAL_ONLY',repeat('4',64),repeat('d',64),'QA_H10_OBJECT_CRASH','QA_WORKER_H10_A',1,'leased',now()+interval '5 minutes',now()+interval '10 minutes'),
('QA_H10_REVOKED','QA_EPHEMERAL_ONLY',repeat('5',64),repeat('e',64),'QA_H10_OBJECT_REVOKED','QA_WORKER_H10_A',1,'revoked',now()+interval '5 minutes',now()+interval '10 minutes'),
('QA_H10_EXPIRED','QA_EPHEMERAL_ONLY',repeat('6',64),repeat('f',64),'QA_H10_OBJECT_EXPIRED','QA_WORKER_H10_A',1,'leased',now()-interval '1 minute',now()+interval '10 minutes');

DO $tests$
BEGIN
 IF h10_mock_storage.conditional_put('QA_H10_SEAL','QA_H10_OBJECT_SEAL',
    repeat('2',64),repeat('b',64),'QA_WORKER_H10_A',1,repeat('7',64),1024)
    <> 'CREATED_MOCK_ONLY' THEN
   RAISE EXCEPTION 'first simulated conditional PUT must create metadata';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_SEAL','QA_H10_OBJECT_SEAL',
    repeat('2',64),repeat('b',64),'QA_WORKER_H10_A',1,repeat('7',64),1024)
    <> 'EXISTS_IDENTICAL_NO_WRITE' THEN
   RAISE EXCEPTION 'identical replay must not write';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_SEAL','QA_H10_OBJECT_SEAL',
    repeat('0',64),repeat('b',64),'QA_WORKER_H10_A',1,repeat('7',64),1024)
    <> 'DENIED' THEN
   RAISE EXCEPTION 'wrong signed digest admitted';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_SEAL','QA_H10_OBJECT_SEAL',
    repeat('2',64),repeat('b',64),'QA_WORKER_H10_OTHER',1,repeat('7',64),1024)
    <> 'DENIED' THEN
   RAISE EXCEPTION 'worker substitution admitted';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_SEAL','QA_H10_OBJECT_SEAL',
    repeat('2',64),repeat('b',64),'QA_WORKER_H10_A',2,repeat('7',64),1024)
    <> 'DENIED' THEN
   RAISE EXCEPTION 'stale or spoofed fence admitted';
 END IF;
 IF h10_mock_storage.seal_once('QA_H10_SEAL','QA_WORKER_H10_OTHER',1,repeat('9',64))<>'DENIED' THEN
   RAISE EXCEPTION 'wrong worker sealed metadata';
 END IF;
 IF h10_mock_storage.seal_once('QA_H10_SEAL','QA_WORKER_H10_A',1,repeat('9',64))
    <> 'SEALED_MOCK_METADATA_NOT_BACKUP' THEN
   RAISE EXCEPTION 'valid synthetic seal failed';
 END IF;
 IF h10_mock_storage.seal_once('QA_H10_SEAL','QA_WORKER_H10_A',1,repeat('9',64))
    <> 'DENIED' THEN
   RAISE EXCEPTION 'duplicate mock seal admitted';
 END IF;
 IF (SELECT state FROM h10_mock_storage.objects WHERE operation_ref='QA_H10_SEAL')<>'sealed' THEN
   RAISE EXCEPTION 'lost ACK must see persistent sealed receipt';
 END IF;
 IF (SELECT manifest_digest FROM h10_mock_storage.objects WHERE operation_ref='QA_H10_SEAL')
     <> repeat('9',64) THEN
   RAISE EXCEPTION 'mock sealed manifest changed';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_SEAL','QA_H10_OBJECT_SEAL',
    repeat('2',64),repeat('b',64),'QA_WORKER_H10_A',1,repeat('7',64),1024)
    <> 'DENIED' THEN
   RAISE EXCEPTION 'completed approval cannot re-write';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_REVOKED','QA_H10_OBJECT_REVOKED',
    repeat('5',64),repeat('e',64),'QA_WORKER_H10_A',1,repeat('7',64),1024)
    <> 'DENIED' THEN
   RAISE EXCEPTION 'revoked approval admitted';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_EXPIRED','QA_H10_OBJECT_EXPIRED',
    repeat('6',64),repeat('f',64),'QA_WORKER_H10_A',1,repeat('7',64),1024)
    <> 'DENIED' THEN
   RAISE EXCEPTION 'expired approval admitted';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_CONFLICT','QA_H10_OBJECT_CONFLICT',
    repeat('3',64),repeat('c',64),'QA_WORKER_H10_A',1,repeat('7',64),1024)
    <> 'CREATED_MOCK_ONLY' THEN
   RAISE EXCEPTION 'conflict fixture create failed';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_CONFLICT','QA_H10_OBJECT_CONFLICT',
    repeat('3',64),repeat('c',64),'QA_WORKER_H10_A',1,repeat('8',64),1024)
    <> 'CONFLICT_NEEDS_REVIEW' THEN
   RAISE EXCEPTION 'changed metadata did not trigger review';
 END IF;
 IF (SELECT state FROM h10_mock_storage.approvals WHERE operation_ref='QA_H10_CONFLICT')
     <> 'needs_review' THEN
   RAISE EXCEPTION 'conflicted lease was not quarantined';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_CONFLICT','QA_H10_OBJECT_CONFLICT',
    repeat('3',64),repeat('c',64),'QA_WORKER_H10_A',1,repeat('7',64),1024)
    <> 'DENIED' THEN
   RAISE EXCEPTION 'quarantined conflict got automatic retry';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_CRASH','QA_H10_OBJECT_CRASH',
    repeat('4',64),repeat('d',64),'QA_WORKER_H10_A',1,repeat('7',64),1024)
    <> 'CREATED_MOCK_ONLY' THEN
   RAISE EXCEPTION 'crash metadata provisional create failed';
 END IF;
 UPDATE h10_mock_storage.approvals SET lease_expires_at=clock_timestamp()-interval '1 second'
 WHERE operation_ref='QA_H10_CRASH';
 IF h10_mock_storage.mark_uncertain() <> 2 THEN
   RAISE EXCEPTION 'expected 2 expired leases (crash and expired fixture)';
 END IF;
 IF (SELECT state FROM h10_mock_storage.approvals WHERE operation_ref='QA_H10_CRASH')
     <> 'needs_review' THEN
   RAISE EXCEPTION 'crashed approval not quarantined';
 END IF;
 IF h10_mock_storage.conditional_put('QA_H10_CRASH','QA_H10_OBJECT_CRASH',
    repeat('4',64),repeat('d',64),'QA_WORKER_H10_A',1,repeat('7',64),1024)
    <> 'DENIED' THEN
   RAISE EXCEPTION 'crashed approval was retried';
 END IF;
 IF h10_mock_storage.seal_once('QA_H10_CRASH','QA_WORKER_H10_A',1,repeat('9',64))
    <> 'DENIED' THEN
   RAISE EXCEPTION 'stale worker sealed after crash';
 END IF;
 IF NOT h10_mock_storage.revoke_one('QA_H10_CRASH') THEN
   RAISE EXCEPTION 'manual revocation after crash failed';
 END IF;
 IF h10_mock_storage.revoke_one('QA_H10_SEAL') THEN
   RAISE EXCEPTION 'completed sealed receipt should be immutable';
 END IF;
END
$tests$;

SELECT 'PASS: durable fake object receipt, replay, seal, lost ACK, conflicts, crash & revoke' AS h10_status;
