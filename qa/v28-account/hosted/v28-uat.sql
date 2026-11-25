-- Hosted UAT for db/v28-account (rolled back). Runs as ONE implicit transaction that ALWAYS ends in an exception,
-- so no auth user, tenant, store, invoice, admin row or audit row survives. The exception text carries the result:
-- T404_V28_HOSTED_UAT total=<n> failed=<n> [failed tags]. Simulated JWT claims via SET LOCAL ROLE + request.jwt.claims.
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
CREATE TEMP TABLE uat(n serial, tag text, ok boolean);
CREATE FUNCTION pg_temp.chk(p_tag text, p_got text, p_want text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN INSERT INTO uat(tag,ok) VALUES (p_tag, p_got = p_want OR (p_want LIKE 'ERR:%' AND p_got LIKE p_want||'%')); END $f$;
DO $uat$
DECLARE
 u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
 t1 text; t2 text; s1 uuid; s2 uuid; inv text; j jsonb; tot int; bad int; tags text;
BEGIN
 INSERT INTO auth.users(id,email,aud,role,email_confirmed_at) VALUES
  (u1,'t404-uat-v28a-'||left(u1::text,8)||'@qa.invalid','authenticated','authenticated',now()),
  (u2,'t404-uat-v28b-'||left(u2::text,8)||'@qa.invalid','authenticated','authenticated',now()),
  (adm,'t404-uat-v28x-'||left(adm::text,8)||'@qa.invalid','authenticated','authenticated',now());
 t1 := pg_temp.run_as(u1, $$SELECT public.register_shop('UAT V28 Shop A','fashion')$$);
 t2 := pg_temp.run_as(u2, $$SELECT public.register_shop('UAT V28 Shop B','beauty')$$);
 SELECT id INTO s1 FROM public.stores WHERE tenant_id=t1::uuid; SELECT id INTO s2 FROM public.stores WHERE tenant_id=t2::uuid;
 PERFORM pg_temp.chk('SHOPS_CREATED', (s1 IS NOT NULL AND s2 IS NOT NULL)::text, 'true');
 PERFORM pg_temp.chk('DEFAULT_TRIAL', pg_temp.run_as(u1, format($$SELECT public.billing_demo_state(%L)->'subscription'->>'plan'$$, s1)), 'trial');
 j := pg_temp.run_as(u1, format($$SELECT public.billing_demo_checkout(%L,'plus','year')::text$$, s1))::jsonb;
 PERFORM pg_temp.chk('SERVER_PRICE', j->'invoices'->0->>'amount_vnd', '2990000');
 inv := j->'invoices'->0->>'id';
 PERFORM pg_temp.chk('U2_READS_U1', pg_temp.run_as(u2, format($$SELECT public.billing_demo_state(%L)::text$$, s1)), 'ERR:access_denied');
 PERFORM pg_temp.chk('U2_CONFIRMS_VIA_OWN', pg_temp.run_as(u2, format($$SELECT public.billing_demo_confirm(%L,%L)::text$$, s2, inv)), 'ERR:invoice_not_pending');
 PERFORM pg_temp.chk('ANON_STATE', pg_temp.run_as(NULL, format($$SELECT public.billing_demo_state(%L)::text$$, s1)), 'ERR:permission denied');
 PERFORM pg_temp.chk('DIRECT_READ', pg_temp.run_as(u1, $$SELECT count(*)::text FROM public.billing_demo_invoices$$), 'ERR:permission denied');
 PERFORM pg_temp.chk('CONFIRM', pg_temp.run_as(u1, format($$SELECT public.billing_demo_confirm(%L,%L)->'subscription'->>'status'$$, s1, inv)), 'active');
 PERFORM pg_temp.chk('CANCEL', pg_temp.run_as(u1, format($$SELECT public.billing_demo_cancel(%L)->'subscription'->>'status'$$, s1)), 'canceled');
 PERFORM pg_temp.chk('OWNER_NOT_ADMIN', pg_temp.run_as(u1, $$SELECT public.is_platform_admin()::text$$), 'false');
 PERFORM pg_temp.chk('OWNER_OVERVIEW', pg_temp.run_as(u1, $$SELECT public.admin_overview()::text$$), 'ERR:access_denied');
 PERFORM pg_temp.chk('OWNER_READ_ADMINS', pg_temp.run_as(u1, $$SELECT count(*)::text FROM app_private.platform_admins$$), 'ERR:permission denied');
 PERFORM pg_temp.chk('ANON_IS_ADMIN', pg_temp.run_as(NULL, $$SELECT public.is_platform_admin()::text$$), 'ERR:permission denied');
 PERFORM pg_temp.chk('OWNER_LOCKS', pg_temp.run_as(u1, format($$SELECT public.admin_set_account_lock(%L,true,'spam spam')::text$$, u2)), 'ERR:access_denied');
 INSERT INTO app_private.platform_admins(user_id,note) VALUES (adm,'UAT');
 PERFORM pg_temp.chk('ADMIN_FLAG', pg_temp.run_as(adm, $$SELECT public.is_platform_admin()::text$$), 'true');
 PERFORM pg_temp.chk('ADMIN_SEES_SHOP', pg_temp.run_as(adm, format($$SELECT (SELECT x->>'plan_status' FROM jsonb_array_elements(public.admin_overview()->'stores') x WHERE x->>'store_id'=%L)$$, s1)), 'canceled');
 PERFORM pg_temp.chk('ADMIN_LOCK_SELF', pg_temp.run_as(adm, format($$SELECT public.admin_set_account_lock(%L,true,'test')::text$$, adm)), 'ERR:cannot_lock_self');
 PERFORM pg_temp.chk('ADMIN_LOCKS', pg_temp.run_as(adm, format($$SELECT public.admin_set_account_lock(%L,true,'UAT khoá thử')::text$$, u2)), 'true');
 PERFORM pg_temp.chk('BANNED', (SELECT (banned_until='infinity')::text FROM auth.users WHERE id=u2), 'true');
 PERFORM pg_temp.chk('ADMIN_UNLOCKS', pg_temp.run_as(adm, format($$SELECT public.admin_set_account_lock(%L,false,NULL)::text$$, u2)), 'false');
 PERFORM pg_temp.chk('UNBANNED', (SELECT (banned_until IS NULL)::text FROM auth.users WHERE id=u2), 'true');
 PERFORM pg_temp.chk('ADMIN_BOT_OFF', pg_temp.run_as(adm, format($$SELECT public.admin_set_store_bot(%L,false)::text$$, s2)), 'false');
 SELECT count(*), count(*) FILTER (WHERE NOT ok), string_agg(tag, ',') FILTER (WHERE NOT ok) INTO tot, bad, tags FROM uat;
 RAISE EXCEPTION 'T404_V28_HOSTED_UAT total=% failed=% %', tot, bad, coalesce(tags,'');
END $uat$;
