-- Hosted UAT for db/v23-web 10/20/30. Simulated JWT claims (SET LOCAL ROLE + request.jwt.claims),
-- two temporary confirmed users. EVERYTHING runs in one transaction that is ROLLED BACK:
-- no tenant, store, lead, FAQ, product, auth user or audit row survives. Prints PASS_/FAIL_ tags only.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE FUNCTION pg_temp.run_as(p_uid uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
 PERFORM set_config('request.jwt.claims', CASE WHEN p_uid IS NULL THEN '{"role":"anon"}'
   ELSE json_build_object('sub',p_uid,'role','authenticated')::text END, true);
 BEGIN
  EXECUTE CASE WHEN p_uid IS NULL THEN 'SET LOCAL ROLE anon' ELSE 'SET LOCAL ROLE authenticated' END;
  EXECUTE p_sql INTO r;
  EXECUTE 'RESET ROLE';
  RETURN coalesce(r,'<null>');
 EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  RETURN 'ERR:'||SQLERRM;
 END;
END $f$;
CREATE TEMP TABLE uat(n serial, tag text, ok boolean) ON COMMIT DROP;
CREATE FUNCTION pg_temp.chk(p_tag text, p_got text, p_want text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
 INSERT INTO uat(tag,ok) VALUES (p_tag, p_got = p_want OR (p_want LIKE 'ERR:%' AND p_got LIKE p_want||'%'));
END $f$;

DO $uat$
DECLARE
 ta uuid := '9c8c524c-88db-4771-8ab0-a4316298494c';
 u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); un uuid := gen_random_uuid();
 t1 text; t2 text; s1 uuid; s2 uuid; ts text; ts2 text; f1 text; pid uuid; pts text; cid uuid := gen_random_uuid();
 qa_main uuid; leads_before bigint;
BEGIN
 SELECT id INTO qa_main FROM public.stores WHERE tenant_id=ta AND is_default;
 SELECT count(*) INTO leads_before FROM app_private.web_leads;
 INSERT INTO auth.users(id,email,aud,role,email_confirmed_at) VALUES
  (u1,'t404-uat-v23a-'||left(u1::text,8)||'@qa.invalid','authenticated','authenticated',now()),
  (u2,'t404-uat-v23b-'||left(u2::text,8)||'@qa.invalid','authenticated','authenticated',now()),
  (un,'t404-uat-v23n-'||left(un::text,8)||'@qa.invalid','authenticated','authenticated',NULL);

 -- 10 leads
 PERFORM pg_temp.chk('ANON_SUBMIT_LEAD', pg_temp.run_as(NULL, 'SELECT public.submit_lead(''UAT'',''Shop UAT'',''+84 912 345 678'',NULL,''thoi-trang'',''dung-thu'',''Tôi muốn dùng thử'',''uat'')::text'), 'true');
 PERFORM pg_temp.chk('LEAD_PHONE_NORMALISED', (SELECT count(*)::text FROM app_private.web_leads WHERE phone='0912345678' AND source='uat'), '1');
 PERFORM pg_temp.chk('LEAD_INVALID_PHONE', pg_temp.run_as(NULL, 'SELECT public.submit_lead(''UAT'',NULL,''12345'',NULL,NULL,NULL,''Tin nhắn thử'',''uat'')::text'), 'ERR:invalid_lead');
 PERFORM pg_temp.chk('LEAD_NEEDS_CONTACT', pg_temp.run_as(NULL, 'SELECT public.submit_lead(''UAT'',NULL,NULL,NULL,NULL,NULL,''Tin nhắn thử'',''uat'')::text'), 'ERR:invalid_lead');
 PERFORM pg_temp.chk('ANON_CANNOT_READ_LEADS', pg_temp.run_as(NULL, 'SELECT count(*) FROM app_private.web_leads'), 'ERR:permission denied');
 PERFORM pg_temp.chk('AUTH_CANNOT_READ_LEADS', pg_temp.run_as(u1, 'SELECT count(*) FROM app_private.web_leads'), 'ERR:permission denied');
 FOR i IN 1..4 LOOP PERFORM pg_temp.run_as(NULL, 'SELECT public.submit_lead(''UAT'',NULL,''0912345678'',NULL,NULL,NULL,''Tin nhắn thử'',''uat'')::text'); END LOOP;
 PERFORM pg_temp.chk('LEAD_RATE_LIMIT', pg_temp.run_as(NULL, 'SELECT public.submit_lead(''UAT'',NULL,''0912345678'',NULL,NULL,NULL,''Tin nhắn thử'',''uat'')::text'), 'ERR:rate_limited');

 -- 20 register_shop
 PERFORM pg_temp.chk('ANON_REGISTER_DENIED', pg_temp.run_as(NULL, 'SELECT public.register_shop(''Shop'',''other'')::text'), 'ERR:permission denied');
 PERFORM pg_temp.chk('UNCONFIRMED_REGISTER_DENIED', pg_temp.run_as(un, 'SELECT public.register_shop(''Shop chưa xác nhận'',''other'')::text'), 'ERR:access_denied');
 PERFORM pg_temp.chk('SHORT_NAME_DENIED', pg_temp.run_as(u1, 'SELECT public.register_shop(''x'',''other'')::text'), 'ERR:invalid_shop');
 t1 := pg_temp.run_as(u1, 'SELECT public.register_shop(''UAT Shop Một'',''thoi-trang'')::text');
 PERFORM pg_temp.chk('REGISTER_SHOP_OK', (t1 ~ '^[0-9a-f-]{36}$')::text, 'true');
 IF t1 !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'T404_UAT_REGISTER_FAILED %', t1; END IF;
 PERFORM pg_temp.chk('SECOND_REGISTER_DENIED', pg_temp.run_as(u1, 'SELECT public.register_shop(''UAT Shop Hai'',''other'')::text'), 'ERR:shop_already_registered');
 t2 := pg_temp.run_as(u2, 'SELECT public.register_shop(''UAT Shop Hai'',''my-pham'')::text');
 IF t2 !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'T404_UAT_REGISTER2_FAILED %', t2; END IF;
 SELECT id INTO s1 FROM public.stores WHERE tenant_id=t1::uuid AND is_default;
 SELECT id INTO s2 FROM public.stores WHERE tenant_id=t2::uuid AND is_default;
 PERFORM pg_temp.chk('OWNER_SEES_OWN_STORE_NAMED', pg_temp.run_as(u1, 'SELECT string_agg(name,'','') FROM public.stores'), 'UAT Shop Một');
 PERFORM pg_temp.chk('OWNER_SEES_ONLY_OWN_TENANT', pg_temp.run_as(u1, 'SELECT count(*) FROM public.tenants'), '1');
 PERFORM pg_temp.chk('NO_ACCESS_TO_QA_TENANT', pg_temp.run_as(u1, format('SELECT count(*) FROM public.products WHERE tenant_id=%L',ta)), '0');
 PERFORM pg_temp.chk('REGISTER_AUDITED', (SELECT count(*)::text FROM app_private.audit_events WHERE event_type='self_serve_register' AND tenant_id=t1::uuid), '1');
 PERFORM pg_temp.chk('QA_TENANT_STILL_ALLOWED', app_private.t404_qa_tenant_allowed(ta)::text, 'true');
 PERFORM pg_temp.chk('SELF_SERVE_TENANT_ALLOWED', app_private.t404_qa_tenant_allowed(t1::uuid)::text, 'true');

 -- V20 admin RPCs work for a self-serve tenant
 ts := pg_temp.run_as(u1, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-V23-001'',''Áo UAT'',289000,true,5,NULL)::text',s1));
 PERFORM pg_temp.chk('SELF_SERVE_CREATES_PRODUCT', (ts NOT LIKE 'ERR:%')::text, 'true');
 PERFORM pg_temp.chk('CROSS_SHOP_PRODUCT_WRITE_DENIED', pg_temp.run_as(u2, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-V23-X'',''x'',1,true,0,NULL)::text',s1)), 'ERR:access_denied');
 PERFORM pg_temp.chk('CROSS_SHOP_PRODUCT_READ_HIDDEN', pg_temp.run_as(u2, 'SELECT count(*) FROM public.products WHERE sku LIKE ''T404-UAT-V23-%'''), '0');
 PERFORM pg_temp.chk('SELF_SERVE_CANNOT_WRITE_QA_STORE', pg_temp.run_as(u1, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-V23-Q'',''x'',1,true,0,NULL)::text',qa_main)), 'ERR:access_denied');

 -- 30 stock
 SELECT id, updated_at::text INTO pid, pts FROM public.products WHERE store_id=s1 AND sku='T404-UAT-V23-001';
 ts2 := pg_temp.run_as(u1, format('SELECT public.set_product_stock(%L,%L,30,%L::timestamptz)::text',s1,pid,pts));
 PERFORM pg_temp.chk('SET_STOCK_OK', (ts2 NOT LIKE 'ERR:%')::text, 'true');
 PERFORM pg_temp.chk('STOCK_STORED', (SELECT stock_on_hand::text FROM public.products WHERE id=pid), '30');
 PERFORM pg_temp.chk('STALE_STOCK_DENIED', pg_temp.run_as(u1, format('SELECT public.set_product_stock(%L,%L,1,%L::timestamptz)::text',s1,pid,pts)), 'ERR:product_changed_or_missing');
 PERFORM pg_temp.chk('NEGATIVE_STOCK_DENIED', pg_temp.run_as(u1, format('SELECT public.set_product_stock(%L,%L,-1,%L::timestamptz)::text',s1,pid,ts2)), 'ERR:invalid_stock');
 PERFORM pg_temp.chk('CROSS_SHOP_STOCK_DENIED', pg_temp.run_as(u2, format('SELECT public.set_product_stock(%L,%L,1,%L::timestamptz)::text',s1,pid,ts2)), 'ERR:access_denied');
 PERFORM pg_temp.chk('STOCK_AUDITED', (SELECT count(*)::text FROM app_private.audit_events WHERE event_type='product_stock_set' AND metadata->>'product_id'=pid::text), '1');

 -- 30 bot settings
 ts := pg_temp.run_as(u1, format('SELECT public.save_store_bot_settings(%L,''Shop bán áo'',''Không hứa giao 1h'',''friendly'',true,ARRAY[''Owner@Example.com'',''owner@example.com''],NULL)::text',s1));
 PERFORM pg_temp.chk('SAVE_SETTINGS_OK', (ts NOT LIKE 'ERR:%')::text, 'true');
 PERFORM pg_temp.chk('EMAILS_DEDUPED_LOWERCASE', pg_temp.run_as(u1, 'SELECT array_to_string(notify_emails,'','') FROM public.store_bot_settings'), 'owner@example.com');
 PERFORM pg_temp.chk('SETTINGS_STALE_DENIED', pg_temp.run_as(u1, format('SELECT public.save_store_bot_settings(%L,'''','''',''polite'',false,NULL,%L::timestamptz)::text',s1,'2000-01-01')), 'ERR:settings_changed');
 PERFORM pg_temp.chk('BOT_OFF_OK', (pg_temp.run_as(u1, format('SELECT public.save_store_bot_settings(%L,'''','''',''cute'',false,NULL,%L::timestamptz)::text',s1,ts)) NOT LIKE 'ERR:%')::text, 'true');
 PERFORM pg_temp.chk('BAD_TONE_DENIED', pg_temp.run_as(u1, format('SELECT public.save_store_bot_settings(%L,'''','''',''rude'',true,NULL,NULL)::text',s1)), 'ERR:invalid_settings');
 PERFORM pg_temp.chk('BAD_EMAIL_DENIED', pg_temp.run_as(u2, format('SELECT public.save_store_bot_settings(%L,'''','''',''polite'',true,ARRAY[''not-an-email''],NULL)::text',s2)), 'ERR:invalid_email');
 PERFORM pg_temp.chk('CROSS_SHOP_SETTINGS_DENIED', pg_temp.run_as(u2, format('SELECT public.save_store_bot_settings(%L,'''','''',''polite'',true,NULL,NULL)::text',s1)), 'ERR:access_denied');
 PERFORM pg_temp.chk('CROSS_SHOP_SETTINGS_HIDDEN', pg_temp.run_as(u2, 'SELECT count(*) FROM public.store_bot_settings'), '0');
 PERFORM pg_temp.chk('DIRECT_SETTINGS_WRITE_DENIED', pg_temp.run_as(u1, format('UPDATE public.store_bot_settings SET bot_enabled=true WHERE store_id=%L RETURNING 1',s1)), 'ERR:permission denied');
 PERFORM pg_temp.chk('ANON_SETTINGS_DENIED', pg_temp.run_as(NULL, format('SELECT public.save_store_bot_settings(%L,'''','''',''polite'',true,NULL,NULL)::text',s1)), 'ERR:permission denied');

 -- 30 FAQ
 f1 := pg_temp.run_as(u1, format('SELECT public.save_store_faq(%L,NULL,''Shop mở cửa mấy giờ?'',''8h đến 21h'',true)::text',s1));
 PERFORM pg_temp.chk('FAQ_CREATE_OK', (f1 ~ '^[0-9a-f-]{36}$')::text, 'true');
 PERFORM pg_temp.chk('FAQ_EDIT_OK', pg_temp.run_as(u1, format('SELECT public.save_store_faq(%L,%L,''Shop mở cửa mấy giờ?'',''8h đến 22h'',true)::text',s1,f1)), f1);
 PERFORM pg_temp.chk('FAQ_CROSS_SHOP_EDIT_DENIED', pg_temp.run_as(u2, format('SELECT public.save_store_faq(%L,%L,''x?'',''y'',true)::text',s2,f1)), 'ERR:faq_not_found');
 PERFORM pg_temp.chk('FAQ_CROSS_SHOP_HIDDEN', pg_temp.run_as(u2, 'SELECT count(*) FROM public.store_faqs'), '0');
 PERFORM pg_temp.chk('FAQ_INVALID_DENIED', pg_temp.run_as(u1, format('SELECT public.save_store_faq(%L,NULL,''x'','''',true)::text',s1)), 'ERR:invalid_faq');
 PERFORM pg_temp.chk('FAQ_DELETE_OK', pg_temp.run_as(u1, format('SELECT public.delete_store_faq(%L,%L)::text',s1,f1)), '');
 PERFORM pg_temp.chk('FAQ_DELETE_TWICE', pg_temp.run_as(u1, format('SELECT public.delete_store_faq(%L,%L)::text',s1,f1)), 'ERR:faq_not_found');

 -- 30 customer stage
 INSERT INTO public.customers(id,tenant_id,store_id,display_name) VALUES (cid,t1::uuid,s1,'Khách UAT');
 PERFORM pg_temp.chk('CUSTOMER_DEFAULT_STAGE', (SELECT stage FROM public.customers WHERE id=cid), 'new');
 PERFORM pg_temp.chk('SET_STAGE_OK', pg_temp.run_as(u1, format('SELECT public.set_customer_stage(%L,%L,''hot'',now()+interval ''1 day'',''Gọi lại'')::text',s1,cid)), '');
 PERFORM pg_temp.chk('STAGE_STORED', (SELECT stage||'|'||note FROM public.customers WHERE id=cid), 'hot|Gọi lại');
 PERFORM pg_temp.chk('BAD_STAGE_DENIED', pg_temp.run_as(u1, format('SELECT public.set_customer_stage(%L,%L,''vip'',NULL,NULL)::text',s1,cid)), 'ERR:invalid_stage');
 PERFORM pg_temp.chk('CROSS_SHOP_STAGE_DENIED', pg_temp.run_as(u2, format('SELECT public.set_customer_stage(%L,%L,''won'',NULL,NULL)::text',s2,cid)), 'ERR:customer_not_found');
 PERFORM pg_temp.chk('QA_TENANT_UNTOUCHED', (SELECT count(*)::text FROM public.store_bot_settings WHERE tenant_id=ta), '0');
END $uat$;

SELECT CASE WHEN ok THEN 'PASS_' ELSE 'FAIL_' END||tag FROM uat ORDER BY n;
SELECT 'UAT_TOTAL='||count(*)||' FAILED='||count(*) FILTER (WHERE NOT ok) FROM uat;
ROLLBACK;
-- Proof of zero residue (outside the rolled-back transaction).
SELECT 'RESIDUE uat_leads='||(SELECT count(*) FROM app_private.web_leads WHERE source='uat')
  ||' self_serve='||(SELECT count(*) FROM app_private.self_serve_tenants s JOIN auth.users u ON u.id=s.created_by WHERE u.email LIKE 't404-uat-v23%@qa.invalid')
  ||' uat_products='||(SELECT count(*) FROM public.products WHERE sku LIKE 'T404-UAT-V23-%')
  ||' uat_users='||(SELECT count(*) FROM auth.users WHERE email LIKE 't404-uat-v23%@qa.invalid')
  ||' tenants='||(SELECT count(*) FROM public.tenants);
