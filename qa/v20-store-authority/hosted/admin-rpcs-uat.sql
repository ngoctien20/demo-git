-- Hosted UAT for 30_store_admin_rpcs.sql. Runs on the real hosted schema with the real QA tenant
-- owners, simulated JWT claims (SET LOCAL ROLE authenticated + request.jwt.claims), and two
-- temporary tenant-A members. EVERYTHING runs in one transaction that is ROLLED BACK at the end:
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
 oa uuid; ob uuid;
 mgr uuid := gen_random_uuid(); stf uuid := gen_random_uuid();
 s2 text; main uuid; ts text; before_stores bigint;
BEGIN
 SELECT user_id INTO oa FROM public.tenant_memberships WHERE tenant_id=ta AND role='owner' AND active ORDER BY user_id LIMIT 1;
 SELECT user_id INTO ob FROM public.tenant_memberships WHERE tenant_id=tb AND role='owner' AND active ORDER BY user_id LIMIT 1;
 IF oa IS NULL OR ob IS NULL THEN RAISE EXCEPTION 'T404_UAT_OWNERS_MISSING'; END IF;
 SELECT id INTO main FROM public.stores WHERE tenant_id=ta AND is_default;
 SELECT count(*) INTO before_stores FROM public.stores;
 INSERT INTO auth.users(id,email,aud,role) VALUES
  (mgr,'t404-uat-mgr-'||left(mgr::text,8)||'@qa.invalid','authenticated','authenticated'),
  (stf,'t404-uat-stf-'||left(stf::text,8)||'@qa.invalid','authenticated','authenticated');
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES (ta,mgr,'manager'),(ta,stf,'staff');

 PERFORM pg_temp.chk('ANON_CREATE_STORE_DENIED', pg_temp.run_as(NULL, format('SELECT public.create_store(%L,''x-anon'',''x'')',ta)), 'ERR:permission denied');
 PERFORM pg_temp.chk('CROSS_TENANT_CREATE_STORE_DENIED', pg_temp.run_as(ob, format('SELECT public.create_store(%L,''b-into-a'',''x'')',ta)), 'ERR:access_denied');
 PERFORM pg_temp.chk('MANAGER_CREATE_STORE_DENIED', pg_temp.run_as(mgr, format('SELECT public.create_store(%L,''mgr-store'',''x'')',ta)), 'ERR:access_denied');
 PERFORM pg_temp.chk('DIRECT_STORE_INSERT_DENIED', pg_temp.run_as(oa, format('INSERT INTO public.stores(tenant_id,store_key,name) VALUES (%L,''direct'',''x'') RETURNING id',ta)), 'ERR:permission denied');
 s2 := pg_temp.run_as(oa, format('SELECT public.create_store(%L,''t404-uat-branch'',''UAT chi nhánh'')',ta));
 PERFORM pg_temp.chk('OWNER_CREATES_STORE', (s2 ~ '^[0-9a-f-]{36}$')::text, 'true');
 IF s2 !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'T404_UAT_CREATE_STORE_FAILED'; END IF;
 PERFORM pg_temp.chk('RESERVED_KEY_DENIED', pg_temp.run_as(oa, format('SELECT public.create_store(%L,''main'',''x'')',ta)), 'ERR:invalid_store');
 PERFORM pg_temp.chk('DUPLICATE_KEY_DENIED', pg_temp.run_as(oa, format('SELECT public.create_store(%L,''t404-uat-branch'',''x'')',ta)), 'ERR:store_key_taken');
 PERFORM pg_temp.chk('OWNER_SEES_BOTH_STORES', pg_temp.run_as(oa, format('SELECT count(*) FROM public.stores WHERE tenant_id=%L',ta)), '2');
 PERFORM pg_temp.chk('OTHER_TENANT_CANNOT_SEE_STORE', pg_temp.run_as(ob, format('SELECT count(*) FROM public.stores WHERE id=%L',s2)), '0');

 PERFORM pg_temp.chk('MANAGER_WITHOUT_STORE_SEES_NOTHING', pg_temp.run_as(mgr, 'SELECT count(*) FROM public.products'), '0');
 PERFORM pg_temp.chk('SELF_EDIT_DENIED', pg_temp.run_as(oa, format('SELECT public.set_store_member(%L,%L,''manager'',true)',s2,oa)), 'ERR:invalid_member');
 PERFORM pg_temp.chk('NON_TENANT_MEMBER_DENIED', pg_temp.run_as(oa, format('SELECT public.set_store_member(%L,%L,''manager'',true)',s2,ob)), 'ERR:not_a_tenant_member');
 PERFORM pg_temp.chk('CROSS_TENANT_SET_MEMBER_DENIED', pg_temp.run_as(ob, format('SELECT public.set_store_member(%L,%L,''owner'',true)',s2,mgr)), 'ERR:access_denied');
 PERFORM pg_temp.chk('OWNER_ADDS_MANAGER', pg_temp.run_as(oa, format('SELECT public.set_store_member(%L,%L,''manager'',true)::text',s2,mgr)), '');
 PERFORM pg_temp.chk('MANAGER_CANNOT_GRANT', pg_temp.run_as(mgr, format('SELECT public.set_store_member(%L,%L,''owner'',true)',s2,stf)), 'ERR:access_denied');
 PERFORM pg_temp.chk('OWNER_ADDS_STAFF', pg_temp.run_as(oa, format('SELECT public.set_store_member(%L,%L,''staff'',true)::text',s2,stf)), '');

 ts := pg_temp.run_as(mgr, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-S2-001'',''UAT chi nhánh'',99000,true,3,NULL)',s2));
 PERFORM pg_temp.chk('STORE_MANAGER_CREATES_PRODUCT', (ts NOT LIKE 'ERR:%')::text, 'true');
 PERFORM pg_temp.chk('STORE_MANAGER_SEES_ONLY_OWN_STORE', pg_temp.run_as(mgr, 'SELECT string_agg(sku,'','') FROM public.products'), 'T404-UAT-S2-001');
 PERFORM pg_temp.chk('STORE_MANAGER_EDITS', (pg_temp.run_as(mgr, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-S2-001'',''UAT sửa'',99000,true,NULL,%L::timestamptz)',s2,ts)) NOT LIKE 'ERR:%')::text, 'true');
 PERFORM pg_temp.chk('STALE_EDIT_DENIED', pg_temp.run_as(mgr, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-S2-001'',''x'',1,true,NULL,%L::timestamptz)',s2,ts)), 'ERR:product_changed_or_missing');
 PERFORM pg_temp.chk('MANAGER_OTHER_STORE_DENIED', pg_temp.run_as(mgr, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-X'',''x'',1,true,0,NULL)',main)), 'ERR:access_denied');
 PERFORM pg_temp.chk('MANAGER_V1_DEFAULT_STORE_DENIED', pg_temp.run_as(mgr, format('SELECT public.save_merchant_product(%L,''T404-UAT-Y'',''x'',1,true,0,NULL)',ta)), 'ERR:access_denied');
 PERFORM pg_temp.chk('STAFF_WRITE_DENIED', pg_temp.run_as(stf, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-Z'',''x'',1,true,0,NULL)',s2)), 'ERR:access_denied');
 PERFORM pg_temp.chk('STAFF_READS_STORE_PRODUCTS', pg_temp.run_as(stf, 'SELECT count(*) FROM public.products'), '1');
 PERFORM pg_temp.chk('STAFF_CANNOT_READ_ORDERS', pg_temp.run_as(stf, 'SELECT count(*) FROM public.orders'), '0');
 PERFORM pg_temp.chk('CROSS_TENANT_WRITE_DENIED', pg_temp.run_as(ob, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-B'',''x'',1,true,0,NULL)',s2)), 'ERR:access_denied');
 PERFORM pg_temp.chk('ANON_WRITE_DENIED', pg_temp.run_as(NULL, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-A'',''x'',1,true,0,NULL)',s2)), 'ERR:permission denied');
 PERFORM pg_temp.chk('OTHER_TENANT_CANNOT_SEE_BRANCH_PRODUCT', pg_temp.run_as(ob, 'SELECT count(*) FROM public.products WHERE sku=''T404-UAT-S2-001'''), '0');

 PERFORM pg_temp.chk('PROMOTE_MANAGER_TO_OWNER', pg_temp.run_as(oa, format('SELECT public.set_store_member(%L,%L,''owner'',true)::text',s2,mgr)), '');
 PERFORM pg_temp.chk('STORE_OWNER_DEACTIVATES_OTHER_OWNER', pg_temp.run_as(mgr, format('SELECT public.set_store_member(%L,%L,''owner'',false)::text',s2,oa)), '');
 PERFORM pg_temp.chk('LAST_STORE_OWNER_PROTECTED', pg_temp.run_as(oa, format('SELECT public.set_store_member(%L,%L,''manager'',true)',s2,mgr)), 'ERR:last_store_owner');
 PERFORM pg_temp.chk('REVOKE_STAFF', pg_temp.run_as(mgr, format('SELECT public.set_store_member(%L,%L,''staff'',false)::text',s2,stf)), '');
 PERFORM pg_temp.chk('REVOKED_STAFF_LOSES_READ', pg_temp.run_as(stf, 'SELECT count(*) FROM public.products'), '0');
 UPDATE public.stores SET active=false WHERE id=s2::uuid;
 PERFORM pg_temp.chk('INACTIVE_STORE_HIDES_PRODUCTS', pg_temp.run_as(mgr, 'SELECT count(*) FROM public.products'), '0');
 PERFORM pg_temp.chk('INACTIVE_STORE_WRITE_DENIED', pg_temp.run_as(mgr, format('SELECT public.save_merchant_product_in_store(%L,''T404-UAT-S2-002'',''x'',1,true,0,NULL)',s2)), 'ERR:access_denied');
 PERFORM pg_temp.chk('STORE_CREATE_AUDITED', (SELECT count(*)::text FROM app_private.audit_events WHERE event_type='store_create' AND metadata->>'store_id'=s2), '1');
 PERFORM pg_temp.chk('OWNER_B_UNAFFECTED', pg_temp.run_as(ob, format('SELECT count(*) FROM public.stores WHERE tenant_id=%L',tb)), '1');
END $uat$;

SELECT CASE WHEN ok THEN 'PASS_' ELSE 'FAIL_' END||tag FROM uat ORDER BY n;
SELECT 'UAT_TOTAL='||count(*)||' FAILED='||count(*) FILTER (WHERE NOT ok) FROM uat;
ROLLBACK;
-- Proof of zero residue (outside the rolled-back transaction).
SELECT 'RESIDUE stores_over_one='||(SELECT count(*) FROM (SELECT tenant_id FROM public.stores GROUP BY tenant_id HAVING count(*)>1) x)
  ||' uat_products='||(SELECT count(*) FROM public.products WHERE sku LIKE 'T404-UAT-%')
  ||' uat_users='||(SELECT count(*) FROM auth.users WHERE email LIKE 't404-uat-%@qa.invalid');
