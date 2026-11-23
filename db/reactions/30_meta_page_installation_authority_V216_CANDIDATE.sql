-- TIEN404 V21.6 — META PAGE INSTALLATION AUTHORITY HARDENING (CANDIDATE).
-- Applied ONLY after 10_page_reaction_drafts and 20_owner_reaction_page_list.
-- Read-only Meta OAuth verification MUST be performed by the server-side gateway,
-- before any approved issuer can insert app/installation proof rows.
-- No real Page IDs, tokens, business IDs, or credential are stored by this script.
-- NOT EXECUTED ON HOSTED; NO LIVE REACTION PERMISSION.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $check$ BEGIN
  IF to_regclass('app_private.reaction_page_industries') IS NULL OR
     to_regclass('public.page_reaction_drafts') IS NULL OR
     to_regprocedure('public.list_verified_reaction_pages(uuid)') IS NULL OR
     to_regprocedure('public.save_page_reaction_draft(uuid,jsonb,text)') IS NULL
  THEN RAISE EXCEPTION 'T404_V216_AUTHORITY_DEPENDENCY_MISSING'; END IF;
  -- Do not silently grandfather V21.4 generic proof_kind rows into authority.
  IF EXISTS (SELECT 1 FROM app_private.reaction_page_industries)
  THEN RAISE EXCEPTION 'T404_V216_REATTEST_REQUIRED_NONEMPTY_PROOF'; END IF;
  IF to_regclass('app_private.reaction_meta_apps') IS NOT NULL
  THEN RAISE EXCEPTION 'T404_V216_ALREADY_APPLIED'; END IF;
END $check$;

-- Only a separately reviewed privileged installer may approve a Meta App.
-- No app is preapproved, no app secret/token is stored here.
CREATE TABLE app_private.reaction_meta_apps (
  app_id text PRIMARY KEY CHECK (app_id ~ '^[1-9][0-9]{4,24}$'),
  environment text NOT NULL CHECK (environment IN ('demo','staging')),
  status text NOT NULL CHECK (status IN ('approved','revoked')),
  approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at>approved_at AND expires_at<=approved_at+interval '365 days')
);
REVOKE ALL ON app_private.reaction_meta_apps FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON app_private.reaction_meta_apps TO service_role;
ALTER TABLE app_private.reaction_meta_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.reaction_meta_apps FORCE ROW LEVEL SECURITY;

