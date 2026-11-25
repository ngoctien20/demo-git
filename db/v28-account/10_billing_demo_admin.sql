-- TIEN404 V28 Account — DEMO plan billing + platform Admin. STATUS: APPLIED 2026-11-25 (owner-approved) on restore-test, then staging (migration 20261125225107); hosted UAT 22/22 rolled back, residue 0.
-- REQUIRES V20 10+20+30 and V23 web 10+20+30 (stores, store_memberships, store_bot_settings, audit_events).
--
-- A. Gói và thanh toán (DEMO ONLY — no money moves, no bank data is stored):
--    public.billing_demo_subscriptions  one row per Store: plan trial|lite|plus|pro, cycle, status, renews_at
--    public.billing_demo_invoices       sample invoices. is_demo is forced TRUE by a CHECK; amounts come from
--                                       app_private.billing_demo_price (server side, the browser cannot set them)
--    RPCs: billing_demo_state (any active member) / billing_demo_checkout, billing_demo_confirm,
--          billing_demo_void, billing_demo_cancel (Store OWNER only). "confirm" only SIMULATES a payment.
--    No direct table access for anon/authenticated: everything goes through the RPCs above.
--
-- B. Platform Admin (separate from shop roles — a shop owner is NEVER an admin by being an owner):
--    app_private.platform_admins   who is a platform admin. Not readable by anon/authenticated.
--                                  Rows are added by hand in the SQL Editor (see docs/v28-account/README.md).
--    app_private.account_locks     locked accounts (reason, who, when)
--    public.is_platform_admin()    true/false for the caller only
--    public.admin_overview()       all stores + accounts, plan/demo payment state, bot on/off (admin only)
--    public.admin_set_account_lock(user, locked, reason)  admin only; sets auth.users.banned_until
--                                  (Supabase Auth then refuses sign-in and token refresh). Cannot lock
--                                  yourself or another admin.
--    public.admin_set_store_bot(store, enabled)  admin only; flips store_bot_settings.bot_enabled.
--                                  NOTE: the live n8n bots do not read bot_enabled yet.
-- Rollback: 90_billing_demo_admin_rollback.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regclass('public.store_bot_settings') IS NULL THEN RAISE EXCEPTION 'T404_V28_PRECHECK_V23_30_MISSING'; END IF;
 IF to_regclass('public.billing_demo_subscriptions') IS NOT NULL OR to_regclass('app_private.platform_admins') IS NOT NULL THEN
  RAISE EXCEPTION 'T404_V28_ALREADY_APPLIED';
 END IF;
END $pre$;

