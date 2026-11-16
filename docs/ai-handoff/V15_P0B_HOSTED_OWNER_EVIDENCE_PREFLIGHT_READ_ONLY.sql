-- TIEN404 V15 P0-B — READ-ONLY HOSTED EVIDENCE PRE-FLIGHT
-- Private operator only. Does NOT certify ownership, migration or restore.
-- Query returns aggregates and schema/privilege metadata only — no user IDs,
-- emails, phone numbers, customer payload, order totals, tokens or secrets.
-- No INSERT/UPDATE/DELETE, DDL, GRANT, RPC invocation or mutations.
BEGIN TRANSACTION READ ONLY;

SELECT
 (SELECT count(*) FROM auth.users) AS auth_users,
 (SELECT count(*) FROM public.tenants) AS tenants,
 (SELECT count(*) FROM public.tenant_memberships WHERE active) AS active_tenant_memberships,
 (SELECT count(*) FROM public.tenant_memberships tm
  LEFT JOIN auth.users u ON u.id=tm.user_id WHERE u.id IS NULL) AS orphaned_auth_memberships,
 (SELECT count(*) FROM public.tenant_memberships tm
  LEFT JOIN public.tenants t ON t.id=tm.tenant_id WHERE t.id IS NULL) AS orphaned_tenant_memberships,
 (SELECT count(*) FROM public.products p
  LEFT JOIN public.tenants t ON t.id=p.tenant_id WHERE t.id IS NULL) AS orphaned_products,
 (SELECT count(*) FROM public.orders o
  LEFT JOIN public.tenants t ON t.id=o.tenant_id WHERE t.id IS NULL) AS orphaned_orders,
 (SELECT count(*) FROM public.products) AS legacy_products_pending_store_attribution,
 (SELECT count(*) FROM public.orders) AS legacy_orders_pending_store_attribution;

SELECT table_name
FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('stores','store_memberships')
ORDER BY table_name;

SELECT table_name,column_name,data_type
FROM information_schema.columns
WHERE table_schema='public' AND column_name='store_id'
 AND table_name IN ('products','customers','orders','order_items',
  'conversations','messages','tenant_agent_configs')
ORDER BY table_name;

SELECT schemaname,tablename,policyname,permissive,cmd,
       (qual ILIKE '%tenant_memberships%') AS checks_tenant_membership,
       (qual ILIKE '%store_memberships%') AS checks_store_membership
FROM pg_policies
WHERE schemaname='public' AND tablename IN
 ('products','customers','orders','order_items','conversations','messages','tenant_agent_configs')
ORDER BY tablename,policyname;

SELECT n.nspname AS schema_name,p.proname AS function_name,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product')
ORDER BY p.proname;

COMMIT;
