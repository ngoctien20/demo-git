-- TIEN404 V28.2 — Admin edits plans/prices + platform settings; admin handles invoices and shop plans.
-- STATUS: PROPOSED (not applied). REQUIRES db/v28-account/10 (applied on staging 20261125225107).
--
--   app_private.platform_plans      LITE / PLUS / PRO: name, monthly price, how many months a yearly payment costs,
--                                   tagline, "who it is for", features, highlighted, shown. Seeded with today's values.
--   app_private.platform_settings   one row: notice shown at the top of every shop's App + support contacts.
--   app_private.billing_demo_price  now READS platform_plans (hidden plan = cannot be bought). New invoices only;
--                                   old invoices keep their amount.
--   public.platform_catalog()       any signed-in user: shown plans + public settings (the owner App reads it).
--   Admin only (app_private.t404_require_admin):
--     admin_platform_config()                      all plans (also hidden) + settings + admin list
--     admin_save_plan(key, data jsonb)             validated; cannot hide the last shown plan
--     admin_save_settings(data jsonb)              validated
--     admin_invoices(status)                       invoices of every shop (DEMO)
--     admin_set_invoice(invoice, 'paid'|'void')    admin confirms money received (DEMO) or cancels
--     admin_set_store_plan(store, plan, cycle, until)  give / extend / reset a shop's plan
--   Every admin write goes to app_private.audit_events. No direct table access for anon/authenticated.
-- Rollback: 80_platform_catalog_admin_rollback.sql (restores the fixed-price billing_demo_price).
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regclass('app_private.platform_admins') IS NULL THEN RAISE EXCEPTION 'T404_V28_2_PRECHECK_V28_10_MISSING'; END IF;
 IF to_regclass('app_private.platform_plans') IS NOT NULL THEN RAISE EXCEPTION 'T404_V28_2_ALREADY_APPLIED'; END IF;
END $pre$;

CREATE TABLE app_private.platform_plans(
 key text PRIMARY KEY CHECK (key IN ('lite','plus','pro')),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 20),
 month_vnd integer NOT NULL CHECK (month_vnd BETWEEN 0 AND 5000000 AND month_vnd % 1000 = 0),
 year_months integer NOT NULL DEFAULT 10 CHECK (year_months BETWEEN 1 AND 12),
 tagline text NOT NULL DEFAULT '' CHECK (length(tagline) <= 120),
 who text NOT NULL DEFAULT '' CHECK (length(who) <= 120),
 features jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(features)='array' AND jsonb_array_length(features) <= 12),
 best boolean NOT NULL DEFAULT false,
 visible boolean NOT NULL DEFAULT true,
 sort integer NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO app_private.platform_plans(key,name,month_vnd,year_months,tagline,who,features,best,sort) VALUES
 ('lite','LITE',99000,10,'Dễ dùng, không cần rành máy','Shop nhỏ, chủ shop lớn tuổi',
  '["1 trợ lý AI trả lời khách 24/7","Nối bot Zalo bằng mã 6 số, làm ngay trên Zalo","Thẻ sản phẩm Messenger mẫu sẵn","Tối đa 100 sản phẩm","Báo đơn mới qua email"]',false,1),
 ('plus','PLUS',299000,10,'Tuỳ chỉnh sâu cho shop đang lớn','Shop bán đều mỗi ngày',
  '["Mọi thứ của LITE","Zalo + Messenger + chat trên web","Tự chỉnh menu, phong cách, thẻ sản phẩm","Kho kiến thức và câu hỏi thường gặp","Tối đa 1.000 sản phẩm, 3 nhân viên"]',true,2),
 ('pro','PRO',699000,10,'Nhiều chi nhánh, nhiều nhân viên','Chuỗi cửa hàng, thương hiệu',
  '["Mọi thứ của PLUS","Nhiều chi nhánh trong một tài khoản","Báo cáo doanh thu và khách quay lại","Không giới hạn sản phẩm, 10 nhân viên","Hỗ trợ ưu tiên"]',false,3);