-- ---------- shared checks ----------
-- Active member (any role) of an active Store. Returns tenant id and the role.
CREATE FUNCTION app_private.t404_store_member(p_store uuid, OUT tenant_id uuid, OUT role text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 SELECT s.tenant_id, sm.role INTO tenant_id, role
 FROM public.stores s
 JOIN public.store_memberships sm ON sm.tenant_id=s.tenant_id AND sm.store_id=s.id AND sm.active
 JOIN public.tenant_memberships m ON m.tenant_id=sm.tenant_id AND m.user_id=sm.user_id AND m.active
 WHERE s.id=p_store AND s.active AND sm.user_id=auth.uid();
 IF auth.uid() IS NULL OR tenant_id IS NULL OR NOT app_private.t404_qa_tenant_allowed(tenant_id) THEN
  RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
 END IF;
END $f$;
CREATE FUNCTION app_private.t404_store_owner_tenant(p_store uuid) RETURNS uuid
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE r record;
BEGIN
 SELECT * INTO r FROM app_private.t404_store_member(p_store);
 IF r.role <> 'owner' THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 RETURN r.tenant_id;
END $f$;

-- ---------- A. DEMO billing ----------
CREATE FUNCTION app_private.billing_demo_price(p_plan text, p_cycle text) RETURNS integer
 LANGUAGE sql IMMUTABLE SET search_path='' AS $f$
 SELECT (CASE p_plan WHEN 'lite' THEN 99000 WHEN 'plus' THEN 299000 WHEN 'pro' THEN 699000 END)
        * (CASE p_cycle WHEN 'month' THEN 1 WHEN 'year' THEN 10 END) $f$;

CREATE TABLE public.billing_demo_subscriptions(
 store_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','lite','plus','pro')),
 cycle text NOT NULL DEFAULT 'month' CHECK (cycle IN ('month','year')),
 status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','canceled')),
 renews_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 FOREIGN KEY (tenant_id, store_id) REFERENCES public.stores(tenant_id, id) ON DELETE RESTRICT
);
CREATE TABLE public.billing_demo_invoices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 number text NOT NULL UNIQUE,
 plan text NOT NULL CHECK (plan IN ('lite','plus','pro')),
 cycle text NOT NULL CHECK (cycle IN ('month','year')),
 amount_vnd integer NOT NULL CHECK (amount_vnd BETWEEN 0 AND 100000000),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','void')),
 transfer_note text NOT NULL CHECK (transfer_note ~ '^T404DEMO [A-Z0-9-]{4,32}$'),
 is_demo boolean NOT NULL DEFAULT true CHECK (is_demo),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz,
 FOREIGN KEY (tenant_id, store_id) REFERENCES public.stores(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX billing_demo_invoices_store_idx ON public.billing_demo_invoices(store_id, created_at DESC);
REVOKE ALL ON public.billing_demo_subscriptions, public.billing_demo_invoices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.billing_demo_subscriptions, public.billing_demo_invoices TO service_role;
ALTER TABLE public.billing_demo_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_demo_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_demo_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_demo_invoices FORCE ROW LEVEL SECURITY;

CREATE FUNCTION app_private.billing_demo_json(p_store uuid) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT jsonb_build_object(
  'demo', true,
  'subscription', coalesce((SELECT jsonb_build_object('plan',s.plan,'cycle',s.cycle,'status',s.status,'renews_at',s.renews_at,'updated_at',s.updated_at)
     FROM public.billing_demo_subscriptions s WHERE s.store_id=p_store),
     jsonb_build_object('plan','trial','cycle','month','status','trial','renews_at',NULL,'updated_at',NULL)),
  'invoices', coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'number',i.number,'plan',i.plan,'cycle',i.cycle,'amount_vnd',i.amount_vnd,
     'status',i.status,'transfer_note',i.transfer_note,'created_at',i.created_at,'paid_at',i.paid_at) ORDER BY i.created_at DESC)
     FROM (SELECT * FROM public.billing_demo_invoices WHERE store_id=p_store ORDER BY created_at DESC LIMIT 24) i), '[]'::jsonb)) $f$;

CREATE FUNCTION public.billing_demo_state(p_store uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 PERFORM app_private.t404_store_member(p_store);
 RETURN app_private.billing_demo_json(p_store);
END $f$;

CREATE FUNCTION public.billing_demo_checkout(p_store uuid, p_plan text, p_cycle text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_store_owner_tenant(p_store); amt integer; num text; inv uuid;
BEGIN
 amt := app_private.billing_demo_price(p_plan, p_cycle);
 IF amt IS NULL THEN RAISE EXCEPTION 'invalid_plan' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.billing_demo_invoices WHERE store_id=p_store AND created_at > now() - interval '1 day') >= 20 THEN
  RAISE EXCEPTION 'rate_limited' USING ERRCODE='P0001';
 END IF;
 -- one open sample invoice at a time
 UPDATE public.billing_demo_invoices SET status='void' WHERE store_id=p_store AND status='pending';
 num := 'HD-DEMO-' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh','YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text),1,6));
 INSERT INTO public.billing_demo_invoices(tenant_id,store_id,number,plan,cycle,amount_vnd,transfer_note,created_by)
 VALUES (tid,p_store,num,p_plan,p_cycle,amt,'T404DEMO ' || substr(num,9),auth.uid()) RETURNING id INTO inv;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,auth.uid(),'billing_demo_checkout',jsonb_build_object('store_id',p_store,'invoice',inv,'plan',p_plan,'cycle',p_cycle,'demo',true));
 RETURN app_private.billing_demo_json(p_store);
END $f$;

-- SIMULATES a payment. Nothing is checked with a bank: this exists only for the DEMO.
CREATE FUNCTION public.billing_demo_confirm(p_store uuid, p_invoice uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_store_owner_tenant(p_store); i record; base timestamptz;
BEGIN
 UPDATE public.billing_demo_invoices SET status='paid', paid_at=now()
 WHERE id=p_invoice AND store_id=p_store AND status='pending' RETURNING * INTO i;
 IF i IS NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='invoice_not_pending'; END IF;
 SELECT CASE WHEN s.status='active' AND s.plan=i.plan AND s.cycle=i.cycle AND s.renews_at > now() THEN s.renews_at ELSE now() END
   INTO base FROM public.billing_demo_subscriptions s WHERE s.store_id=p_store;
 base := coalesce(base, now());
 INSERT INTO public.billing_demo_subscriptions(store_id,tenant_id,plan,cycle,status,renews_at,updated_by)
 VALUES (p_store,tid,i.plan,i.cycle,'active',base + CASE i.cycle WHEN 'year' THEN interval '1 year' ELSE interval '1 month' END,auth.uid())
 ON CONFLICT (store_id) DO UPDATE SET plan=excluded.plan, cycle=excluded.cycle, status='active', renews_at=excluded.renews_at,
   updated_at=now(), updated_by=excluded.updated_by;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,auth.uid(),'billing_demo_confirm',jsonb_build_object('store_id',p_store,'invoice',p_invoice,'demo',true));
 RETURN app_private.billing_demo_json(p_store);
