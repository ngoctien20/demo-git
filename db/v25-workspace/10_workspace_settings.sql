-- TIEN404 V25 Universal Workspace — owner settings. STATUS: PROPOSED (not applied anywhere).
-- REQUIRES V20 10/20/30, V23 web 20 and Config Core 10 (uses app_private.t404_cfg_manager_tenant).
--   public.workspace_profiles  one row per Store: free industry name, any mix of modules
--       (shop | artist | service | education), how customers are called. Read by Store members (RLS).
--   public.save_workspace_profile(p_store, p_label, p_modules, p_people_label)  owner only.
--       tenants.industry and store_id are not changed.
--   public.store_briefing_settings  one row per Store; read by owner/manager (RLS); no direct writes
--   public.save_briefing_settings(p_store, p_opt_in, p_send_time, p_destination, p_metrics)
--       owner/manager. Saves preferences only: NOTHING is sent. status stays 'awaiting_sender'
--       until a sender is separately approved and built.
-- Rollback: 90_workspace_settings_rollback.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regprocedure('app_private.t404_cfg_manager_tenant(uuid)') IS NULL THEN RAISE EXCEPTION 'T404_V25_PRECHECK_CONFIG_CORE_MISSING'; END IF;
 IF to_regprocedure('public.register_shop(text,text)') IS NULL THEN RAISE EXCEPTION 'T404_V25_PRECHECK_V23_MISSING'; END IF;
 IF to_regclass('public.workspace_profiles') IS NOT NULL THEN RAISE EXCEPTION 'T404_V25_ALREADY_APPLIED'; END IF;
END $pre$;

-- 1. Workspace profile (owner only): free industry name + any mix of modules + how customers are called.
CREATE TABLE public.workspace_profiles(
 store_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 2 AND 60),
 modules text[] NOT NULL DEFAULT '{}' CHECK (modules <@ ARRAY['shop','artist','service','education']::text[]),
 people_label text NOT NULL CHECK (char_length(btrim(people_label)) BETWEEN 2 AND 40),
 updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT workspace_profiles_store_fk FOREIGN KEY (tenant_id, store_id) REFERENCES public.stores(tenant_id, id) ON DELETE RESTRICT
);
REVOKE ALL ON public.workspace_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.workspace_profiles TO authenticated;
GRANT ALL ON public.workspace_profiles TO service_role;
ALTER TABLE public.workspace_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_profiles_member_read ON public.workspace_profiles FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.store_memberships sm
   JOIN public.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id AND s.active
   JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
   WHERE sm.tenant_id=workspace_profiles.tenant_id AND sm.store_id=workspace_profiles.store_id
     AND sm.user_id=(SELECT auth.uid()) AND sm.active));

