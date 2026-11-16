-- TIEN404 V15 Security Reviewer / Owner P0-E.2 READ-ONLY AUDIT
-- Aggregates and metadata ONLY. Never emit auth users, phone, email,
-- customer information, secrets, function source or backup credentials.
-- Do NOT use this file as a migration or evidence of independent approval.
BEGIN TRANSACTION READ ONLY;

SELECT
  (SELECT count(*) FROM auth.users) AS auth_user_count,
  (SELECT count(*) FROM public.tenants) AS tenant_count,
  (SELECT count(*) FROM public.tenant_memberships WHERE active) AS active_membership_count,
  (SELECT count(*) FROM public.products) AS product_count,
  (SELECT count(*) FROM public.orders) AS order_count,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='stores') AS canonical_stores_tables,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='store_memberships') AS store_membership_tables,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND column_name='store_id'
      AND table_name IN ('products','orders','order_items','customers',
         'conversations','messages','tenant_agent_configs')) AS core_store_id_columns;

SELECT p.proname AS rpc,
 p.prosecdef AS security_definer,
 pg_get_userbyid(p.proowner) AS execution_owner,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
 (position('auth.uid' in lower(pg_get_functiondef(p.oid)))>0) AS mentions_auth_uid,
 (position('hmac' in lower(pg_get_functiondef(p.oid)))>0) AS mentions_hmac,
 (position('crypt' in lower(pg_get_functiondef(p.oid)))>0) AS mentions_crypt,
 (position('store_id' in lower(pg_get_functiondef(p.oid)))>0) AS mentions_store_id
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN
 ('qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product')
 ORDER BY p.proname;

SELECT tablename,policyname,permissive,cmd,
  (coalesce(qual,'') ILIKE '%tenant_memberships%') AS tenant_scope,
  (coalesce(qual,'') ILIKE '%store_memberships%') AS store_scope,
  (coalesce(qual,'') ILIKE '%auth.uid%') AS auth_uid_scope
 FROM pg_policies
 WHERE schemaname='public' AND tablename IN
  ('products','orders','order_items','customers',
   'conversations','messages','tenant_agent_configs')
 ORDER BY tablename,policyname;

COMMIT;
