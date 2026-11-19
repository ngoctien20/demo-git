\set ON_ERROR_STOP on
\echo V18_3_6K_SCHEMA_START
DO $guard$ BEGIN
 IF current_database()<>'tien404_v1836i_disposable' OR
    current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'K_REQUIRES_ISOLATED_PG17'; END IF;
END $guard$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE ROLE tien404_k_rpc NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE tien404_k_attacker NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA qa_k_private AUTHORIZATION tien404_i_owner;
REVOKE ALL ON SCHEMA qa_k_private FROM PUBLIC;
GRANT USAGE ON SCHEMA qa_k_private TO tien404_k_rpc;

-- Deliberately close predecessor entry points in the K disposable fixture.
-- This is NEVER applied to Supabase staging or the Published Commerce Core.
REVOKE EXECUTE ON FUNCTION qa_i_private.atomic_admit_verified_authority(
 text,text,uuid,text,text,text,text,text,text,text,timestamptz)
 FROM tien404_i_executor;
REVOKE EXECUTE ON FUNCTION qa_i_private.transaction_bound_catalog_read(
 text,text,uuid,text,text,text,text,text,text,text,timestamptz,uuid)
 FROM tien404_j_gateway;
-- Previous roles retain NOLOGIN and have no direct table permissions.

CREATE TABLE qa_k_private.fixture_signer_registry(
 kid text PRIMARY KEY,secret text NOT NULL,active boolean NOT NULL,
 revoked_at timestamptz,
 CHECK (length(secret)>=32),CHECK(kid ~ '^[a-z0-9-]{3,64}$')
);
ALTER TABLE qa_k_private.fixture_signer_registry OWNER TO tien404_i_owner;
ALTER TABLE qa_k_private.fixture_signer_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_k_private.fixture_signer_registry FROM PUBLIC,tien404_k_rpc,tien404_k_attacker;

-- Purely synthetic test fixture shared with ephemeral Node.js HMAC tests.
-- NEVER deploy this static key. Production would require independent key
-- custody/rotation, an isolated backend and an approved service trust path.
INSERT INTO qa_k_private.fixture_signer_registry VALUES (
  'qa-k-key-1',
  repeat('K',64),
  true,NULL
);

CREATE FUNCTION qa_k_private.signed_transaction_catalog_read(
 p_issuer text,p_audience text,p_jti uuid,p_tenant_hash text,
 p_store_hash text,p_subject_hash text,p_session_binding_hash text,
 p_membership_revision_hash text,p_authority_digest text,p_capability text,
 p_exp_epoch bigint,p_resource_id uuid,
 p_auth_checked_epoch bigint,p_auth_valid_until_epoch bigint,
 p_kid text,p_mac text
)
RETURNS TABLE(decision text,item_code text,price_vnd bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_secret text;v_message text;v_expected text;v_now bigint;v_result record;
BEGIN
  item_code:=NULL;price_vnd:=NULL;
  v_now:=floor(extract(epoch from clock_timestamp()))::bigint;
  IF p_issuer IS DISTINCT FROM 'tien404-private-authority-staging' OR
     p_audience IS DISTINCT FROM 'tien404-private-commerce-readonly' OR
     p_capability IS DISTINCT FROM 'CATALOG_READ'
  THEN decision:='DENY_AUTHORITY_SCOPE';RETURN NEXT;RETURN;END IF;
  IF p_jti IS NULL OR p_resource_id IS NULL OR p_kid IS NULL OR p_mac IS NULL OR
     p_tenant_hash IS NULL OR p_tenant_hash !~ '^[a-f0-9]{64}$' OR
     p_store_hash IS NULL OR p_store_hash !~ '^[a-f0-9]{64}$' OR
     p_subject_hash IS NULL OR p_subject_hash !~ '^[a-f0-9]{64}$' OR
     p_session_binding_hash IS NULL OR p_session_binding_hash !~ '^[a-f0-9]{64}$' OR
     p_membership_revision_hash IS NULL OR p_membership_revision_hash !~ '^[a-f0-9]{64}$' OR
     p_authority_digest IS NULL OR p_authority_digest !~ '^[a-f0-9]{64}$' OR
     p_mac !~ '^[a-f0-9]{64}$'
  THEN decision:='DENY_INPUT';RETURN NEXT;RETURN;END IF;
  IF p_exp_epoch IS NULL OR p_exp_epoch<=v_now OR p_exp_epoch>v_now+120 OR
     p_auth_checked_epoch IS NULL OR p_auth_checked_epoch>v_now OR
     p_auth_checked_epoch<v_now-2 OR
     p_auth_valid_until_epoch IS NULL OR
     p_auth_valid_until_epoch<v_now OR
     p_auth_valid_until_epoch>v_now+3
  THEN decision:='DENY_EXTERNAL_AUTH_PROOF_STALE';RETURN NEXT;RETURN;END IF;

  SELECT secret INTO v_secret
    FROM qa_k_private.fixture_signer_registry
   WHERE kid=p_kid AND active=true AND revoked_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN decision:='DENY_UNTRUSTED_SIGNER';RETURN NEXT;RETURN;END IF;

  v_message:=pg_catalog.concat_ws('|',
     'K1',p_kid,p_issuer,p_audience,p_jti::text,
     p_tenant_hash,p_store_hash,p_subject_hash,
     p_session_binding_hash,p_membership_revision_hash,
     p_authority_digest,p_capability,p_exp_epoch::text,
     p_resource_id::text,p_auth_checked_epoch::text,
     p_auth_valid_until_epoch::text,'ACTIVE');
  v_expected:=pg_catalog.encode(
     public.hmac(pg_catalog.convert_to(v_message,'UTF8'),
                 pg_catalog.convert_to(v_secret,'UTF8'),'sha256'),'hex');
  IF p_mac IS DISTINCT FROM v_expected THEN
    decision:='DENY_SIGNER_PROOF';RETURN NEXT;RETURN;
  END IF;
  -- Do not log or return token, MAC, key, Auth identifiers or raw session.
  -- The J read + I authoritative-local-state checks + nonce consume happen
  -- within THIS transaction. Remote Auth revocation AFTER the fresh check
  -- cannot be atomically locked here: retained P0.
  SELECT * INTO v_result FROM qa_i_private.transaction_bound_catalog_read(
   p_issuer,p_audience,p_jti,p_tenant_hash,p_store_hash,p_subject_hash,
   p_session_binding_hash,p_membership_revision_hash,p_authority_digest,
   p_capability,pg_catalog.to_timestamp(p_exp_epoch),p_resource_id);
  decision:=v_result.decision;
  item_code:=v_result.item_code;
  price_vnd:=v_result.price_vnd;
  RETURN NEXT;RETURN;
END $fn$;

ALTER FUNCTION qa_k_private.signed_transaction_catalog_read(
 text,text,uuid,text,text,text,text,text,text,text,bigint,uuid,bigint,bigint,text,text)
 OWNER TO tien404_i_owner;
REVOKE ALL ON FUNCTION qa_k_private.signed_transaction_catalog_read(
 text,text,uuid,text,text,text,text,text,text,text,bigint,uuid,bigint,bigint,text,text)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_k_private.signed_transaction_catalog_read(
 text,text,uuid,text,text,text,text,text,text,text,bigint,uuid,bigint,bigint,text,text)
 TO tien404_k_rpc;
\echo V18_3_6K_SCHEMA_READY
