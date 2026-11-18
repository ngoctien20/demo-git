\set ON_ERROR_STOP on
\echo V18_3_6H_DISPOSABLE_SCHEMA_START
DO $guard$ BEGIN
 IF current_database()<>'tien404_v1836h_disposable' OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN
   RAISE EXCEPTION 'V18_3_6H_REQUIRES_DISPOSABLE_POSTGRESQL17';
 END IF;
END $guard$;

CREATE EXTENSION IF NOT EXISTS pgtap;
CREATE ROLE tien404_h_nonce_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE tien404_h_nonce_caller NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE tien404_h_nonce_untrusted NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA qa_h_private AUTHORIZATION tien404_h_nonce_owner;
REVOKE ALL ON SCHEMA qa_h_private FROM PUBLIC;
GRANT USAGE ON SCHEMA qa_h_private TO tien404_h_nonce_caller;
GRANT USAGE ON SCHEMA public TO tien404_h_nonce_caller; -- pgTAP only; no data table rights

CREATE TABLE qa_h_private.nonce_ledger (
 issuer text NOT NULL,
 audience text NOT NULL,
 jti uuid NOT NULL,
 tenant_hash text NOT NULL,
 store_hash text NOT NULL,
 authority_sha256 text NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(issuer,jti),
 CONSTRAINT nonce_ledger_proof_hash CHECK(authority_sha256 ~ '^[0-9a-f]{64}$')
);
ALTER TABLE qa_h_private.nonce_ledger OWNER TO tien404_h_nonce_owner;
ALTER TABLE qa_h_private.nonce_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_h_private.nonce_ledger FROM PUBLIC,tien404_h_nonce_caller,tien404_h_nonce_untrusted;

-- A COMMIT-level ledger, not a process-local Set or Map.
-- Only a previously validated, trusted signed-authority verifier may invoke
-- this private function. The function DOES NOT validate Ed25519 itself.
CREATE FUNCTION qa_h_private.consume_verified_nonce(
 p_issuer text,
 p_audience text,
 p_jti uuid,
 p_tenant_hash text,
 p_store_hash text,
 p_authority_sha256 text,
 p_exp timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE inserted integer; t timestamptz := clock_timestamp();
BEGIN
 IF p_issuer IS DISTINCT FROM 'tien404-private-authority-staging' OR
    p_audience IS DISTINCT FROM 'tien404-private-commerce-readonly'
 THEN RETURN 'DENY_ISSUER_AUDIENCE'; END IF;
 IF p_jti IS NULL OR p_jti='00000000-0000-0000-0000-000000000000'::uuid OR
    p_tenant_hash IS NULL OR p_tenant_hash !~ '^[0-9a-f]{64}$' OR
    p_store_hash IS NULL OR p_store_hash !~ '^[0-9a-f]{64}$' OR
    p_authority_sha256 IS NULL OR p_authority_sha256 !~ '^[0-9a-f]{64}$'
 THEN RETURN 'DENY_INPUT'; END IF;
 IF p_exp IS NULL OR p_exp<=t OR p_exp>t+interval '120 seconds'
 THEN RETURN 'DENY_EXPIRY'; END IF;
 -- Unique (issuer,jti) prevents reuse even with swapped Store/hash.
 INSERT INTO qa_h_private.nonce_ledger
  (issuer,audience,jti,tenant_hash,store_hash,authority_sha256,expires_at)
 VALUES (p_issuer,p_audience,p_jti,p_tenant_hash,p_store_hash,p_authority_sha256,p_exp)
 ON CONFLICT (issuer,jti) DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted<>1 THEN RETURN 'REPLAY'; END IF;
 RETURN 'ACCEPTED';
END $fn$;

ALTER FUNCTION qa_h_private.consume_verified_nonce(text,text,uuid,text,text,text,timestamptz)
 OWNER TO tien404_h_nonce_owner;
REVOKE ALL ON FUNCTION qa_h_private.consume_verified_nonce(text,text,uuid,text,text,text,timestamptz)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_h_private.consume_verified_nonce(text,text,uuid,text,text,text,timestamptz)
 TO tien404_h_nonce_caller;
-- All other roles have no schema usage, table rights, or function EXECUTE.
\echo V18_3_6H_DISPOSABLE_SCHEMA_READY
