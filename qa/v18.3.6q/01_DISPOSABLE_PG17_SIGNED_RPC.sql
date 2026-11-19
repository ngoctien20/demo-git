\set ON_ERROR_STOP on
\echo V18_3_6Q_SYNTHETIC_RPC_SCHEMA_START
DO $guard$
BEGIN
  IF current_database()<>'tien404_v1836m_disposable' OR
     current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  THEN RAISE EXCEPTION 'Q_REQUIRES_DISPOSABLE_PG17_DB'; END IF;
  IF to_regclass('qa_m_auth.sessions') IS NULL OR
     to_regclass('qa_m_private.nonce_ledger') IS NULL
  THEN RAISE EXCEPTION 'Q_REQUIRES_ISOLATED_M_FIXTURE'; END IF;
END $guard$;

CREATE ROLE tien404_q_rpc_caller NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE tien404_q_untrusted NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA qa_q_private AUTHORIZATION tien404_m_owner;
REVOKE ALL ON SCHEMA qa_q_private FROM PUBLIC;
GRANT USAGE ON SCHEMA qa_q_private TO tien404_q_rpc_caller;

-- PUBLIC/COMMITTED FIXTURE KEY: 32 bytes of ASCII 'Q', NOT A SECRET.
-- This is NOT KMS and cannot be approved for production.
CREATE TABLE qa_q_private.fixture_signer(
  kid text PRIMARY KEY,
  fixture_hmac_key bytea NOT NULL,
  environment text NOT NULL CHECK(environment='DISPOSABLE_ONLY')
);
ALTER TABLE qa_q_private.fixture_signer OWNER TO tien404_m_owner;
ALTER TABLE qa_q_private.fixture_signer ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_q_private.fixture_signer FROM PUBLIC;
INSERT INTO qa_q_private.fixture_signer(kid,fixture_hmac_key,environment)
VALUES('qa-fixture-v1',decode(repeat('51',32),'hex'),'DISPOSABLE_ONLY');

-- Strict versioned canonical input must byte-match rpc-proof-fixture.mjs.
-- SECURITY DEFINER owner intentionally holds underlying M fixture table
-- privileges. This is a proof-of-risk test; NOT production-safe by itself.
CREATE FUNCTION qa_q_private.signed_catalog_read(
 p_session_id uuid,p_user_id uuid,p_tenant_id uuid,p_store_id uuid,
 p_membership_revision integer,p_item_id uuid,p_jti uuid,
 p_exp_epoch bigint,p_mac_hex text)
RETURNS TABLE(decision text,item_code text,price_vnd bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE v_key bytea;v_serial text;v_expected_mac text;v_current_epoch bigint;
BEGIN
 decision:='DENY';item_code:=NULL;price_vnd:=NULL;
 IF p_session_id IS NULL OR p_user_id IS NULL OR p_tenant_id IS NULL OR
    p_store_id IS NULL OR p_item_id IS NULL OR p_jti IS NULL OR
    p_membership_revision IS NULL OR p_membership_revision<1 OR
    p_exp_epoch IS NULL
 THEN decision:='DENY_INPUT';RETURN NEXT;RETURN;END IF;
 v_current_epoch:=floor(extract(epoch FROM clock_timestamp()))::bigint;
 IF p_exp_epoch<=v_current_epoch OR p_exp_epoch>v_current_epoch+120
 THEN decision:='DENY_EXPIRY';RETURN NEXT;RETURN;END IF;
 IF p_mac_hex IS NULL OR p_mac_hex !~ '^[0-9a-f]{64}$'
 THEN decision:='DENY_MAC';RETURN NEXT;RETURN;END IF;

 SELECT k.fixture_hmac_key INTO v_key
 FROM qa_q_private.fixture_signer k
 WHERE k.kid='qa-fixture-v1' AND k.environment='DISPOSABLE_ONLY';
 IF NOT FOUND THEN decision:='DENY_SIGNER';RETURN NEXT;RETURN;END IF;

 v_serial:=array_to_string(ARRAY[
 'Q1','tien404-qa-issuer','tien404-qa-catalog','qa-fixture-v1',
 p_session_id::text,p_user_id::text,p_tenant_id::text,p_store_id::text,
 p_membership_revision::text,p_item_id::text,'CATALOG_READ',p_jti::text,
 p_exp_epoch::text],E'\n');
 v_expected_mac:=encode(public.hmac(convert_to(v_serial,'UTF8'),v_key,'sha256'),'hex');
 -- Byte equality is an offline interoperability check, NOT an audited
 -- constant-time crypto verifier for production.
 IF v_expected_mac IS DISTINCT FROM p_mac_hex
 THEN decision:='DENY_MAC';RETURN NEXT;RETURN;END IF;
 RETURN QUERY SELECT core.decision,core.item_code,core.price_vnd
 FROM qa_m_private.catalog_read_if_session_exists(
  'tien404-synthetic-authority','tien404-synthetic-catalog-read',
  p_jti,p_session_id,p_user_id,p_tenant_id,p_store_id,
  p_membership_revision,p_item_id,'CATALOG_READ',to_timestamp(p_exp_epoch)
 ) core;
 RETURN;
END $body$;

ALTER FUNCTION qa_q_private.signed_catalog_read(
 uuid,uuid,uuid,uuid,integer,uuid,uuid,bigint,text) OWNER TO tien404_m_owner;
REVOKE ALL ON FUNCTION qa_q_private.signed_catalog_read(
 uuid,uuid,uuid,uuid,integer,uuid,uuid,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_q_private.signed_catalog_read(
 uuid,uuid,uuid,uuid,integer,uuid,uuid,bigint,text) TO tien404_q_rpc_caller;

-- No underlying M caller/table grants to the narrow Q caller.
REVOKE ALL ON qa_q_private.fixture_signer FROM tien404_q_rpc_caller,tien404_q_untrusted;
\echo V18_3_6Q_SYNTHETIC_RPC_SCHEMA_READY
