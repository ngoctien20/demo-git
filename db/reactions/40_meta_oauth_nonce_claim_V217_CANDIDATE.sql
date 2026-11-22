-- TIEN404 V21.7 — ATOMIC OAUTH NONCE CLAIM / PROOF BINDING CANDIDATE.
-- Disposable PG17 UAT only. Not applied hosted, never a Meta provider authorization.
-- Requires candidate migrations 10 -> 20 -> 30, and an approved private OAuth
-- gateway which issues server-only challenges and validates real Meta GET evidence.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $check$ BEGIN
  IF to_regclass('app_private.reaction_meta_apps') IS NULL OR
     to_regclass('app_private.reaction_page_industries') IS NULL OR
     to_regprocedure('app_private.t404_reaction_meta_install_active(uuid)') IS NULL
  THEN RAISE EXCEPTION 'T404_V217_META_NONCE_DEPENDENCY_MISSING'; END IF;
  IF to_regclass('app_private.reaction_meta_nonce_claims') IS NOT NULL
  THEN RAISE EXCEPTION 'T404_V217_META_NONCE_ALREADY_APPLIED'; END IF;
  IF EXISTS(SELECT 1 FROM app_private.reaction_page_industries)
  THEN RAISE EXCEPTION 'T404_V217_NONEMPTY_PROOF_REATTEST_REQUIRED'; END IF;
END $check$;

