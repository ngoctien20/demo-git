-- TIEN404 V25 Universal Workspace — owner settings. STATUS: PROPOSED (not applied anywhere).
-- REQUIRES V20 10/20/30, V23 web 20 and Config Core 10 (uses app_private.t404_cfg_manager_tenant).
--   public.set_workspace_industry(p_store, p_industry)  owner only; writes tenants.industry
--       (retail | artist | service | education | other). No schema change, no store_id change.
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
 IF to_regprocedure('public.set_workspace_industry(uuid,text)') IS NOT NULL THEN RAISE EXCEPTION 'T404_V25_ALREADY_APPLIED'; END IF;
END $pre$;

-- 1. Workspace industry (owner only) ------------------------------------------------------
CREATE FUNCTION public.set_workspace_industry(p_store uuid, p_industry text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_cfg_manager_tenant(p_store); old text;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=tid AND m.user_id=auth.uid() AND m.active AND m.role='owner')
  OR NOT EXISTS (SELECT 1 FROM public.store_memberships sm WHERE sm.tenant_id=tid AND sm.store_id=p_store AND sm.user_id=auth.uid() AND sm.active AND sm.role='owner') THEN
  RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
 END IF;
 IF p_industry IS NULL OR p_industry NOT IN ('retail','artist','service','education','other') THEN
  RAISE EXCEPTION 'invalid_industry' USING ERRCODE='22023';
 END IF;
 SELECT t.industry INTO old FROM public.tenants t WHERE t.id=tid FOR UPDATE;
 IF old IS DISTINCT FROM p_industry THEN
  UPDATE public.tenants SET industry=p_industry, updated_at=now() WHERE id=tid;
  INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
   VALUES (tid,auth.uid(),'workspace_industry_set',jsonb_build_object('store_id',p_store,'from',old,'to',p_industry));
 END IF;
 RETURN p_industry;
END $f$;
REVOKE ALL ON FUNCTION public.set_workspace_industry(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_workspace_industry(uuid,text) TO authenticated;

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
 IF has_function_privilege('anon','public.set_workspace_industry(uuid,text)','EXECUTE')
  OR has_function_privilege('anon','public.save_briefing_settings(uuid,boolean,time,text,text[])','EXECUTE') THEN RAISE EXCEPTION 'T404_V25_POST_ANON_EXEC'; END IF;
 IF has_table_privilege('authenticated','public.store_briefing_settings','INSERT')
  OR has_table_privilege('authenticated','public.store_briefing_settings','UPDATE')
  OR has_table_privilege('anon','public.store_briefing_settings','SELECT') THEN RAISE EXCEPTION 'T404_V25_POST_DIRECT_WRITE'; END IF;
 RAISE NOTICE 'T404_V25_WORKSPACE_SETTINGS_OK';
END $post$;
COMMIT;