CREATE TABLE app_private.platform_settings(
 id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
 notice text NOT NULL DEFAULT '' CHECK (length(notice) <= 300),
 support_zalo text NOT NULL DEFAULT '' CHECK (support_zalo ~ '^[0-9 +]{0,20}$'),
 support_phone text NOT NULL DEFAULT '' CHECK (support_phone ~ '^[0-9 +]{0,20}$'),
 support_email text NOT NULL DEFAULT '' CHECK (support_email = '' OR support_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(support_email) <= 120),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO app_private.platform_settings(id) VALUES (1);
REVOKE ALL ON app_private.platform_plans, app_private.platform_settings FROM PUBLIC, anon, authenticated;

-- Price now comes from the table. Hidden or unknown plan → NULL → checkout raises invalid_plan.
CREATE OR REPLACE FUNCTION app_private.billing_demo_price(p_plan text, p_cycle text) RETURNS integer
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT p.month_vnd * (CASE p_cycle WHEN 'month' THEN 1 WHEN 'year' THEN p.year_months END)
 FROM app_private.platform_plans p WHERE p.key=p_plan AND p.visible $f$;

CREATE FUNCTION app_private.platform_plans_json(p_all boolean) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',p.key,'name',p.name,'month_vnd',p.month_vnd,'year_months',p.year_months,
   'tagline',p.tagline,'who',p.who,'features',p.features,'best',p.best,'visible',p.visible,'updated_at',p.updated_at) ORDER BY p.sort),'[]'::jsonb)
 FROM app_private.platform_plans p WHERE p_all OR p.visible $f$;

CREATE FUNCTION public.platform_catalog() RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('plans', app_private.platform_plans_json(false),
  'settings', (SELECT jsonb_build_object('notice',s.notice,'support_zalo',s.support_zalo,'support_phone',s.support_phone,'support_email',s.support_email)
               FROM app_private.platform_settings s WHERE s.id=1));
END $f$;

CREATE FUNCTION public.admin_platform_config() RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 PERFORM app_private.t404_require_admin();
 RETURN jsonb_build_object('plans', app_private.platform_plans_json(true),
  'settings', (SELECT jsonb_build_object('notice',s.notice,'support_zalo',s.support_zalo,'support_phone',s.support_phone,
     'support_email',s.support_email,'updated_at',s.updated_at) FROM app_private.platform_settings s WHERE s.id=1),
  'admins', coalesce((SELECT jsonb_agg(jsonb_build_object('email',u.email,'note',a.note,'added_at',a.added_at) ORDER BY a.added_at)
     FROM app_private.platform_admins a JOIN auth.users u ON u.id=a.user_id),'[]'::jsonb));
END $f$;

