-- RPC14 disposable PostgreSQL 17 replay protocol only: NEVER run on Supabase hosted.
-- It intentionally uses synthetic identities; it does NOT authenticate users or JWT.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'t404_rpc14_ci' OR current_user<>'postgres' OR
 current_setting('tien404.rpc14_ephemeral',true)<>'RPC14_DISPOSABLE' OR
 current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'RPC14_REFUSES_HOSTED_OR_NON_EPHEMERAL_DATABASE'; END IF;
END $guard$;
CREATE SCHEMA qa_rpc14;
REVOKE ALL ON SCHEMA qa_rpc14 FROM PUBLIC;
CREATE ROLE qa_rpc14_ingest NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEROLE NOCREATEDB;
GRANT USAGE ON SCHEMA qa_rpc14 TO qa_rpc14_ingest;
CREATE TABLE qa_rpc14.invite_ledger (
  invite_id uuid PRIMARY KEY,
  auth_user_id uuid NOT NULL,
  access_subject_hash text NOT NULL CHECK(access_subject_hash~'^[a-f0-9]{64}$'),
  slot text NOT NULL CHECK (slot IN ('P1','P2','O1','O2')),
  source_type text NOT NULL CHECK (source_type IN ('MERCHANT_ORIGINAL_ONBOARDING','MERCHANT_ORIGINAL_CATALOG','SIGNED_EXTERNAL_ORDER_SOURCE','VERIFIED_MERCHANT_EXPORT')),
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'ISSUED' CHECK(state IN ('ISSUED','RESERVED','PENDING_MALWARE_SCAN','FAILED')),
  receipt_id uuid UNIQUE,
  sha256 text CHECK(sha256 IS NULL OR sha256~'^[a-f0-9]{64}$'),
  bytes integer CHECK(bytes IS NULL OR bytes BETWEEN 16 AND 8388608),
  reserved_at timestamptz
);
ALTER TABLE qa_rpc14.invite_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc14.invite_ledger FORCE ROW LEVEL SECURITY;
REVOKE ALL ON qa_rpc14.invite_ledger FROM PUBLIC;
-- No direct SELECT, INSERT, UPDATE or DELETE on the ledger for the low-privilege runner.
-- The following functions are a tightly bounded synthetic service protocol.
CREATE FUNCTION qa_rpc14.reserve_once(
 p_invite uuid, p_user uuid, p_access_hash text, p_slot text, p_type text, p_receipt uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
 IF p_invite IS NULL OR p_user IS NULL OR p_receipt IS NULL OR p_slot IS NULL OR p_type IS NULL OR
   p_access_hash IS NULL OR p_access_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
 UPDATE qa_rpc14.invite_ledger SET state='RESERVED',receipt_id=p_receipt,reserved_at=clock_timestamp()
 WHERE invite_id=p_invite AND auth_user_id=p_user AND access_subject_hash=p_access_hash
 AND slot=p_slot AND source_type=p_type AND expires_at>clock_timestamp()
 AND state='ISSUED' AND receipt_id IS NULL;
 RETURN FOUND;
END $fn$;
CREATE FUNCTION qa_rpc14.finalize_quarantine(p_receipt uuid,p_sha text,p_bytes integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
 IF p_receipt IS NULL OR p_sha IS NULL OR p_sha !~ '^[a-f0-9]{64}$' OR
 p_bytes IS NULL OR p_bytes NOT BETWEEN 16 AND 8388608 THEN RETURN false; END IF;
 UPDATE qa_rpc14.invite_ledger SET state='PENDING_MALWARE_SCAN',sha256=p_sha,bytes=p_bytes
 WHERE receipt_id=p_receipt AND state='RESERVED';
 RETURN FOUND;
END $fn$;
CREATE FUNCTION qa_rpc14.fail_quarantine(p_receipt uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
 IF p_receipt IS NULL THEN RETURN false; END IF;
 UPDATE qa_rpc14.invite_ledger SET state='FAILED' WHERE receipt_id=p_receipt AND state='RESERVED';
 RETURN FOUND;
END $fn$;
REVOKE ALL ON FUNCTION qa_rpc14.reserve_once(uuid,uuid,text,text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION qa_rpc14.finalize_quarantine(uuid,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION qa_rpc14.fail_quarantine(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_rpc14.reserve_once(uuid,uuid,text,text,text,uuid) TO qa_rpc14_ingest;
GRANT EXECUTE ON FUNCTION qa_rpc14.finalize_quarantine(uuid,text,integer) TO qa_rpc14_ingest;
GRANT EXECUTE ON FUNCTION qa_rpc14.fail_quarantine(uuid) TO qa_rpc14_ingest;
INSERT INTO qa_rpc14.invite_ledger(invite_id,auth_user_id,access_subject_hash,slot,source_type,expires_at) VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001',repeat('a',64),'P1','MERCHANT_ORIGINAL_CATALOG',now()+interval '1 hour'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-0000-4000-8000-000000000002',repeat('b',64),'O1','SIGNED_EXTERNAL_ORDER_SOURCE',now()+interval '1 hour'),
('33333333-3333-4333-8333-333333333333','aaaaaaaa-0000-4000-8000-000000000001',repeat('a',64),'P2','MERCHANT_ORIGINAL_CATALOG',now()-interval '1 hour'),
('44444444-4444-4444-8444-444444444444','aaaaaaaa-0000-4000-8000-000000000001',repeat('a',64),'O2','VERIFIED_MERCHANT_EXPORT',now()+interval '1 hour');