END $f$;

CREATE FUNCTION public.billing_demo_void(p_store uuid, p_invoice uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_store_owner_tenant(p_store);
BEGIN
 UPDATE public.billing_demo_invoices SET status='void' WHERE id=p_invoice AND store_id=p_store AND status='pending';
 IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='invoice_not_pending'; END IF;
 RETURN app_private.billing_demo_json(p_store);
END $f$;

CREATE FUNCTION public.billing_demo_cancel(p_store uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid := app_private.t404_store_owner_tenant(p_store);
BEGIN
 UPDATE public.billing_demo_subscriptions SET status='canceled', updated_at=now(), updated_by=auth.uid()
 WHERE store_id=p_store AND status='active';
 IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='nothing_to_cancel'; END IF;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,auth.uid(),'billing_demo_cancel',jsonb_build_object('store_id',p_store,'demo',true));
 RETURN app_private.billing_demo_json(p_store);
END $f$;

-- ---------- B. Platform Admin ----------
CREATE TABLE app_private.platform_admins(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 note text CHECK (length(note) <= 200),
 added_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.account_locks(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 300),
 locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 locked_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_private.platform_admins, app_private.account_locks FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.is_platform_admin() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM app_private.platform_admins a WHERE a.user_id=auth.uid()) $f$;

CREATE FUNCTION app_private.t404_require_admin() RETURNS void
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
END $f$;

CREATE FUNCTION public.admin_overview() RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 PERFORM app_private.t404_require_admin();
 RETURN jsonb_build_object(
  'generated_at', now(),
  'stores', coalesce((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
    SELECT jsonb_build_object(
     'store_id', s.id, 'store_name', s.name, 'tenant_name', t.name, 'active', s.active, 'created_at', s.created_at,
     'owner_id', o.user_id, 'owner_email', u.email, 'owner_locked', (o.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM app_private.account_locks l WHERE l.user_id=o.user_id)),
     'members', (SELECT count(*) FROM public.store_memberships m WHERE m.store_id=s.id AND m.active),
     'plan', coalesce(b.plan,'trial'), 'plan_status', coalesce(b.status,'trial'), 'renews_at', b.renews_at,
     'last_invoice_status', (SELECT i.status FROM public.billing_demo_invoices i WHERE i.store_id=s.id ORDER BY i.created_at DESC LIMIT 1),
     'pending_invoices', (SELECT count(*) FROM public.billing_demo_invoices i WHERE i.store_id=s.id AND i.status='pending'),
     'paid_demo_vnd', (SELECT coalesce(sum(i.amount_vnd),0) FROM public.billing_demo_invoices i WHERE i.store_id=s.id AND i.status='paid'),
     'bot_enabled', bs.bot_enabled,
     'products', (SELECT count(*) FROM public.products p WHERE p.store_id=s.id),
     'orders_7d', (SELECT count(*) FROM public.orders od WHERE od.store_id=s.id AND od.created_at > now() - interval '7 days')) AS x
    FROM public.stores s
    JOIN public.tenants t ON t.id=s.tenant_id
    LEFT JOIN LATERAL (SELECT m.user_id FROM public.store_memberships m WHERE m.store_id=s.id AND m.role='owner' AND m.active ORDER BY m.created_at LIMIT 1) o ON true
    LEFT JOIN auth.users u ON u.id=o.user_id
    LEFT JOIN public.billing_demo_subscriptions b ON b.store_id=s.id
    LEFT JOIN public.store_bot_settings bs ON bs.store_id=s.id AND bs.tenant_id=s.tenant_id
    ORDER BY s.created_at DESC LIMIT 500) q), '[]'::jsonb),
  'accounts', coalesce((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
    SELECT jsonb_build_object(
     'user_id', u.id, 'email', u.email, 'created_at', (to_jsonb(u)->>'created_at'), 'last_sign_in_at', (to_jsonb(u)->>'last_sign_in_at'),
     'email_confirmed', (to_jsonb(u)->>'email_confirmed_at') IS NOT NULL,
     'is_admin', EXISTS (SELECT 1 FROM app_private.platform_admins a WHERE a.user_id=u.id),
     'locked', l.user_id IS NOT NULL, 'lock_reason', l.reason, 'locked_at', l.locked_at,
     'stores', (SELECT count(*) FROM public.store_memberships m WHERE m.user_id=u.id AND m.active)) AS x
    FROM auth.users u LEFT JOIN app_private.account_locks l ON l.user_id=u.id
    ORDER BY (to_jsonb(u)->>'created_at') DESC NULLS LAST LIMIT 500) q), '[]'::jsonb));
