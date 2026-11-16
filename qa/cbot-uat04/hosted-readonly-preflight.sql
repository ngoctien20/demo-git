-- CBOT-UAT-04 — SOURCE-ONLY HOSTED READ-ONLY PREFLIGHT.
-- Safe metadata/counts. This file DOES NOT perform an order lookup or access PII.
-- Execute only on the explicitly authorized staging project through a READ-ONLY SQL
-- console/connector. No DDL, SET ROLE, ALTER, GRANT, SECURITY DEFINER or RPC calls.
WITH sys AS (
 SELECT
 (SELECT count(*) FROM public.tenants) AS tenant_count,
 (SELECT count(*) FROM public.products) AS product_count,
 (SELECT count(*) FROM public.orders) AS order_count,
 (SELECT count(*) FROM public.customers) AS customer_count,
 EXISTS (SELECT 1 FROM information_schema.tables
   WHERE table_schema='public' AND table_name='stores') AS stores_present,
 EXISTS (SELECT 1 FROM information_schema.tables
   WHERE table_schema='public' AND table_name='store_memberships') AS store_memberships_present,
 EXISTS (SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='orders' AND column_name='store_id') AS orders_store_id_present,
 EXISTS (SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='products' AND column_name='store_id') AS products_store_id_present
),
rpc AS (
 SELECT count(*) AS found,
 bool_or(p.prosecdef) AS is_definer,
 bool_or(has_function_privilege('anon',p.oid,'EXECUTE')) AS anon_executable
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='qa_shop_b_zalo_claim'
),
policies AS (
 SELECT count(*) FILTER (WHERE tablename='orders') AS order_rls_policies
 FROM pg_policies WHERE schemaname='public'
)
SELECT json_build_object(
 'tenant_count',sys.tenant_count,
 'product_count',sys.product_count,
 'order_count',sys.order_count,
 'customer_count',sys.customer_count,
 'stores_present',sys.stores_present,
 'store_memberships_present',sys.store_memberships_present,
 'orders_store_id_present',sys.orders_store_id_present,
 'products_store_id_present',sys.products_store_id_present,
 'legacy_rpc_exists',rpc.found=1,
 'legacy_rpc_definer',rpc.is_definer,
 'legacy_rpc_anon_execute',rpc.anon_executable,
 'orders_rls_policy_count',policies.order_rls_policies
) AS read_only_preflight
FROM sys,rpc,policies;
