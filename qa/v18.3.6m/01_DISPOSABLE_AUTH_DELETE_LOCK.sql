\set ON_ERROR_STOP on
\echo V18_3_6M_DISPOSABLE_SCHEMA_START
DO $guard$ BEGIN
  IF current_database()<>'tien404_v1836m_disposable' OR
     current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  THEN RAISE EXCEPTION 'V18_3_6M_DISPOSABLE_PG17_ONLY'; END IF;
END $guard$;

CREATE EXTENSION IF NOT EXISTS pgtap;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE ROLE tien404_m_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE tien404_m_gateway NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE tien404_m_untrusted NOLOGIN NOSUPERUSER NOBYPASSRLS;

-- Simulated auth.sessions. Not Supabase-managed auth.sessions and NOT a clone.
-- Only synthetic identities; never attach to a real Auth user or environment.
CREATE SCHEMA qa_m_auth AUTHORIZATION tien404_m_owner;
CREATE SCHEMA qa_m_private AUTHORIZATION tien404_m_owner;
REVOKE ALL ON SCHEMA qa_m_auth,qa_m_private FROM PUBLIC;
GRANT USAGE ON SCHEMA qa_m_private TO tien404_m_gateway;

CREATE TABLE qa_m_auth.sessions(
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL,
 not_after timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE qa_m_private.membership(
 user_id uuid NOT NULL,
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 revision integer NOT NULL CHECK (revision>0),
 active boolean NOT NULL DEFAULT true,
 store_active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(user_id,tenant_id,store_id)
);
CREATE TABLE qa_m_private.catalog(
 item_id uuid NOT NULL,
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 item_code text NOT NULL,
 price_vnd bigint NOT NULL CHECK (price_vnd>=0),
 PRIMARY KEY(item_id,tenant_id,store_id)
);
CREATE TABLE qa_m_private.nonce_ledger(
 issuer text NOT NULL,
 jti uuid NOT NULL,
 session_id uuid NOT NULL,
 store_id uuid NOT NULL,
 item_id uuid NOT NULL,
 consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(issuer,jti)
);
ALTER TABLE qa_m_auth.sessions OWNER TO tien404_m_owner;
ALTER TABLE qa_m_private.membership OWNER TO tien404_m_owner;
ALTER TABLE qa_m_private.catalog OWNER TO tien404_m_owner;
ALTER TABLE qa_m_private.nonce_ledger OWNER TO tien404_m_owner;
ALTER TABLE qa_m_auth.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_m_private.membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_m_private.catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_m_private.nonce_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_m_auth.sessions,qa_m_private.membership,
 qa_m_private.catalog,qa_m_private.nonce_ledger FROM PUBLIC,tien404_m_gateway,tien404_m_untrusted;

-- Synthetic session fixtures: independent A/B users in SAME Tenant,
-- and Store C from another tenant. Purely disposable.
INSERT INTO qa_m_auth.sessions(id,user_id,not_after) VALUES
 ('00000000-0000-4000-8000-000000000111','00000000-0000-4000-8000-000000000211',clock_timestamp()+interval '12 hours'),
 ('00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000212',clock_timestamp()+interval '12 hours'),
 ('00000000-0000-4000-8000-000000000113','00000000-0000-4000-8000-000000000213',clock_timestamp()+interval '12 hours');
INSERT INTO qa_m_private.membership(user_id,tenant_id,store_id,revision) VALUES
 ('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000401',1),
 ('00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000402',1),
 ('00000000-0000-4000-8000-000000000213','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000403',1);
INSERT INTO qa_m_private.catalog(item_id,tenant_id,store_id,item_code,price_vnd) VALUES
 ('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000401','QA-ITEM-A',159000),
 ('00000000-0000-4000-8000-000000000502','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000402','QA-ITEM-B',189000),
 ('00000000-0000-4000-8000-000000000503','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000403','QA-ITEM-C',259000);

-- A private, narrowly scoped read with SESSION DELETE ordering.
-- Locks taken in fixed order SESSION -> MEMBERSHIP -> CATALOG -> NONCE.
-- The lock on qa_m_auth.sessions conflicts with DELETE of that same row.
-- This routine does NOT verify any JWT or external Ed25519 signature:
-- it assumes the exclusive private caller already verified signed claims.
CREATE FUNCTION qa_m_private.catalog_read_if_session_exists(
 p_issuer text,p_audience text,p_jti uuid,p_session_id uuid,p_user_id uuid,
 p_tenant_id uuid,p_store_id uuid,p_membership_revision integer,
 p_item_id uuid,p_capability text,p_exp timestamptz)
RETURNS TABLE(decision text,item_code text,price_vnd bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE v_user_id uuid;v_not_after timestamptz;v_membership record;
 v_item record;v_rowcount integer;v_now timestamptz;
BEGIN
 decision:='DENY';item_code:=NULL;price_vnd:=NULL;
 v_now:=clock_timestamp();
 IF p_issuer IS DISTINCT FROM 'tien404-synthetic-authority' OR
    p_audience IS DISTINCT FROM 'tien404-synthetic-catalog-read' OR
    p_capability IS DISTINCT FROM 'CATALOG_READ'
 THEN decision:='DENY_ISSUER_AUDIENCE_CAPABILITY';RETURN NEXT;RETURN;END IF;
 IF p_jti IS NULL OR p_session_id IS NULL OR p_user_id IS NULL OR
    p_tenant_id IS NULL OR p_store_id IS NULL OR p_item_id IS NULL OR
    p_membership_revision IS NULL OR p_membership_revision<1
 THEN decision:='DENY_INPUT';RETURN NEXT;RETURN;END IF;
 IF p_exp IS NULL OR p_exp<=v_now OR p_exp>v_now+interval '120 seconds'
 THEN decision:='DENY_EXPIRY';RETURN NEXT;RETURN;END IF;

 SELECT s.user_id,s.not_after INTO v_user_id,v_not_after
 FROM qa_m_auth.sessions s WHERE s.id=p_session_id
 FOR UPDATE;
 IF NOT FOUND OR v_user_id IS DISTINCT FROM p_user_id OR v_not_after<=clock_timestamp()
 THEN decision:='DENY_SESSION';RETURN NEXT;RETURN;END IF;

 SELECT m.revision,m.active,m.store_active INTO v_membership
 FROM qa_m_private.membership m
 WHERE m.user_id=p_user_id AND m.tenant_id=p_tenant_id AND m.store_id=p_store_id
 FOR UPDATE;
 IF NOT FOUND OR v_membership.revision IS DISTINCT FROM p_membership_revision OR
    v_membership.active IS DISTINCT FROM true OR v_membership.store_active IS DISTINCT FROM true
 THEN decision:='DENY_MEMBERSHIP';RETURN NEXT;RETURN;END IF;

 SELECT c.item_code,c.price_vnd INTO v_item
 FROM qa_m_private.catalog c
 WHERE c.item_id=p_item_id AND c.tenant_id=p_tenant_id AND c.store_id=p_store_id
 FOR KEY SHARE;
 IF NOT FOUND THEN decision:='DENY_RESOURCE_SCOPE';RETURN NEXT;RETURN;END IF;

 INSERT INTO qa_m_private.nonce_ledger(issuer,jti,session_id,store_id,item_id)
 VALUES(p_issuer,p_jti,p_session_id,p_store_id,p_item_id)
 ON CONFLICT(issuer,jti) DO NOTHING;
 GET DIAGNOSTICS v_rowcount=ROW_COUNT;
 IF v_rowcount<>1 THEN decision:='REPLAY';RETURN NEXT;RETURN;END IF;

 decision:='ALLOW_CATALOG';item_code:=v_item.item_code;price_vnd:=v_item.price_vnd;
 RETURN NEXT;RETURN;
END $body$;
ALTER FUNCTION qa_m_private.catalog_read_if_session_exists(
 text,text,uuid,uuid,uuid,uuid,uuid,integer,uuid,text,timestamptz)
 OWNER TO tien404_m_owner;
REVOKE ALL ON FUNCTION qa_m_private.catalog_read_if_session_exists(
 text,text,uuid,uuid,uuid,uuid,uuid,integer,uuid,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_m_private.catalog_read_if_session_exists(
 text,text,uuid,uuid,uuid,uuid,uuid,integer,uuid,text,timestamptz)
 TO tien404_m_gateway;

\echo V18_3_6M_DISPOSABLE_SCHEMA_READY
