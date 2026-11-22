-- TIEN404 V23 web — owner App: bot settings, FAQ knowledge, customer stages. STATUS: PROPOSED (not applied).
-- REQUIRES V20 10+20+30 and V23 20 (uses app_private.t404_qa_tenant_allowed).
-- Adds (all store-scoped, RLS read for active Store members, writes ONLY through RPCs, owner/manager):
--   public.store_bot_settings  one row per Store: shop info, forbidden promises, tone, bot on/off, order e-mails
--   public.store_faqs          question/answer knowledge, max 200 per Store
--   customers.stage/follow_up_at/note  pipeline: new, consulting, hot, won, lost, needs_human
--   public.set_product_stock   owner/manager sets stock_on_hand (audited, optimistic concurrency)
-- The live n8n bots do NOT read these yet (Phase 3). Saving here changes nothing for customers today.
-- Rollback: 70_store_bot_settings_rollback.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regprocedure('public.register_shop(text,text)') IS NULL THEN RAISE EXCEPTION 'T404_V23_PRECHECK_20_MISSING'; END IF;
 IF to_regclass('public.store_bot_settings') IS NOT NULL THEN RAISE EXCEPTION 'T404_V23_PRECHECK_30_ALREADY_APPLIED'; END IF;
END $pre$;

-- Shared check: caller is an active owner/manager of an active Store in an allowed tenant. Returns tenant id.
CREATE FUNCTION app_private.t404_store_manager_tenant(p_store uuid) RETURNS uuid
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid;
BEGIN
 SELECT s.tenant_id INTO tid FROM public.stores s WHERE s.id=p_store AND s.active;
 IF auth.uid() IS NULL OR tid IS NULL OR NOT app_private.t404_qa_tenant_allowed(tid) OR NOT EXISTS (
   SELECT 1 FROM public.store_memberships sm
   JOIN public.tenant_memberships m ON m.tenant_id=sm.tenant_id AND m.user_id=sm.user_id AND m.active
   WHERE sm.tenant_id=tid AND sm.store_id=p_store AND sm.user_id=auth.uid() AND sm.active AND sm.role IN ('owner','manager')) THEN
  RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
 END IF;
 RETURN tid;
END $f$;
REVOKE ALL ON FUNCTION app_private.t404_store_manager_tenant(uuid) FROM PUBLIC, anon, authenticated;

-- Read policy body reused below: active member of an active Store with an active tenant membership.
CREATE TABLE public.store_bot_settings(
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 shop_info text NOT NULL DEFAULT '' CHECK (length(shop_info) <= 4000),
 forbidden_promises text NOT NULL DEFAULT '' CHECK (length(forbidden_promises) <= 2000),
 tone text NOT NULL DEFAULT 'polite' CHECK (tone IN ('polite','friendly','cute')),
 bot_enabled boolean NOT NULL DEFAULT true,
 notify_emails text[] NOT NULL DEFAULT '{}' CHECK (cardinality(notify_emails) <= 5),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 PRIMARY KEY (tenant_id, store_id),
 FOREIGN KEY (tenant_id, store_id) REFERENCES public.stores(tenant_id, id) ON DELETE RESTRICT
);
CREATE TABLE public.store_faqs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 question text NOT NULL CHECK (length(btrim(question)) BETWEEN 2 AND 300),
 answer text NOT NULL CHECK (length(btrim(answer)) BETWEEN 1 AND 3000),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id, store_id) REFERENCES public.stores(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX store_faqs_store_idx ON public.store_faqs(tenant_id, store_id, created_at);

ALTER TABLE public.customers ADD COLUMN stage text NOT NULL DEFAULT 'new'
  CHECK (stage IN ('new','consulting','hot','won','lost','needs_human'));
ALTER TABLE public.customers ADD COLUMN follow_up_at timestamptz;
ALTER TABLE public.customers ADD COLUMN note text CHECK (note IS NULL OR length(note) <= 1000);

DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['store_bot_settings','store_faqs'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  EXECUTE format($p$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.store_memberships sm
    JOIN public.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id AND s.active
    JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
    WHERE sm.tenant_id=%I.tenant_id AND sm.store_id=%I.store_id AND sm.user_id=(SELECT auth.uid()) AND sm.active))$p$,
    t||'_store_member_read', t, t, t);
 END LOOP;
END $rls$;

CREATE FUNCTION public.save_store_bot_settings(p_store uuid, p_shop_info text, p_forbidden text, p_tone text,
  p_bot_enabled boolean, p_notify_emails text[], p_expected_updated_at timestamptz)
 RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_store_manager_tenant(p_store); changed timestamptz; e text; emails text[] := '{}';
BEGIN
 IF p_tone IS NULL OR p_tone NOT IN ('polite','friendly','cute') OR p_bot_enabled IS NULL
    OR length(coalesce(p_shop_info,'')) > 4000 OR length(coalesce(p_forbidden,'')) > 2000
    OR cardinality(coalesce(p_notify_emails,'{}')) > 5 THEN
  RAISE EXCEPTION 'invalid_settings' USING ERRCODE='22023';
 END IF;
 FOREACH e IN ARRAY coalesce(p_notify_emails,'{}') LOOP
  e := lower(btrim(e));
  IF length(e) > 200 OR e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'invalid_email' USING ERRCODE='22023'; END IF;
  IF NOT e = ANY(emails) THEN emails := emails || e; END IF;
 END LOOP;
 IF p_expected_updated_at IS NULL THEN
  INSERT INTO public.store_bot_settings(tenant_id,store_id,shop_info,forbidden_promises,tone,bot_enabled,notify_emails,updated_by)
  VALUES (tid,p_store,coalesce(p_shop_info,''),coalesce(p_forbidden,''),p_tone,p_bot_enabled,emails,auth.uid())
  ON CONFLICT (tenant_id,store_id) DO NOTHING RETURNING updated_at INTO changed;
 ELSE
  UPDATE public.store_bot_settings SET shop_info=coalesce(p_shop_info,''), forbidden_promises=coalesce(p_forbidden,''),
    tone=p_tone, bot_enabled=p_bot_enabled, notify_emails=emails, updated_by=auth.uid(),
    updated_at=greatest(clock_timestamp(), updated_at + interval '1 microsecond')
  WHERE tenant_id=tid AND store_id=p_store AND updated_at=p_expected_updated_at RETURNING updated_at INTO changed;
 END IF;
 IF changed IS NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='settings_changed'; END IF;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,auth.uid(),'bot_settings_save',jsonb_build_object('store_id',p_store,'bot_enabled',p_bot_enabled,'tone',p_tone));
 RETURN changed;