-- Authenticated browser/LLM must never insert nonce records.
-- The trusted OAuth gateway issues nonces with a short expiry and binds them
-- to one installation + owner + tenant + store + Page + approved Meta App.
CREATE TABLE app_private.reaction_meta_nonce_claims(
  oauth_nonce_sha256 text PRIMARY KEY CHECK(oauth_nonce_sha256 ~ '^[0-9a-f]{64}$'),
  installation_id uuid NOT NULL UNIQUE,
  connection_id uuid NOT NULL REFERENCES public.channel_connections(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  meta_app_id text NOT NULL REFERENCES app_private.reaction_meta_apps(app_id) ON DELETE RESTRICT,
  meta_page_id text NOT NULL CHECK(meta_page_id ~ '^[1-9][0-9]{4,24}$'),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  receipt_sha256 text UNIQUE CHECK(receipt_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (expires_at>issued_at AND expires_at<=issued_at+interval '10 minutes'),
  CHECK (consumed_at IS NULL OR (consumed_at>=issued_at AND receipt_sha256 IS NOT NULL))
);
REVOKE ALL ON app_private.reaction_meta_nonce_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON app_private.reaction_meta_nonce_claims TO service_role;
ALTER TABLE app_private.reaction_meta_nonce_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.reaction_meta_nonce_claims FORCE ROW LEVEL SECURITY;

-- Only service-side gateway may consume. One row UPDATE enforces exactly once:
-- second request (even concurrent) returns false; no public EXECUTE permission.
CREATE FUNCTION app_private.t404_reaction_consume_meta_oauth_nonce(
  p_nonce text,p_installation uuid,p_connection uuid,p_tenant uuid,p_store uuid,
  p_owner uuid,p_app text,p_page text,p_receipt text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE changed boolean:=false;
BEGIN
 IF p_nonce !~ '^[0-9a-f]{64}$' OR p_receipt !~ '^[0-9a-f]{64}$' OR
    p_installation IS NULL OR p_connection IS NULL OR
    p_tenant IS NULL OR p_store IS NULL OR p_owner IS NULL OR
    p_app !~ '^[1-9][0-9]{4,24}$' OR p_page !~ '^[1-9][0-9]{4,24}$'
 THEN RETURN false; END IF;
 UPDATE app_private.reaction_meta_nonce_claims n
    SET consumed_at=now(),receipt_sha256=p_receipt
  WHERE n.oauth_nonce_sha256=p_nonce AND n.consumed_at IS NULL
    AND n.issued_at<=now() AND n.expires_at>now()
    AND n.installation_id=p_installation
    AND n.connection_id=p_connection
    AND n.tenant_id=p_tenant AND n.store_id=p_store
    AND n.owner_user_id=p_owner AND n.meta_app_id=p_app
    AND n.meta_page_id=p_page
    AND EXISTS (
      SELECT 1 FROM public.channel_connections c
      JOIN public.stores s ON s.id=c.store_id AND s.tenant_id=c.tenant_id AND s.active
      JOIN public.assistants a ON a.id=c.assistant_id
        AND a.tenant_id=c.tenant_id AND a.store_id=c.store_id AND a.status='active'
      JOIN public.store_memberships sm ON sm.tenant_id=c.tenant_id
        AND sm.store_id=c.store_id AND sm.user_id=p_owner AND sm.active AND sm.role='owner'
      JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id
        AND tm.user_id=sm.user_id AND tm.active
      JOIN app_private.reaction_meta_apps app ON app.app_id=p_app
        AND app.environment=c.environment AND app.status='approved'
        AND app.approved_at<=now() AND app.expires_at>now()
      WHERE c.id=n.connection_id AND c.tenant_id=n.tenant_id
        AND c.store_id=n.store_id AND c.external_account_id=n.meta_page_id
        AND c.channel='messenger' AND c.status='active'
        AND c.environment IN ('demo','staging')
    )
  RETURNING true INTO changed;
 RETURN coalesce(changed,false);
END $fn$;
REVOKE ALL ON FUNCTION app_private.t404_reaction_consume_meta_oauth_nonce(
  text,uuid,uuid,uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.t404_reaction_consume_meta_oauth_nonce(
  text,uuid,uuid,uuid,uuid,uuid,text,text,text) TO service_role;

-- No legacy proof may be automatically granted authority by this migration.
ALTER TABLE app_private.reaction_page_industries
  ADD COLUMN oauth_nonce_sha256 text NOT NULL UNIQUE
  CHECK(oauth_nonce_sha256 ~ '^[0-9a-f]{64}$');

-- The same private authority predicate from V21.6, now requiring the unique
-- nonce to have been issued, consumed, matched to the receipt and bound to
-- one specific installation Page/store/owner.
CREATE OR REPLACE FUNCTION app_private.t404_reaction_meta_install_active(p_connection uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS (
   SELECT 1
   FROM app_private.reaction_page_industries pr
   JOIN public.channel_connections c ON c.id=pr.connection_id
   JOIN app_private.reaction_meta_nonce_claims nonce ON nonce.nonce_sha256=pr.oauth_nonce_sha256
      AND nonce.connection_id=c.id
      AND nonce.installation_id=pr.installation_id
      AND nonce.tenant_id=c.tenant_id AND nonce.store_id=c.store_id
      AND nonce.owner_user_id=pr.verified_by
      AND nonce.meta_page_id=pr.meta_page_id
      AND nonce.meta_app_id=pr.meta_app_id
      AND nonce.receipt_sha256=pr.receipt_sha256
      AND nonce.consumed_at IS NOT NULL
      AND nonce.consumed_at<=pr.verified_at
      AND nonce.consumed_at>now()-interval '1 day'
   JOIN app_private.reaction_meta_apps app ON app.app_id=pr.meta_app_id
      AND app.status='approved' AND app.environment=c.environment
      AND app.approved_at<=now() AND app.expires_at>now()
   JOIN public.store_memberships sm ON sm.tenant_id=c.tenant_id
      AND sm.store_id=c.store_id AND sm.user_id=pr.verified_by
      AND sm.active AND sm.role='owner'
   JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id
      AND tm.user_id=sm.user_id AND tm.active
   WHERE c.id=p_connection
     AND c.channel='messenger' AND c.status='active'
     AND c.environment IN ('demo','staging')
     AND c.external_account_id=pr.meta_page_id
     AND pr.proof_kind='meta_page_verified_installation'
     AND pr.authority_issuer='t404_meta_oauth_gateway'
     AND pr.attestation_version=1 AND pr.proof_status='verified'
     AND pr.callback_state_verified=true
     AND pr.token_app_binding_verified=true AND pr.page_token_validated=true
     AND pr.messaging_task_verified=true AND pr.subscribed_app_verified=true
     AND pr.validated_permissions @> ARRAY['pages_show_list','pages_manage_metadata','pages_messaging']::text[]
     AND cardinality(pr.validated_permissions)=3
     AND pr.verified_at<=now() AND pr.verified_at>now()-interval '1 day'
     AND pr.expires_at>now()
 )
 $fn$;
SELECT 'T404_V217_META_NONCE_ONE_TIME_CANDIDATE_OK' AS marker;
COMMIT;
