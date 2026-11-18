\set ON_ERROR_STOP on
\echo V18_3_6I_DISPOSABLE_SCHEMA_START
DO $guard$ BEGIN
  IF current_database()<>'tien404_v1836i_disposable' OR
     current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  THEN RAISE EXCEPTION 'I_REQUIRES_DISPOSABLE_PG17'; END IF;
END $guard$;

CREATE EXTENSION IF NOT EXISTS pgtap;
CREATE ROLE tien404_i_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE tien404_i_executor NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE tien404_i_untrusted NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA qa_i_private AUTHORIZATION tien404_i_owner;
REVOKE ALL ON SCHEMA qa_i_private FROM PUBLIC;
GRANT USAGE ON SCHEMA qa_i_private TO tien404_i_executor;

-- Synthetic mirrors of a privileged authoritative session/membership registry.
-- These are NOT auth.sessions and NOT production public.stores.
CREATE TABLE qa_i_private.session_state(
 session_binding_hash text PRIMARY KEY CHECK(session_binding_hash ~ '^[a-f0-9]{64}$'),
 subject_hash text NOT NULL CHECK(subject_hash ~ '^[a-f0-9]{64}$'),
 active boolean NOT NULL,
 revoked_at timestamptz,
 expires_at timestamptz NOT NULL
);
CREATE TABLE qa_i_private.store_authority(
 tenant_hash text NOT NULL CHECK(tenant_hash ~ '^[a-f0-9]{64}$'),
 store_hash text NOT NULL CHECK(store_hash ~ '^[a-f0-9]{64}$'),
 subject_hash text NOT NULL CHECK(subject_hash ~ '^[a-f0-9]{64}$'),
 membership_revision_hash text NOT NULL CHECK(membership_revision_hash ~ '^[a-f0-9]{64}$'),
 active boolean NOT NULL,
 store_active boolean NOT NULL,
 revoked_at timestamptz,
 expires_at timestamptz,
 read_capabilities text[] NOT NULL,
 PRIMARY KEY(tenant_hash,store_hash,subject_hash)
);
CREATE TABLE qa_i_private.verified_nonce(
 issuer text NOT NULL,audience text NOT NULL,jti uuid NOT NULL,
 tenant_hash text NOT NULL,store_hash text NOT NULL,subject_hash text NOT NULL,
 session_binding_hash text NOT NULL,membership_revision_hash text NOT NULL,
 authority_digest text NOT NULL,
 capability text NOT NULL,expires_at timestamptz NOT NULL,
 consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(issuer,jti)
);
ALTER TABLE qa_i_private.session_state OWNER TO tien404_i_owner;
ALTER TABLE qa_i_private.store_authority OWNER TO tien404_i_owner;
ALTER TABLE qa_i_private.verified_nonce OWNER TO tien404_i_owner;
ALTER TABLE qa_i_private.session_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_i_private.store_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_i_private.verified_nonce ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_i_private.session_state,qa_i_private.store_authority,
 qa_i_private.verified_nonce FROM PUBLIC,tien404_i_executor,tien404_i_untrusted;

INSERT INTO qa_i_private.session_state VALUES
 (repeat('a',64),repeat('c',64),true,NULL,clock_timestamp()+interval '60 minutes'),
 (repeat('b',64),repeat('1',64),true,NULL,clock_timestamp()+interval '60 minutes');
INSERT INTO qa_i_private.store_authority VALUES
 (repeat('d',64),repeat('e',64),repeat('c',64),repeat('f',64),true,true,NULL,NULL,ARRAY['CATALOG_READ','ORDER_READ']),
 (repeat('d',64),repeat('2',64),repeat('1',64),repeat('3',64),true,true,NULL,NULL,ARRAY['CATALOG_READ','ORDER_READ']);

CREATE FUNCTION qa_i_private.atomic_admit_verified_authority(
 p_issuer text,p_audience text,p_jti uuid,p_tenant_hash text,
 p_store_hash text,p_subject_hash text,p_session_binding_hash text,
 p_membership_revision_hash text,p_authority_digest text,p_capability text,
 p_exp timestamptz)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE
 s record; m record; inserted integer; t timestamptz;
