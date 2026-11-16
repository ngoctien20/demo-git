\set ON_ERROR_STOP on
-- V15.0-03H.7 DISPOSABLE PostgreSQL 17 ONLY.
-- This file must NEVER be applied to Supabase or an existing database.
DO $guard$
BEGIN
  IF current_database() <> 'tien404_h7_ephemeral' THEN
    RAISE EXCEPTION 'H7 EPHEMERAL-ONLY fixture refuses this database';
  END IF;
END
$guard$;

CREATE SCHEMA h7_private_qa;
REVOKE ALL ON SCHEMA h7_private_qa FROM PUBLIC;
-- Real signer enrollment and signature verification DO NOT happen in SQL.
-- This is a *synthetic* transaction/uniqueness rehearsal, not authorization.
CREATE TABLE h7_private_qa.signer_index (
  signer_ref text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('project_data_controller','security','backup_operator')),
  project_ref text NOT NULL CHECK (project_ref='QA_EPHEMERAL_ONLY'),
  key_fingerprint text CHECK (key_fingerprint ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('active','revoked')),
  expires_at timestamptz NOT NULL,
  CONSTRAINT operator_has_no_signing_fingerprint
    CHECK ((role='backup_operator' AND key_fingerprint IS NULL)
       OR (role<>'backup_operator' AND key_fingerprint IS NOT NULL))
);
ALTER TABLE h7_private_qa.signer_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE h7_private_qa.signer_index FORCE ROW LEVEL SECURITY;