CREATE FUNCTION public.admin_save_plan(p_key text, p_data jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE f jsonb; v boolean;
BEGIN
 PERFORM app_private.t404_require_admin();
 IF NOT EXISTS (SELECT 1 FROM app_private.platform_plans WHERE key=p_key) OR jsonb_typeof(p_data) <> 'object' THEN
  RAISE EXCEPTION 'invalid_plan' USING ERRCODE='22023';
 END IF;
 f := coalesce(p_data->'features','[]'::jsonb);
 IF jsonb_typeof(f) <> 'array' OR jsonb_array_length(f) > 12
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(f) e WHERE jsonb_typeof(e) <> 'string' OR length(btrim(e#>>'{}')) NOT BETWEEN 1 AND 120) THEN
  RAISE EXCEPTION 'invalid_features' USING ERRCODE='22023';
 END IF;
 IF jsonb_typeof(p_data->'month_vnd') <> 'number' OR jsonb_typeof(p_data->'year_months') <> 'number' THEN
  RAISE EXCEPTION 'invalid_price' USING ERRCODE='22023';
 END IF;
 v := coalesce((p_data->>'visible')::boolean, true);
 IF NOT v AND NOT EXISTS (SELECT 1 FROM app_private.platform_plans WHERE visible AND key <> p_key) THEN
  RAISE EXCEPTION 'last_visible_plan' USING ERRCODE='22023';
 END IF;
 BEGIN
  UPDATE app_private.platform_plans SET
   name=btrim(p_data->>'name'), month_vnd=(p_data->>'month_vnd')::integer, year_months=(p_data->>'year_months')::integer,
   tagline=btrim(coalesce(p_data->>'tagline','')), who=btrim(coalesce(p_data->>'who','')),
   features=(SELECT coalesce(jsonb_agg(to_jsonb(btrim(e#>>'{}'))),'[]'::jsonb) FROM jsonb_array_elements(f) e),
   best=coalesce((p_data->>'best')::boolean,false), visible=v, updated_at=now(), updated_by=auth.uid()
  WHERE key=p_key;
 EXCEPTION WHEN check_violation OR not_null_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'invalid_price' USING ERRCODE='22023';
 END;
 -- only one highlighted plan
 IF coalesce((p_data->>'best')::boolean,false) THEN UPDATE app_private.platform_plans SET best=false WHERE key <> p_key AND best; END IF;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (NULL,auth.uid(),'admin_save_plan',jsonb_build_object('plan',p_key,'month_vnd',p_data->'month_vnd','year_months',p_data->'year_months','visible',v));
 RETURN public.admin_platform_config();
END $f$;

CREATE FUNCTION public.admin_save_settings(p_data jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 PERFORM app_private.t404_require_admin();
 IF jsonb_typeof(p_data) <> 'object' THEN RAISE EXCEPTION 'invalid_settings' USING ERRCODE='22023'; END IF;
 BEGIN
  UPDATE app_private.platform_settings SET notice=btrim(coalesce(p_data->>'notice','')), support_zalo=btrim(coalesce(p_data->>'support_zalo','')),
   support_phone=btrim(coalesce(p_data->>'support_phone','')), support_email=lower(btrim(coalesce(p_data->>'support_email',''))),
   updated_at=now(), updated_by=auth.uid() WHERE id=1;
 EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'invalid_settings' USING ERRCODE='22023';
 END;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (NULL,auth.uid(),'admin_save_settings',jsonb_build_object('notice_len',length(coalesce(p_data->>'notice',''))));
 RETURN public.admin_platform_config();
END $f$;

CREATE FUNCTION public.admin_invoices(p_status text DEFAULT NULL) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 PERFORM app_private.t404_require_admin();
 RETURN coalesce((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
  SELECT jsonb_build_object('id',i.id,'number',i.number,'store_id',i.store_id,'store_name',s.name,'owner_email',u.email,
   'plan',i.plan,'cycle',i.cycle,'amount_vnd',i.amount_vnd,'status',i.status,'transfer_note',i.transfer_note,
   'created_at',i.created_at,'paid_at',i.paid_at) AS x
  FROM public.billing_demo_invoices i JOIN public.stores s ON s.id=i.store_id
  LEFT JOIN LATERAL (SELECT m.user_id FROM public.store_memberships m WHERE m.store_id=s.id AND m.role='owner' AND m.active ORDER BY m.created_at LIMIT 1) o ON true
  LEFT JOIN auth.users u ON u.id=o.user_id
  WHERE p_status IS NULL OR i.status=p_status
  ORDER BY i.created_at DESC LIMIT 300) q),'[]'::jsonb);
END $f$;

-- Admin confirms the money arrived (DEMO: nothing is checked with a bank) or cancels a pending invoice.
CREATE FUNCTION public.admin_set_invoice(p_invoice uuid, p_action text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE i record; base timestamptz;
BEGIN
 PERFORM app_private.t404_require_admin();
 IF p_action NOT IN ('paid','void') THEN RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023'; END IF;
 UPDATE public.billing_demo_invoices SET status=p_action, paid_at=CASE WHEN p_action='paid' THEN now() END
 WHERE id=p_invoice AND status='pending' RETURNING * INTO i;
 IF i IS NULL THEN RAISE SQLSTATE 'PT409' USING MESSAGE='invoice_not_pending'; END IF;
 IF p_action='paid' THEN
  SELECT CASE WHEN s.status='active' AND s.plan=i.plan AND s.cycle=i.cycle AND s.renews_at > now() THEN s.renews_at ELSE now() END
    INTO base FROM public.billing_demo_subscriptions s WHERE s.store_id=i.store_id;
  base := coalesce(base, now());
  INSERT INTO public.billing_demo_subscriptions(store_id,tenant_id,plan,cycle,status,renews_at,updated_by)
  VALUES (i.store_id,i.tenant_id,i.plan,i.cycle,'active',base + CASE i.cycle WHEN 'year' THEN interval '1 year' ELSE interval '1 month' END,auth.uid())
  ON CONFLICT (store_id) DO UPDATE SET plan=excluded.plan, cycle=excluded.cycle, status='active', renews_at=excluded.renews_at,
    updated_at=now(), updated_by=excluded.updated_by;
 END IF;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (i.tenant_id,auth.uid(),'admin_invoice_'||p_action,jsonb_build_object('store_id',i.store_id,'invoice',i.id,'demo',true));
 RETURN public.admin_invoices(NULL);
END $f$;

-- Give / extend / reset a shop's plan by hand (e.g. gift a month, move back to trial).
CREATE FUNCTION public.admin_set_store_plan(p_store uuid, p_plan text, p_cycle text, p_until timestamptz) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE tid uuid;
BEGIN
 PERFORM app_private.t404_require_admin();
 SELECT tenant_id INTO tid FROM public.stores WHERE id=p_store;
 IF tid IS NULL THEN RAISE EXCEPTION 'invalid_store' USING ERRCODE='22023'; END IF;
 IF p_plan NOT IN ('trial','lite','plus','pro') OR p_cycle NOT IN ('month','year') THEN RAISE EXCEPTION 'invalid_plan' USING ERRCODE='22023'; END IF;
 IF p_plan <> 'trial' AND (p_until IS NULL OR p_until <= now() OR p_until > now() + interval '3 years') THEN
  RAISE EXCEPTION 'invalid_until' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.billing_demo_subscriptions(store_id,tenant_id,plan,cycle,status,renews_at,updated_by)
 VALUES (p_store,tid,p_plan,p_cycle,CASE WHEN p_plan='trial' THEN 'trial' ELSE 'active' END,CASE WHEN p_plan='trial' THEN NULL ELSE p_until END,auth.uid())
 ON CONFLICT (store_id) DO UPDATE SET plan=excluded.plan, cycle=excluded.cycle, status=excluded.status, renews_at=excluded.renews_at,
   updated_at=now(), updated_by=excluded.updated_by;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,auth.uid(),'admin_set_store_plan',jsonb_build_object('store_id',p_store,'plan',p_plan,'cycle',p_cycle,'until',p_until));
 RETURN true;
END $f$;

DO $g$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['app_private.billing_demo_price(text,text)','app_private.platform_plans_json(boolean)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
 END LOOP;
 FOREACH f IN ARRAY ARRAY['public.platform_catalog()','public.admin_platform_config()','public.admin_save_plan(text,jsonb)',
   'public.admin_save_settings(jsonb)','public.admin_invoices(text)','public.admin_set_invoice(uuid,text)',
   'public.admin_set_store_plan(uuid,text,text,timestamptz)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  IF has_function_privilege('anon', f, 'EXECUTE') THEN RAISE EXCEPTION 'T404_V28_2_POST_ANON_EXEC %', f; END IF;
 END LOOP;
 IF has_table_privilege('authenticated','app_private.platform_plans','SELECT') OR has_table_privilege('authenticated','app_private.platform_settings','UPDATE') THEN
  RAISE EXCEPTION 'T404_V28_2_POST_DIRECT_ACCESS';
 END IF;
 RAISE NOTICE 'T404_V28_2_CATALOG_OK';
END $g$;
COMMIT;
