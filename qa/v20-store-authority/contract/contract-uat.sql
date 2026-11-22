-- Hosted UAT for 40_store_sku_contract.sql (SKU unique per Store). Real hosted schema, real QA
-- tenant owners, simulated JWT claims, one temporary tenant-A manager and one temporary branch
-- Store. Only UAT SKUs (T404-UAT-*) are written; real products are never touched. EVERYTHING runs in one transaction that is ROLLED BACK at the end:
-- no Store, membership, product, auth user or audit row survives. Prints PASS_/FAIL_ tags only.
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
 ta uuid := '9c8c524c-88db-4771-8ab0-a4316298494c'; tb uuid := '4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5';
 oa uuid; ob uuid; mgr uuid := gen_random_uuid();
 s2 text; main uuid; tm text; tb2 text; r text;
BEGIN
 SELECT user_id INTO oa FROM public.tenant_memberships WHERE tenant_id=ta AND role='owner' AND active ORDER BY user_id LIMIT 1;
 SELECT user_id INTO ob FROM public.tenant_memberships WHERE tenant_id=tb AND role='owner' AND active ORDER BY user_id LIMIT 1;
 IF oa IS NULL OR ob IS NULL THEN RAISE EXCEPTION 'T404_UAT_OWNERS_MISSING'; END IF;
 SELECT id INTO main FROM public.stores WHERE tenant_id=ta AND is_default;
 INSERT INTO auth.users(id,email,aud,role) VALUES
  (mgr,'t404-uat-mgr-'||left(mgr::text,8)||'@qa.invalid','authenticated','authenticated');
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES (ta,mgr,'manager');

 PERFORM pg_temp.chk('TENANT_SKU_KEY_DROPPED', (SELECT count(*)::text FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_id_sku_key'), '0');
 PERFORM pg_temp.chk('STORE_SKU_KEY_PRESENT', (SELECT count(*)::text FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_store_sku_key'), '1');
 PERFORM pg_temp.chk('V1_ANON_DENIED', pg_temp.run_as(NULL, format('SELECT public.save_merchant_product(%L,''T404-UAT-ANON'',''x'',1,true,0,NULL)',ta)), 'ERR:permission denied');

 s2 := pg_temp.run_as(oa, format('SELECT public.create_store(%L,''t404-uat-branch'',''UAT chi nhánh'')',ta));
 IF s2 !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'T404_UAT_CREATE_STORE_FAILED'; END IF;
 r := pg_temp.run_as(oa, format('SELECT public.set_store_member(%L,%L,''manager'',true)::text',s2,mgr));

 tm := pg_temp.run_as(oa, format('SELECT public.save_merchant_product(%L,''T404-UAT-C1'',''UAT main'',159000,true,5,NULL)',ta));
 PERFORM pg_temp.chk('V1_CREATES_IN_DEFAULT_STORE', (SELECT string_agg(store_id::text,',') FROM public.products WHERE tenant_id=ta AND sku='T404-UAT-C1'), main::text);
 tb2 := pg_temp.run_as(mgr, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-C1'',''UAT chi nhánh'',149000,true,2,NULL)',s2));
 PERFORM pg_temp.chk('SAME_SKU_ALLOWED_IN_BRANCH', (tb2 NOT LIKE 'ERR:%')::text, 'true');
 PERFORM pg_temp.chk('SAME_SKU_IN_TWO_STORES', (SELECT count(*)||':'||count(DISTINCT store_id) FROM public.products WHERE tenant_id=ta AND sku='T404-UAT-C1'), '2:2');
 PERFORM pg_temp.chk('SAME_STORE_DUP_SKU_DENIED', pg_temp.run_as(mgr, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-C1'',''dup'',1,true,0,NULL)',s2)), 'ERR:sku_taken');
 PERFORM pg_temp.chk('MAIN_ROW_UNTOUCHED', (SELECT price_vnd||':'||stock_on_hand FROM public.products WHERE store_id=main AND sku='T404-UAT-C1'), '159000:5');
 tb2 := pg_temp.run_as(mgr, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-C1'',''UAT chi nhánh sửa'',139000,true,NULL,%L::timestamptz)',s2,tb2));
 PERFORM pg_temp.chk('BRANCH_EDIT_ONLY_BRANCH_ROW', (SELECT string_agg(price_vnd::text,',' ORDER BY price_vnd) FROM public.products WHERE tenant_id=ta AND sku='T404-UAT-C1'), '139000,159000');
 PERFORM pg_temp.chk('BRANCH_MANAGER_SEES_ONLY_BRANCH_COPY', pg_temp.run_as(mgr, 'SELECT count(*) FROM public.products WHERE sku=''T404-UAT-C1'''), '1');
 PERFORM pg_temp.chk('TENANT_OWNER_SEES_BOTH_COPIES', pg_temp.run_as(oa, 'SELECT count(*) FROM public.products WHERE sku=''T404-UAT-C1'''), '2');
 PERFORM pg_temp.chk('OTHER_TENANT_SEES_NO_COPY', pg_temp.run_as(ob, 'SELECT count(*) FROM public.products WHERE sku=''T404-UAT-C1'''), '0');

 r := pg_temp.run_as(oa, format('SELECT public.save_merchant_product(%L,''T404-UAT-C1'',''UAT main sửa'',158000,true,NULL,%L::timestamptz)',ta,tm));
 PERFORM pg_temp.chk('V1_EDIT_HITS_DEFAULT_STORE_ONLY', (SELECT string_agg(price_vnd::text,',' ORDER BY price_vnd) FROM public.products WHERE tenant_id=ta AND sku='T404-UAT-C1'), '139000,158000');
 PERFORM pg_temp.chk('V1_CANNOT_EDIT_BRANCH_ROW', pg_temp.run_as(oa, format('SELECT public.save_merchant_product(%L,''T404-UAT-C1'',''x'',1,true,NULL,%L::timestamptz)',ta,tb2)), 'ERR:product_changed_or_missing');
 r := pg_temp.run_as(mgr, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-C2'',''Chỉ chi nhánh'',50000,true,1,NULL)',s2));
 r := pg_temp.run_as(oa, format('SELECT public.save_merchant_product(%L,''T404-UAT-C2'',''Giờ có ở main'',60000,true,4,NULL)',ta));
 PERFORM pg_temp.chk('V1_CREATE_GOES_TO_DEFAULT_STORE', (SELECT string_agg(s.is_default::text,',' ORDER BY s.is_default) FROM public.products p JOIN public.stores s ON s.id=p.store_id WHERE p.tenant_id=ta AND p.sku='T404-UAT-C2'), 'false,true');
 PERFORM pg_temp.chk('V1_DUP_IN_DEFAULT_STORE_DENIED', pg_temp.run_as(oa, format('SELECT public.save_merchant_product(%L,''T404-UAT-C2'',''x'',1,true,0,NULL)',ta)), 'ERR:duplicate key');
 PERFORM pg_temp.chk('BRANCH_MANAGER_V1_DENIED', pg_temp.run_as(mgr, format('SELECT public.save_merchant_product(%L,''T404-UAT-V1'',''x'',1,true,0,NULL)',ta)), 'ERR:access_denied');
 PERFORM pg_temp.chk('CROSS_TENANT_V1_DENIED', pg_temp.run_as(ob, format('SELECT public.save_merchant_product(%L,''T404-UAT-BA'',''x'',1,true,0,NULL)',ta)), 'ERR:access_denied');
 PERFORM pg_temp.chk('ROLLBACK_60_GUARD_SEES_DUP', (SELECT EXISTS (SELECT 1 FROM public.products GROUP BY tenant_id,sku HAVING count(*)>1))::text, 'true');
 PERFORM pg_temp.chk('OWNER_B_UNAFFECTED', pg_temp.run_as(ob, format('SELECT count(*) FROM public.stores WHERE tenant_id=%L',tb)), '1');
END $uat$;

SELECT CASE WHEN ok THEN 'PASS_' ELSE 'FAIL_' END||tag FROM uat ORDER BY n;
SELECT 'UAT_TOTAL='||count(*)||' FAILED='||count(*) FILTER (WHERE NOT ok) FROM uat;
ROLLBACK;
-- Proof of zero residue (outside the rolled-back transaction).
SELECT 'RESIDUE stores_over_one='||(SELECT count(*) FROM (SELECT tenant_id FROM public.stores GROUP BY tenant_id HAVING count(*)>1) x)
  ||' uat_products='||(SELECT count(*) FROM public.products WHERE sku LIKE 'T404-UAT-%')
  ||' uat_users='||(SELECT count(*) FROM auth.users WHERE email LIKE 't404-uat-%@qa.invalid')
  ||' dup_skus='||(SELECT count(*) FROM (SELECT 1 FROM public.products GROUP BY tenant_id,sku HAVING count(*)>1) d);
