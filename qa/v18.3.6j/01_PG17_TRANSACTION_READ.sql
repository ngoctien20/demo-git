\set ON_ERROR_STOP on
\echo V18_3_6J_SCHEMA_START
DO $guard$ BEGIN
  IF current_database()<>'tien404_v1836i_disposable' OR
     current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  THEN RAISE EXCEPTION 'NOT_DISPOSABLE_POSTGRESQL17'; END IF;
END $guard$;

-- Work ONLY on the I disposable database. There is NO Supabase staging DDL.
CREATE ROLE tien404_j_gateway NOLOGIN NOBYPASSRLS NOSUPERUSER;
CREATE ROLE tien404_j_attacker NOLOGIN NOBYPASSRLS NOSUPERUSER;
GRANT USAGE ON SCHEMA qa_i_private TO tien404_j_gateway;

ALTER TABLE qa_i_private.session_state
  ADD COLUMN last_authority_check_at timestamptz NOT NULL DEFAULT clock_timestamp();

CREATE TABLE qa_i_private.catalog_fixture (
 resource_id uuid NOT NULL,
 tenant_hash text NOT NULL CHECK (tenant_hash ~ '^[a-f0-9]{64}$'),
 store_hash text NOT NULL CHECK (store_hash ~ '^[a-f0-9]{64}$'),
 item_code text NOT NULL CHECK (length(item_code) BETWEEN 1 AND 64),
 price_vnd bigint NOT NULL CHECK (price_vnd>=0),
 PRIMARY KEY (resource_id,tenant_hash,store_hash)
);
ALTER TABLE qa_i_private.catalog_fixture OWNER TO tien404_i_owner;
ALTER TABLE qa_i_private.catalog_fixture ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_i_private.catalog_fixture FROM PUBLIC,tien404_j_gateway,tien404_j_attacker;

-- Demonstration ONLY: external Auth revocation can occur WITHOUT arriving at
-- the locally mirrored authority table. This table is never consulted by the
-- privileged RPC. It is a NEGATIVE production readiness finding.
CREATE TABLE qa_i_private.external_auth_event_fixture (
 session_binding_hash text NOT NULL,
 event_type text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE qa_i_private.external_auth_event_fixture OWNER TO tien404_i_owner;
REVOKE ALL ON qa_i_private.external_auth_event_fixture FROM PUBLIC,tien404_j_gateway,tien404_j_attacker;

INSERT INTO qa_i_private.catalog_fixture(resource_id,tenant_hash,store_hash,item_code,price_vnd) VALUES
 ('00000000-0000-4000-8000-000000000101',repeat('d',64),repeat('e',64),'QA-A-CATALOG',100000),
 ('00000000-0000-4000-8000-000000000102',repeat('d',64),repeat('2',64),'QA-B-CATALOG',200000),
 ('00000000-0000-4000-8000-000000000103',repeat('7',64),repeat('4',64),'QA-OTHER-TENANT',300000);

-- Read-only functionality IN THE SAME DATABASE TRANSACTION that locks
-- verified session/member rows and consumes a JTI. No further data operation.
-- SQL DOES NOT VERIFY Ed25519 and trusts its private executor: P0 live gap.
CREATE FUNCTION qa_i_private.transaction_bound_catalog_read(
 p_issuer text,p_audience text,p_jti uuid,p_tenant_hash text,
 p_store_hash text,p_subject_hash text,p_session_binding_hash text,
 p_membership_revision_hash text,p_authority_digest text,p_capability text,
 p_exp timestamptz,p_resource_id uuid)
RETURNS TABLE(decision text,item_code text,price_vnd bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE item record; checked timestamptz; admitted text;
BEGIN
 item_code:=NULL;price_vnd:=NULL;
 IF p_resource_id IS NULL OR p_capability IS DISTINCT FROM 'CATALOG_READ' THEN
  decision:='DENY_CAPABILITY_OR_RESOURCE';RETURN NEXT;RETURN;
 END IF;
 IF p_tenant_hash IS NULL OR p_tenant_hash !~ '^[a-f0-9]{64}$' OR
    p_store_hash IS NULL OR p_store_hash !~ '^[a-f0-9]{64}$' THEN
  decision:='DENY_SCOPE'; RETURN NEXT; RETURN;
 END IF;

 -- The resource lock is acquired before re-checking session/member and
 -- consuming nonce. Locks remain held to the end of this SQL transaction.
 SELECT c.item_code,c.price_vnd INTO item
 FROM qa_i_private.catalog_fixture c
 WHERE c.resource_id=p_resource_id
  AND c.tenant_hash=p_tenant_hash AND c.store_hash=p_store_hash
 FOR KEY SHARE;
 IF NOT FOUND THEN
  decision:='DENY_RESOURCE_SCOPE';RETURN NEXT;RETURN;
 END IF;

 -- This is only an observed-local-registry freshness check.
 -- It does NOT prove remote Auth service revocation has propagated.
 SELECT s.last_authority_check_at INTO checked
 FROM qa_i_private.session_state s
 WHERE s.session_binding_hash=p_session_binding_hash FOR SHARE;
 IF NOT FOUND THEN
  decision:='DENY_SESSION';RETURN NEXT;RETURN;
 END IF;
 IF checked IS NULL OR
    checked < clock_timestamp()-interval '60 seconds' OR
    checked > clock_timestamp() THEN
  decision:='DENY_SESSION_PROOF_STALE';RETURN NEXT;RETURN;
 END IF;

 -- I's atomic function locks the same session row and Store membership row
 -- for the duration of the current transaction. Only then insert nonce.
 admitted:=qa_i_private.atomic_admit_verified_authority(
   p_issuer,p_audience,p_jti,p_tenant_hash,p_store_hash,p_subject_hash,
   p_session_binding_hash,p_membership_revision_hash,p_authority_digest,
   p_capability,p_exp);
 IF admitted IS DISTINCT FROM 'ACCEPTED' THEN
  decision:=COALESCE(admitted,'DENY_ADMISSION');RETURN NEXT;RETURN;
 END IF;
 decision:='ALLOW_CATALOG';
 item_code:=item.item_code;
 price_vnd:=item.price_vnd;
 RETURN NEXT;RETURN;
END $body$;

ALTER FUNCTION qa_i_private.transaction_bound_catalog_read(
 text,text,uuid,text,text,text,text,text,text,text,timestamptz,uuid)
 OWNER TO tien404_i_owner;
REVOKE ALL ON FUNCTION qa_i_private.transaction_bound_catalog_read(
 text,text,uuid,text,text,text,text,text,text,text,timestamptz,uuid)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_i_private.transaction_bound_catalog_read(
 text,text,uuid,text,text,text,text,text,text,text,timestamptz,uuid)
 TO tien404_j_gateway;
-- Deliberately NO grant to real/simulated anonymous, normal actor or I caller.
\echo V18_3_6J_SCHEMA_READY