END $f$;

CREATE FUNCTION public.admin_set_account_lock(p_user uuid, p_locked boolean, p_reason text) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 PERFORM app_private.t404_require_admin();
 IF p_user IS NULL OR p_locked IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user) THEN
  RAISE EXCEPTION 'invalid_account' USING ERRCODE='22023';
 END IF;
 IF p_user = auth.uid() THEN RAISE EXCEPTION 'cannot_lock_self' USING ERRCODE='22023'; END IF;
 IF p_locked AND EXISTS (SELECT 1 FROM app_private.platform_admins WHERE user_id=p_user) THEN
  RAISE EXCEPTION 'cannot_lock_admin' USING ERRCODE='22023';
 END IF;
 IF p_locked THEN
  IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 300 THEN RAISE EXCEPTION 'invalid_reason' USING ERRCODE='22023'; END IF;
  INSERT INTO app_private.account_locks(user_id,reason,locked_by) VALUES (p_user,btrim(p_reason),auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET reason=excluded.reason, locked_by=excluded.locked_by, locked_at=now();
  UPDATE auth.users SET banned_until='infinity' WHERE id=p_user;
 ELSE
  DELETE FROM app_private.account_locks WHERE user_id=p_user;
  UPDATE auth.users SET banned_until=NULL WHERE id=p_user;
 END IF;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (NULL,auth.uid(),CASE WHEN p_locked THEN 'admin_account_lock' ELSE 'admin_account_unlock' END,
          jsonb_build_object('user_id',p_user,'reason',left(coalesce(p_reason,''),300)));
 RETURN p_locked;
END $f$;

CREATE FUNCTION public.admin_set_store_bot(p_store uuid, p_enabled boolean) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid;
BEGIN
 PERFORM app_private.t404_require_admin();
 SELECT tenant_id INTO tid FROM public.stores WHERE id=p_store;
 IF tid IS NULL OR p_enabled IS NULL THEN RAISE EXCEPTION 'invalid_store' USING ERRCODE='22023'; END IF;
 INSERT INTO public.store_bot_settings(tenant_id,store_id,bot_enabled,updated_by) VALUES (tid,p_store,p_enabled,auth.uid())
 ON CONFLICT (tenant_id,store_id) DO UPDATE SET bot_enabled=excluded.bot_enabled, updated_by=excluded.updated_by,
   updated_at=greatest(clock_timestamp(), public.store_bot_settings.updated_at + interval '1 microsecond');
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,auth.uid(),'admin_store_bot',jsonb_build_object('store_id',p_store,'bot_enabled',p_enabled));
 RETURN p_enabled;
END $f$;

-- ---------- grants ----------
DO $g$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['app_private.t404_store_member(uuid)','app_private.t404_store_owner_tenant(uuid)',
   'app_private.billing_demo_price(text,text)','app_private.billing_demo_json(uuid)','app_private.t404_require_admin()'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
 END LOOP;
 FOREACH f IN ARRAY ARRAY[
   'public.billing_demo_state(uuid)','public.billing_demo_checkout(uuid,text,text)','public.billing_demo_confirm(uuid,uuid)',
   'public.billing_demo_void(uuid,uuid)','public.billing_demo_cancel(uuid)','public.is_platform_admin()','public.admin_overview()',
   'public.admin_set_account_lock(uuid,boolean,text)','public.admin_set_store_bot(uuid,boolean)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  IF has_function_privilege('anon', f, 'EXECUTE') THEN RAISE EXCEPTION 'T404_V28_POST_ANON_EXEC %', f; END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public.billing_demo_invoices','SELECT') OR has_table_privilege('authenticated','public.billing_demo_subscriptions','UPDATE')
    OR has_table_privilege('authenticated','app_private.platform_admins','SELECT') OR has_table_privilege('authenticated','app_private.account_locks','SELECT') THEN
  RAISE EXCEPTION 'T404_V28_POST_DIRECT_ACCESS';
 END IF;
 RAISE NOTICE 'T404_V28_ACCOUNT_OK';
END $g$;
COMMIT;
