-- TIEN404 V21.4 — PAGE-SCOPED REACTION DRAFT CANDIDATE.
-- STATUS: PROPOSED, NEVER APPLIED TO HOSTED. Needs prior V20 10/20/30 + config-core 10.
-- Owner-only draft storage; NO publisher, NO runtime resolver, NO enabled/send flag.
-- Verify trusted Meta Page installation / industry proof before ever filling app_private authority.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $check$ BEGIN
  IF to_regclass('public.channel_connections') IS NULL OR
     to_regclass('public.store_memberships') IS NULL OR
     to_regclass('public.tenant_memberships') IS NULL OR
     to_regprocedure('app_private.t404_cfg_sha(jsonb)') IS NULL OR
     to_regprocedure('app_private.t404_qa_tenant_allowed(uuid)') IS NULL OR
     to_regclass('app_private.audit_events') IS NULL THEN
    RAISE EXCEPTION 'T404_REACTION_V214_DEPENDENCY_MISSING';
  END IF;
  IF to_regclass('public.page_reaction_drafts') IS NOT NULL OR
     to_regclass('app_private.reaction_page_industries') IS NOT NULL THEN
    RAISE EXCEPTION 'T404_REACTION_V214_ALREADY_APPLIED';
  END IF;
END $check$;

-- This proof/industry binding must be created ONLY by an independently authorized installer.
-- No owner/browser input may create or modify this record; offline test seeds synthetic rows.
CREATE TABLE app_private.reaction_page_industries(
  connection_id uuid PRIMARY KEY REFERENCES public.channel_connections(id) ON DELETE RESTRICT,
  industry_id text NOT NULL CHECK (industry_id ~ '^[a-z][a-z0-9_]{1,47}$'),
  proof_kind text NOT NULL CHECK (proof_kind='meta_page_verified_installation'),
  verified_at timestamptz NOT NULL,
  verified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_private.reaction_page_industries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_private.reaction_page_industries TO service_role;
ALTER TABLE app_private.reaction_page_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.reaction_page_industries FORCE ROW LEVEL SECURITY;

-- An owner can save at most one draft per verified connection. Deliberately no state='published'
-- and no enabled=true; source of truth for runtime remains absent until separate approval.
CREATE TABLE public.page_reaction_drafts(
  connection_id uuid PRIMARY KEY REFERENCES public.channel_connections(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  industry_id text NOT NULL,
  config jsonb NOT NULL,
  config_sha256 text NOT NULL CHECK (config_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.page_reaction_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.page_reaction_drafts TO authenticated;
GRANT ALL ON public.page_reaction_drafts TO service_role;
ALTER TABLE public.page_reaction_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_reaction_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY page_reaction_drafts_owner_read ON public.page_reaction_drafts
 FOR SELECT TO authenticated USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.channel_connections c
    JOIN public.stores s ON s.tenant_id=c.tenant_id AND s.id=c.store_id AND s.active
    JOIN public.store_memberships sm ON sm.tenant_id=c.tenant_id
      AND sm.store_id=c.store_id AND sm.user_id=auth.uid()
      AND sm.active AND sm.role='owner'
    JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id
      AND tm.user_id=sm.user_id AND tm.active
    WHERE c.id=page_reaction_drafts.connection_id AND c.tenant_id=page_reaction_drafts.tenant_id
      AND c.store_id=page_reaction_drafts.store_id
  )
 );

CREATE FUNCTION public.save_page_reaction_draft(
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
      AND proof.verified_at<=now() AND proof.verified_at>now()-interval '180 days';
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
REVOKE ALL ON FUNCTION public.save_page_reaction_draft(uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_page_reaction_draft(uuid,jsonb,text) TO authenticated;
SELECT 'T404_V214_REACTION_DRAFT_CANDIDATE_OK' AS marker;
COMMIT;