CREATE FUNCTION public.save_workspace_profile(p_store uuid, p_label text, p_modules text[], p_people_label text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_cfg_manager_tenant(p_store); m text[]; lb text := btrim(coalesce(p_label,'')); pl text := btrim(coalesce(p_people_label,''));
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships x WHERE x.tenant_id=tid AND x.user_id=auth.uid() AND x.active AND x.role='owner')
  OR NOT EXISTS (SELECT 1 FROM public.store_memberships sm WHERE sm.tenant_id=tid AND sm.store_id=p_store AND sm.user_id=auth.uid() AND sm.active AND sm.role='owner') THEN
  RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO m FROM unnest(coalesce(p_modules,'{}')) x;
 IF char_length(lb) NOT BETWEEN 2 AND 60 OR char_length(pl) NOT BETWEEN 2 AND 40
  OR NOT (m <@ ARRAY['shop','artist','service','education']::text[]) THEN
  RAISE EXCEPTION 'invalid_profile' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.workspace_profiles AS w(store_id,tenant_id,label,modules,people_label,updated_by,updated_at)
  VALUES (p_store,tid,lb,m,pl,auth.uid(),now())
  ON CONFLICT (store_id) DO UPDATE SET label=EXCLUDED.label, modules=EXCLUDED.modules, people_label=EXCLUDED.people_label,
   updated_by=EXCLUDED.updated_by, updated_at=now();
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,auth.uid(),'workspace_profile_save',jsonb_build_object('store_id',p_store,'label',lb,'modules',to_jsonb(m)));
END $f$;
REVOKE ALL ON FUNCTION public.save_workspace_profile(uuid,text,text[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workspace_profile(uuid,text,text[],text) TO authenticated;

-- 2. Daily briefing preferences (saved only; no sender) -----------------------------------
CREATE TABLE public.store_briefing_settings(
 store_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 opt_in boolean NOT NULL DEFAULT false,
 send_time time NOT NULL DEFAULT '07:30',
 timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh' CHECK (timezone='Asia/Ho_Chi_Minh'),
 destination text NOT NULL DEFAULT 'email' CHECK (destination IN ('email','telegram','zalo')),
 metrics text[] NOT NULL DEFAULT '{}' CHECK (cardinality(metrics) <= 20),
 status text NOT NULL DEFAULT 'awaiting_sender' CHECK (status IN ('awaiting_sender')),
 updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT store_briefing_settings_store_fk FOREIGN KEY (tenant_id, store_id) REFERENCES public.stores(tenant_id, id) ON DELETE RESTRICT
);
REVOKE ALL ON public.store_briefing_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.store_briefing_settings TO authenticated;
GRANT ALL ON public.store_briefing_settings TO service_role;
ALTER TABLE public.store_briefing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_briefing_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY store_briefing_settings_manager_read ON public.store_briefing_settings FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.store_memberships sm
   JOIN public.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id AND s.active
   JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
   WHERE sm.tenant_id=store_briefing_settings.tenant_id AND sm.store_id=store_briefing_settings.store_id
     AND sm.user_id=(SELECT auth.uid()) AND sm.active AND sm.role IN ('owner','manager')));

CREATE FUNCTION public.save_briefing_settings(p_store uuid, p_opt_in boolean, p_send_time time, p_destination text, p_metrics text[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_cfg_manager_tenant(p_store); m text[];
BEGIN
 IF p_opt_in IS NULL OR p_send_time IS NULL OR p_destination IS NULL OR p_destination NOT IN ('email','telegram','zalo') THEN
  RAISE EXCEPTION 'invalid_briefing' USING ERRCODE='22023';
 END IF;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO m FROM unnest(coalesce(p_metrics,'{}')) x;
 IF cardinality(m) > 20 OR EXISTS (SELECT 1 FROM unnest(m) x WHERE x !~ '^[a-z][a-z_]{1,39}$') THEN
  RAISE EXCEPTION 'invalid_briefing' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.store_briefing_settings AS b(store_id,tenant_id,opt_in,send_time,destination,metrics,updated_by,updated_at)
  VALUES (p_store,tid,p_opt_in,date_trunc('minute',p_send_time)::time,p_destination,m,auth.uid(),now())
  ON CONFLICT (store_id) DO UPDATE SET opt_in=EXCLUDED.opt_in, send_time=EXCLUDED.send_time,
   destination=EXCLUDED.destination, metrics=EXCLUDED.metrics, updated_by=EXCLUDED.updated_by, updated_at=now();
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,auth.uid(),'briefing_settings_save',jsonb_build_object('store_id',p_store,'opt_in',p_opt_in,'destination',p_destination));
END $f$;
REVOKE ALL ON FUNCTION public.save_briefing_settings(uuid,boolean,time,text,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_briefing_settings(uuid,boolean,time,text,text[]) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.save_workspace_profile(uuid,text,text[],text)','EXECUTE')
  OR has_function_privilege('anon','public.save_briefing_settings(uuid,boolean,time,text,text[])','EXECUTE') THEN RAISE EXCEPTION 'T404_V25_POST_ANON_EXEC'; END IF;
 IF has_table_privilege('authenticated','public.store_briefing_settings','INSERT')
  OR has_table_privilege('authenticated','public.store_briefing_settings','UPDATE')
  OR has_table_privilege('anon','public.store_briefing_settings','SELECT')
  OR has_table_privilege('authenticated','public.workspace_profiles','INSERT')
  OR has_table_privilege('authenticated','public.workspace_profiles','UPDATE')
  OR has_table_privilege('anon','public.workspace_profiles','SELECT') THEN RAISE EXCEPTION 'T404_V25_POST_DIRECT_WRITE'; END IF;
 RAISE NOTICE 'T404_V25_WORKSPACE_SETTINGS_OK';
END $post$;
COMMIT;