-- Stronger receipt metadata. These columns must ONLY be written AFTER
-- server-side validation of a REAL Meta Graph access token against the app,
-- Page task/permissions, Page subscription and anti-CSRF OAuth callback.
-- The database cannot itself verify a signed OAuth callback or a Meta token.
ALTER TABLE app_private.reaction_page_industries
  ADD COLUMN meta_page_id text NOT NULL CHECK (meta_page_id ~ '^[1-9][0-9]{4,24}$'),
  ADD COLUMN meta_app_id text NOT NULL CHECK (meta_app_id ~ '^[1-9][0-9]{4,24}$'),
  ADD COLUMN installation_id uuid NOT NULL UNIQUE,
  ADD COLUMN authority_issuer text NOT NULL CHECK (authority_issuer='t404_meta_oauth_gateway'),
  ADD COLUMN attestation_version integer NOT NULL CHECK (attestation_version=1),
  ADD COLUMN receipt_sha256 text NOT NULL UNIQUE CHECK (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN callback_state_verified boolean NOT NULL,
  ADD COLUMN token_app_binding_verified boolean NOT NULL,
  ADD COLUMN page_token_validated boolean NOT NULL,
  ADD COLUMN messaging_task_verified boolean NOT NULL,
  ADD COLUMN subscribed_app_verified boolean NOT NULL,
  ADD COLUMN validated_permissions text[] NOT NULL,
  ADD COLUMN proof_status text NOT NULL CHECK (proof_status IN ('verified','revoked')),
  ADD COLUMN expires_at timestamptz NOT NULL;
ALTER TABLE app_private.reaction_page_industries
  ADD CONSTRAINT t404_v216_page_unique UNIQUE (meta_page_id),
  ADD CONSTRAINT t404_v216_proof_expires CHECK
  (expires_at>verified_at AND expires_at<=verified_at+interval '1 day');

-- No RLS policy for anon/authenticated. Approval registry and proof rows are
-- internal data; service_role is never usable in a frontend application.
CREATE FUNCTION app_private.t404_reaction_meta_install_active(p_connection uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS (
   SELECT 1
   FROM app_private.reaction_page_industries pr
   JOIN public.channel_connections c ON c.id=pr.connection_id
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
REVOKE ALL ON FUNCTION app_private.t404_reaction_meta_install_active(uuid)
  FROM PUBLIC,anon,authenticated;

-- Preserve all other existing draft/owner/concurrency guards.
CREATE OR REPLACE FUNCTION public.save_page_reaction_draft(
  p_connection uuid, p_config jsonb, p_expected_sha text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  c record; industry text; actor uuid:=auth.uid(); old_sha text; new_sha text;
  profile text; intents jsonb; mn int; maxh int; minsec int; maxhour int;
  categories text[]; permitted boolean:=false;
BEGIN
  IF actor IS NULL OR p_connection IS NULL THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
  END IF;
  -- Row locking serializes simultaneous updates of the SAME Page.
  SELECT c0.id,c0.tenant_id,c0.store_id,c0.channel,c0.status,c0.environment INTO c
    FROM public.channel_connections c0
    JOIN public.stores s ON s.id=c0.store_id AND s.tenant_id=c0.tenant_id AND s.active
    JOIN public.assistants a ON a.id=c0.assistant_id
      AND a.tenant_id=c0.tenant_id AND a.store_id=c0.store_id AND a.status='active'
    WHERE c0.id=p_connection FOR UPDATE OF c0;
  IF c.id IS NULL OR c.channel<>'messenger' OR c.status<>'active' OR
     c.environment NOT IN ('demo','staging') OR
     NOT app_private.t404_qa_tenant_allowed(c.tenant_id) OR
     NOT EXISTS (
       SELECT 1 FROM public.store_memberships sm
       JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id
         AND tm.user_id=sm.user_id AND tm.active
       WHERE sm.tenant_id=c.tenant_id AND sm.store_id=c.store_id
         AND sm.user_id=actor AND sm.active AND sm.role='owner'
     ) THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
  END IF;
  SELECT proof.industry_id INTO industry FROM app_private.reaction_page_industries proof
    WHERE proof.connection_id=p_connection AND proof.proof_kind='meta_page_verified_installation'
      AND app_private.t404_reaction_meta_install_active(p_connection);
  IF industry IS NULL THEN RAISE EXCEPTION 'unverified_page_industry' USING ERRCODE='42501'; END IF;

  IF p_config IS NULL OR jsonb_typeof(p_config)<>'object' OR
     (SELECT count(*) FROM jsonb_object_keys(p_config))<>5 OR
     EXISTS (SELECT 1 FROM jsonb_object_keys(p_config) k
       WHERE k NOT IN ('schemaVersion','profileId','intents','cooldownSeconds','maxPerHour')) OR
     p_config->'schemaVersion'<>'2'::jsonb OR
     jsonb_typeof(p_config->'profileId')<>'string' OR
     jsonb_typeof(p_config->'intents')<>'object' OR
     (SELECT count(*) FROM jsonb_object_keys(p_config->'intents'))<>2 OR
     jsonb_typeof(p_config->'intents'->'thanks')<>'boolean' OR
     jsonb_typeof(p_config->'intents'->'praise')<>'boolean' OR
     jsonb_typeof(p_config->'cooldownSeconds')<>'number' OR
     jsonb_typeof(p_config->'maxPerHour')<>'number' OR
     (p_config->>'cooldownSeconds') !~ '^[0-9]{1,4}$' OR
     (p_config->>'maxPerHour') !~ '^[0-9]{1,2}$' OR
     octet_length(p_config::text)>1500 THEN
    RAISE EXCEPTION 'invalid_reaction_draft' USING ERRCODE='22023';
  END IF;
  profile:=p_config->>'profileId';
  intents:=p_config->'intents'; mn:=(p_config->>'cooldownSeconds')::int;
  maxh:=(p_config->>'maxPerHour')::int;

  -- Fail closed if registry supplies an unknown industry. Regulated sectors silent only.
  IF industry = ANY(ARRAY['healthcare','legal','banking_finance','insurance',
        'public_services','crisis_support','funeral_services','professional_services']) THEN
    categories:=ARRAY['silent'];
  ELSIF industry = ANY(ARRAY['construction_materials','wholesale','hardware','grocery','retail_general']) THEN
    categories:=ARRAY['silent','restrained','friendly'];
  ELSIF industry = ANY(ARRAY['fashion','beauty','food_beverage','hospitality','artist','music',
        'entertainment','creator','community','events']) THEN
    categories:=ARRAY['silent','restrained','friendly','expressive'];
  ELSE
    RAISE EXCEPTION 'unknown_industry' USING ERRCODE='22023';
  END IF;
  IF profile IS NULL OR NOT profile=ANY(categories) THEN
    RAISE EXCEPTION 'profile_not_allowed' USING ERRCODE='22023';
  END IF;
  IF profile='silent' THEN
    permitted := intents='{"thanks":false,"praise":false}'::jsonb AND maxh=0 AND mn=3600;
  ELSE
    minsec:=CASE profile WHEN 'restrained' THEN 600 WHEN 'friendly' THEN 300
                        WHEN 'expressive' THEN 90 END;
    maxhour:=CASE profile WHEN 'restrained' THEN 1 WHEN 'friendly' THEN 2
                          WHEN 'expressive' THEN 5 END;
    permitted:= mn BETWEEN minsec AND 3600 AND maxh BETWEEN 1 AND maxhour
      AND ((intents->>'thanks')::boolean OR (intents->>'praise')::boolean)
      AND NOT (profile='restrained' AND (intents->>'praise')::boolean);
  END IF;
  IF NOT coalesce(permitted,false) THEN
    RAISE EXCEPTION 'profile_limit_invalid' USING ERRCODE='22023';
  END IF;

  -- Optimistic concurrency: NULL expected only when creating a fresh draft.
  SELECT config_sha256 INTO old_sha FROM public.page_reaction_drafts
    WHERE connection_id=p_connection;
  IF old_sha IS DISTINCT FROM p_expected_sha THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='draft_changed';
  END IF;
  new_sha:=app_private.t404_cfg_sha(p_config);
  INSERT INTO public.page_reaction_drafts(connection_id,tenant_id,store_id,industry_id,
    config,config_sha256,created_by,updated_by)
  VALUES (p_connection,c.tenant_id,c.store_id,industry,p_config,new_sha,actor,actor)
  ON CONFLICT (connection_id) DO UPDATE SET
    config=EXCLUDED.config,config_sha256=EXCLUDED.config_sha256,
    industry_id=EXCLUDED.industry_id,updated_by=EXCLUDED.updated_by,updated_at=now();
  INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
    VALUES (c.tenant_id,actor,'reaction_page_draft_saved',
      jsonb_build_object('connection_id',p_connection,'sha',new_sha,'industry',industry));
  RETURN new_sha;
END $fn$;
-- Re-verify proof for the owner-only read-list as well.
CREATE OR REPLACE FUNCTION public.list_verified_reaction_pages(p_store uuid)
 RETURNS TABLE(
   connection_id uuid,
   page_name text,
   industry_id text,
   environment text,
   draft_sha text
 )
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 WITH owner_scope AS (
   SELECT s.tenant_id, s.id AS store_id
     FROM public.stores s
     JOIN public.store_memberships sm
       ON sm.store_id=s.id AND sm.tenant_id=s.tenant_id
          AND sm.active AND sm.role='owner' AND sm.user_id=auth.uid()
     JOIN public.tenant_memberships tm
       ON tm.tenant_id=s.tenant_id AND tm.user_id=sm.user_id AND tm.active
    WHERE s.id=p_store AND s.active AND auth.uid() IS NOT NULL
      AND app_private.t404_qa_tenant_allowed(s.tenant_id)
 )
 SELECT c.id,
        coalesce(nullif(btrim(c.display_name),''),'Messenger Page') AS page_name,
        pr.industry_id,
        c.environment,
        d.config_sha256
   FROM owner_scope own
   JOIN public.channel_connections c ON
      c.tenant_id=own.tenant_id AND c.store_id=own.store_id
      AND c.channel='messenger' AND c.status='active'
      AND c.environment IN ('demo','staging')
   JOIN public.assistants a ON a.tenant_id=c.tenant_id
      AND a.store_id=c.store_id AND a.id=c.assistant_id AND a.status='active'
   JOIN app_private.reaction_page_industries pr ON
      pr.connection_id=c.id
      AND pr.proof_kind='meta_page_verified_installation'
      AND app_private.t404_reaction_meta_install_active(c.id)
   LEFT JOIN public.page_reaction_drafts d
      ON d.connection_id=c.id AND d.tenant_id=c.tenant_id
      AND d.store_id=c.store_id AND d.industry_id=pr.industry_id
   ORDER BY c.display_name NULLS LAST,c.id
 $fn$;
SELECT 'T404_V216_META_INSTALL_AUTHORITY_CANDIDATE_OK' AS marker;
COMMIT;