END $f$;

CREATE FUNCTION public.save_store_faq(p_store uuid, p_id uuid, p_question text, p_answer text, p_active boolean)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_store_manager_tenant(p_store); fid uuid;
BEGIN
 IF length(btrim(coalesce(p_question,''))) NOT BETWEEN 2 AND 300 OR length(btrim(coalesce(p_answer,''))) NOT BETWEEN 1 AND 3000 OR p_active IS NULL THEN
  RAISE EXCEPTION 'invalid_faq' USING ERRCODE='22023';
 END IF;
 IF p_id IS NULL THEN
  IF (SELECT count(*) FROM public.store_faqs f WHERE f.tenant_id=tid AND f.store_id=p_store) >= 200 THEN
   RAISE EXCEPTION 'faq_limit_reached' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.store_faqs(tenant_id,store_id,question,answer,active)
  VALUES (tid,p_store,btrim(p_question),btrim(p_answer),p_active) RETURNING id INTO fid;
 ELSE
  UPDATE public.store_faqs SET question=btrim(p_question), answer=btrim(p_answer), active=p_active, updated_at=clock_timestamp()
  WHERE id=p_id AND tenant_id=tid AND store_id=p_store RETURNING id INTO fid;
  IF fid IS NULL THEN RAISE EXCEPTION 'faq_not_found' USING ERRCODE='P0002'; END IF;
 END IF;
 RETURN fid;
END $f$;

CREATE FUNCTION public.delete_store_faq(p_store uuid, p_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_store_manager_tenant(p_store);
BEGIN
 DELETE FROM public.store_faqs WHERE id=p_id AND tenant_id=tid AND store_id=p_store;
 IF NOT FOUND THEN RAISE EXCEPTION 'faq_not_found' USING ERRCODE='P0002'; END IF;
END $f$;

CREATE FUNCTION public.set_customer_stage(p_store uuid, p_customer uuid, p_stage text, p_follow_up_at timestamptz, p_note text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_store_manager_tenant(p_store);
BEGIN
 IF p_stage IS NULL OR p_stage NOT IN ('new','consulting','hot','won','lost','needs_human') OR length(coalesce(p_note,'')) > 1000 THEN
  RAISE EXCEPTION 'invalid_stage' USING ERRCODE='22023';
 END IF;
 UPDATE public.customers SET stage=p_stage, follow_up_at=p_follow_up_at, note=nullif(btrim(p_note),'')
 WHERE id=p_customer AND tenant_id=tid AND store_id=p_store;
 IF NOT FOUND THEN RAISE EXCEPTION 'customer_not_found' USING ERRCODE='P0002'; END IF;
END $f$;

-- Stock is not editable through save_merchant_product_in_store (by design); owners/managers set it here,
-- with optimistic concurrency and an audit row (old -> new).
CREATE FUNCTION public.set_product_stock(p_store uuid, p_product uuid, p_new_stock integer, p_expected_updated_at timestamptz)
 RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_store_manager_tenant(p_store); old_stock integer; changed timestamptz;
BEGIN
 IF p_new_stock IS NULL OR p_new_stock < 0 OR p_new_stock > 10000000 OR p_expected_updated_at IS NULL THEN
  RAISE EXCEPTION 'invalid_stock' USING ERRCODE='22023';
 END IF;
 SELECT stock_on_hand INTO old_stock FROM public.products
  WHERE id=p_product AND tenant_id=tid AND store_id=p_store AND updated_at=p_expected_updated_at FOR UPDATE;
 IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='product_changed_or_missing'; END IF;
 UPDATE public.products SET stock_on_hand=p_new_stock, updated_at=greatest(clock_timestamp(), updated_at + interval '1 microsecond')
  WHERE id=p_product RETURNING updated_at INTO changed;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,auth.uid(),'product_stock_set',jsonb_build_object('store_id',p_store,'product_id',p_product,'old',old_stock,'new',p_new_stock));
 RETURN changed;
END $f$;

DO $g$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY[
   'public.save_store_bot_settings(uuid,text,text,text,boolean,text[],timestamptz)',
   'public.save_store_faq(uuid,uuid,text,text,boolean)',
   'public.delete_store_faq(uuid,uuid)',
   'public.set_customer_stage(uuid,uuid,text,timestamptz,text)',
   'public.set_product_stock(uuid,uuid,integer,timestamptz)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  IF has_function_privilege('anon', f, 'EXECUTE') THEN RAISE EXCEPTION 'T404_V23_POST_ANON_EXEC %', f; END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public.store_bot_settings','INSERT') OR has_table_privilege('authenticated','public.store_faqs','UPDATE')
    OR has_table_privilege('anon','public.store_faqs','SELECT') THEN RAISE EXCEPTION 'T404_V23_POST_DIRECT_WRITE'; END IF;
 RAISE NOTICE 'T404_V23_BOT_SETTINGS_OK';
END $g$;
COMMIT;
