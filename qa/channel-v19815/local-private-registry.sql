-- TIEN404 V19.8.15: disposable local Supabase PG17 ONLY. NEVER hosted.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA t404_v19815_private;
REVOKE ALL ON SCHEMA t404_v19815_private FROM PUBLIC,anon,authenticated;

CREATE TABLE t404_v19815_private.registry (
 installation_ref text PRIMARY KEY REFERENCES public.t404_v19810_installations(installation_ref),
 bot_identity_digest char(64) NOT NULL UNIQUE CHECK (bot_identity_digest ~ '^[a-f0-9]{64}$'),
 credential_epoch integer NOT NULL CHECK (credential_epoch>0),
 installation_version integer NOT NULL CHECK (installation_version>0),
 provider text NOT NULL CHECK (provider='zalo_bot_fixture'),
 state text NOT NULL CHECK (state IN ('attested','revoked')),
 attested_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK ((state='attested' AND revoked_at IS NULL) OR (state='revoked' AND revoked_at IS NOT NULL))
);
CREATE TABLE t404_v19815_private.attestation (
 installation_ref text PRIMARY KEY REFERENCES t404_v19815_private.registry(installation_ref),
 installation_version integer NOT NULL,
 credential_epoch integer NOT NULL,
 getme_matched boolean NOT NULL,
 webhook_matched boolean NOT NULL,
 secret_binding_reviewed boolean NOT NULL,
 evidence_signed boolean NOT NULL,
 observed_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK (expires_at>observed_at),
 evidence_digest char(64) NOT NULL CHECK (evidence_digest ~ '^[a-f0-9]{64}$')
);
ALTER TABLE t404_v19815_private.registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_v19815_private.registry FORCE ROW LEVEL SECURITY;
ALTER TABLE t404_v19815_private.attestation ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_v19815_private.attestation FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA t404_v19815_private FROM PUBLIC,anon,authenticated;

-- Local only: SECURITY DEFINER crosses RLS solely to run explicit current-membership
-- checks. Do NOT reuse hosted without independent review, restricted function owner,
-- caller inventory, hardened roles and approved migration.
CREATE FUNCTION public.t404_v19815_protected_catalog(
 p_installation_ref text,p_store_code text
) RETURNS TABLE(store_code text,sku text,price_vnd bigint,stock_on_hand integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
SELECT p.store_code,p.sku,p.price_vnd,p.stock_on_hand
FROM public.t404_v1989_products p
JOIN public.t404_v19810_installations i
 ON i.tenant_id=p.tenant_id AND i.store_code=p.store_code
JOIN t404_v19815_private.registry r
 ON r.installation_ref=i.installation_ref
JOIN t404_v19815_private.attestation a
 ON a.installation_ref=i.installation_ref
JOIN public.t404_v19812_grants g
 ON g.installation_ref=i.installation_ref
JOIN public.t404_v1989_store_memberships sm
 ON sm.tenant_id=i.tenant_id AND sm.store_code=i.store_code
 AND sm.user_id=i.owner_user_id
JOIN public.t404_v1989_tenant_memberships tm
 ON tm.tenant_id=i.tenant_id AND tm.user_id=i.owner_user_id
WHERE p_installation_ref=i.installation_ref
 AND p_store_code=i.store_code
 AND i.owner_user_id=(SELECT auth.uid())
 AND (SELECT auth.uid()) IS NOT NULL
 AND i.state='qa_active' AND i.revoked_at IS NULL
 AND i.verified_at<=statement_timestamp()
 AND r.state='attested' AND r.revoked_at IS NULL
 AND r.attested_at<=statement_timestamp()
 AND r.installation_version=i.version AND r.credential_epoch=i.credential_epoch
 AND a.installation_version=i.version AND a.credential_epoch=i.credential_epoch
 AND a.getme_matched=true AND a.webhook_matched=true
 AND a.secret_binding_reviewed=true AND a.evidence_signed=true
 AND a.observed_at<=statement_timestamp() AND a.expires_at>statement_timestamp()
 AND g.owner_user_id=i.owner_user_id AND g.tenant_id=i.tenant_id
 AND g.store_code=i.store_code AND g.binding_version=i.version
 AND g.scope='readonly_catalog_qa_only'
 AND g.state='approved' AND g.consented_at IS NOT NULL
 AND g.consented_at<=statement_timestamp() AND g.revoked_at IS NULL
 AND sm.active=true AND sm.role='owner' AND tm.owner_active=true
$fn$;
REVOKE ALL ON FUNCTION public.t404_v19815_protected_catalog(text,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.t404_v19815_protected_catalog(text,text)
 TO authenticated;
COMMIT;