CREATE TABLE h7_private_qa.approval_claims (
  request_ref text PRIMARY KEY,
  project_ref text NOT NULL CHECK (project_ref='QA_EPHEMERAL_ONLY'),
  operation text NOT NULL CHECK (operation='SIMULATE_ONE_TIME_APPROVAL_CONSUMPTION'),
  request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  nonce_digest text NOT NULL UNIQUE CHECK (nonce_digest ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'ready'
    CHECK (state IN ('ready','revoked','consumed')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT consumed_time_is_consistent CHECK (
    (state='consumed' AND consumed_at IS NOT NULL)
    OR (state IN ('ready','revoked') AND consumed_at IS NULL)
  )
);
ALTER TABLE h7_private_qa.approval_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE h7_private_qa.approval_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA h7_private_qa FROM PUBLIC;

-- Atomic UPDATE is the single-consume linearization point.
-- Repeated or simultaneous requests can never both return TRUE.
-- SECURITY INVOKER + no PUBLIC EXECUTE; called only by ephemeral CI owner.
CREATE FUNCTION h7_private_qa.consume_once(
  p_request_ref text, p_request_digest text, p_nonce_digest text
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, h7_private_qa
AS $fn$
  WITH used AS (
    UPDATE h7_private_qa.approval_claims c
       SET state='consumed', consumed_at=clock_timestamp()
     WHERE c.request_ref=p_request_ref
       AND c.request_digest=p_request_digest
       AND c.nonce_digest=p_nonce_digest
       AND c.project_ref='QA_EPHEMERAL_ONLY'
       AND c.operation='SIMULATE_ONE_TIME_APPROVAL_CONSUMPTION'
       AND c.state='ready'
       AND c.expires_at>clock_timestamp()
    RETURNING 1
  )
  SELECT EXISTS(SELECT 1 FROM used);
$fn$;
REVOKE ALL ON FUNCTION h7_private_qa.consume_once(text,text,text) FROM PUBLIC;

INSERT INTO h7_private_qa.signer_index
  (signer_ref,role,project_ref,key_fingerprint,state,expires_at)
VALUES
 ('QA_H7_CONTROLLER','project_data_controller','QA_EPHEMERAL_ONLY',repeat('a',64),'active',now()+interval '1 day'),
 ('QA_H7_SECURITY','security','QA_EPHEMERAL_ONLY',repeat('b',64),'active',now()+interval '1 day'),
 ('QA_H7_OPERATOR','backup_operator','QA_EPHEMERAL_ONLY',NULL,'active',now()+interval '1 day');

INSERT INTO h7_private_qa.approval_claims
  (request_ref,project_ref,operation,request_digest,nonce_digest,state,expires_at)
VALUES
 ('QA_H7_ONCE','QA_EPHEMERAL_ONLY','SIMULATE_ONE_TIME_APPROVAL_CONSUMPTION',repeat('a',64),repeat('1',64),'ready',now()+interval '1 hour'),
 ('QA_H7_EXPIRED','QA_EPHEMERAL_ONLY','SIMULATE_ONE_TIME_APPROVAL_CONSUMPTION',repeat('b',64),repeat('2',64),'ready',now()-interval '1 second'),
 ('QA_H7_REVOKED','QA_EPHEMERAL_ONLY','SIMULATE_ONE_TIME_APPROVAL_CONSUMPTION',repeat('c',64),repeat('3',64),'revoked',now()+interval '1 hour'),
 ('QA_H7_CONCURRENT','QA_EPHEMERAL_ONLY','SIMULATE_ONE_TIME_APPROVAL_CONSUMPTION',repeat('d',64),repeat('4',64),'ready',now()+interval '1 hour'),
 ('QA_H7_BAD_DIGEST','QA_EPHEMERAL_ONLY','SIMULATE_ONE_TIME_APPROVAL_CONSUMPTION',repeat('e',64),repeat('5',64),'ready',now()+interval '1 hour');

DO $tests$
BEGIN
 IF (SELECT count(*) FROM h7_private_qa.signer_index)<>3 THEN
   RAISE EXCEPTION 'signer registry fixture count mismatch';
 END IF;
 IF EXISTS(SELECT 1 FROM h7_private_qa.signer_index WHERE state<>'active') THEN
   RAISE EXCEPTION 'signer fixture state mismatch';
 END IF;
 IF NOT (SELECT h7_private_qa.consume_once('QA_H7_ONCE',repeat('a',64),repeat('1',64))) THEN
   RAISE EXCEPTION 'first valid synthetic consume must succeed';
 END IF;
 IF (SELECT h7_private_qa.consume_once('QA_H7_ONCE',repeat('a',64),repeat('1',64))) THEN
   RAISE EXCEPTION 'second synthetic consume must be denied';
 END IF;
 IF (SELECT h7_private_qa.consume_once('QA_H7_EXPIRED',repeat('b',64),repeat('2',64))) THEN
   RAISE EXCEPTION 'expired consume must be denied';
 END IF;
 IF (SELECT h7_private_qa.consume_once('QA_H7_REVOKED',repeat('c',64),repeat('3',64))) THEN
   RAISE EXCEPTION 'revoked consume must be denied';
 END IF;
 IF (SELECT h7_private_qa.consume_once('QA_H7_BAD_DIGEST',repeat('e',64),repeat('0',64))) THEN
   RAISE EXCEPTION 'wrong nonce must be denied';
 END IF;
 IF (SELECT h7_private_qa.consume_once('QA_H7_BAD_DIGEST',repeat('0',64),repeat('5',64))) THEN
   RAISE EXCEPTION 'wrong request digest must be denied';
 END IF;
 IF (SELECT state FROM h7_private_qa.approval_claims
    WHERE request_ref='QA_H7_BAD_DIGEST')<>'ready' THEN
   RAISE EXCEPTION 'invalid consume changed valid approval state';
 END IF;
 IF NOT (SELECT h7_private_qa.consume_once('QA_H7_BAD_DIGEST',repeat('e',64),repeat('5',64))) THEN
   RAISE EXCEPTION 'correct digest + nonce must succeed';
 END IF;
 IF (SELECT h7_private_qa.consume_once('QA_H7_BAD_DIGEST',repeat('e',64),repeat('5',64))) THEN
   RAISE EXCEPTION 'correct request replay must fail';
 END IF;
 BEGIN
   INSERT INTO h7_private_qa.approval_claims
     (request_ref,project_ref,operation,request_digest,nonce_digest,state,expires_at)
   VALUES ('QA_H7_DUP_NONCE','QA_EPHEMERAL_ONLY',
     'SIMULATE_ONE_TIME_APPROVAL_CONSUMPTION',repeat('f',64),repeat('1',64),'ready',now()+interval '1 hour');
   RAISE EXCEPTION 'unique nonce constraint did not reject duplicate';
 EXCEPTION WHEN unique_violation THEN
   NULL;
 END;
END
$tests$;

SELECT 'PASS: private synthetic registry; expired/revoked/digest/nonce replay denied' AS h7_status;