BEGIN
 t:=clock_timestamp();
 -- This function is available only to a protected EXECUTOR that has ALREADY
 -- verified Ed25519 and ALL signed claims. It DOES NOT validate signatures.
 IF p_issuer IS DISTINCT FROM 'tien404-private-authority-staging' OR
    p_audience IS DISTINCT FROM 'tien404-private-commerce-readonly'
 THEN RETURN 'DENY_ISSUER_AUDIENCE'; END IF;
 IF p_jti IS NULL OR p_jti='00000000-0000-0000-0000-000000000000'::uuid OR
    p_capability NOT IN ('CATALOG_READ','ORDER_READ') OR p_capability IS NULL OR
    p_tenant_hash IS NULL OR p_tenant_hash !~ '^[a-f0-9]{64}$' OR
    p_store_hash IS NULL OR p_store_hash !~ '^[a-f0-9]{64}$' OR
    p_subject_hash IS NULL OR p_subject_hash !~ '^[a-f0-9]{64}$' OR
    p_session_binding_hash IS NULL OR p_session_binding_hash !~ '^[a-f0-9]{64}$' OR
    p_membership_revision_hash IS NULL OR p_membership_revision_hash !~ '^[a-f0-9]{64}$' OR
    p_authority_digest IS NULL OR p_authority_digest !~ '^[a-f0-9]{64}$'
 THEN RETURN 'DENY_REQUEST'; END IF;
 IF p_exp IS NULL OR p_exp<=t OR p_exp>t+interval '120 seconds'
 THEN RETURN 'DENY_EXPIRED'; END IF;

 -- Lock order is SESSION first, MEMBERSHIP second; revocation updates the
 -- same rows. This defines transaction ordering for the protected admission.
 SELECT subject_hash,active,revoked_at,expires_at INTO s
 FROM qa_i_private.session_state
 WHERE session_binding_hash=p_session_binding_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN 'DENY_SESSION'; END IF;
 IF s.subject_hash IS DISTINCT FROM p_subject_hash OR s.active IS DISTINCT FROM true OR
    s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp()
 THEN RETURN 'DENY_SESSION'; END IF;

 SELECT membership_revision_hash,active,store_active,revoked_at,expires_at,read_capabilities INTO m
 FROM qa_i_private.store_authority
 WHERE tenant_hash=p_tenant_hash AND store_hash=p_store_hash AND subject_hash=p_subject_hash
 FOR UPDATE;
 IF NOT FOUND THEN RETURN 'DENY_MEMBERSHIP'; END IF;
 IF m.membership_revision_hash IS DISTINCT FROM p_membership_revision_hash OR
    m.active IS DISTINCT FROM true OR m.store_active IS DISTINCT FROM true OR
    m.revoked_at IS NOT NULL OR (m.expires_at IS NOT NULL AND m.expires_at<=clock_timestamp()) OR
    NOT (p_capability=ANY(m.read_capabilities))
 THEN RETURN 'DENY_MEMBERSHIP'; END IF;

 -- No data operation occurs here: this is ONLY admission/nonce consumption.
 INSERT INTO qa_i_private.verified_nonce(
  issuer,audience,jti,tenant_hash,store_hash,subject_hash,
  session_binding_hash,membership_revision_hash,authority_digest,capability,expires_at)
 VALUES(p_issuer,p_audience,p_jti,p_tenant_hash,p_store_hash,p_subject_hash,
  p_session_binding_hash,p_membership_revision_hash,p_authority_digest,p_capability,p_exp)
 ON CONFLICT (issuer,jti) DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted<>1 THEN RETURN 'REPLAY'; END IF;
 RETURN 'ACCEPTED';
END $f$;

ALTER FUNCTION qa_i_private.atomic_admit_verified_authority(
 text,text,uuid,text,text,text,text,text,text,text,timestamptz)
 OWNER TO tien404_i_owner;
REVOKE ALL ON FUNCTION qa_i_private.atomic_admit_verified_authority(
 text,text,uuid,text,text,text,text,text,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_i_private.atomic_admit_verified_authority(
 text,text,uuid,text,text,text,text,text,text,text,timestamptz) TO tien404_i_executor;

-- Only synthetic role/fixture tables. No public permissions or RPC endpoints.
\echo V18_3_6I_DISPOSABLE_SCHEMA_READY
