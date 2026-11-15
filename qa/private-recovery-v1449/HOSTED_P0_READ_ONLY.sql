-- TIEN404 V14.4.9 | HOSTED READ-ONLY P0 PRECHECK
-- Project: tien404-staging only, verify project ref externally first.
-- SELECT metadata and aggregate counts ONLY. No row/tenant/user IDs,
-- no emails, order details, credential/token hashes, Auth profile data.
WITH fk AS (
 SELECT count(*)::integer AS total, count(DISTINCT k.conrelid)::integer AS dependent_tables
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE k.contype='f' AND k.confrelid='auth.users'::regclass
 AND n.nspname IN ('public','app_private','factory_private',
 'tien404_dialogue_private','tien404_r1_qa')
), core AS (
 SELECT c.oid,c.relname AS table_name,c.relrowsecurity,c.relforcerowsecurity,
 EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid
  AND a.attname='store_id' AND NOT a.attisdropped) AS store_id_present,
 EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid
  AND a.attname='updated_at' AND NOT a.attisdropped) AS has_updated_at
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
  AND c.relname IN ('products','orders','order_items','customers','conversations','messages')
), perms AS (
 SELECT count(*)::integer AS old_tenant_reads FROM pg_policy p
 JOIN core c ON c.oid=p.polrelid
 WHERE p.polcmd='r' AND p.polpermissive
  AND pg_get_expr(p.polqual,p.polrelid) ILIKE '%tenant_memberships%'
  AND pg_get_expr(p.polqual,p.polrelid) NOT ILIKE '%store_id%'
)
SELECT jsonb_build_object(
 'version','V14_4_9_HOSTED_METADATA_ONLY',
 'pg_version',current_setting('server_version'),
 'auth_users',(SELECT count(*) FROM auth.users),
 'auth_fk_count',(SELECT total FROM fk),
 'auth_dependent_tables',(SELECT dependent_tables FROM fk),
 'products',(SELECT count(*) FROM public.products),
 'orders',(SELECT count(*) FROM public.orders),
 'tenant_memberships',(SELECT count(*) FROM public.tenant_memberships),
 'stores_present',to_regclass('public.stores') IS NOT NULL,
 'store_memberships_present',to_regclass('public.store_memberships') IS NOT NULL,
 'core_table_count',(SELECT count(*) FROM core),
 'core_rls_enabled',(SELECT count(*) FROM core WHERE relrowsecurity),
 'core_force_rls',(SELECT count(*) FROM core WHERE relforcerowsecurity),
 'core_store_id_columns',(SELECT count(*) FROM core WHERE store_id_present),
 'legacy_permissive_tenant_reads',(SELECT old_tenant_reads FROM perms),
 'product_updated_at_exists',(SELECT has_updated_at FROM core WHERE table_name='products'),
 'order_updated_at_exists',(SELECT has_updated_at FROM core WHERE table_name='orders')
) AS anonymous_recovery_gate;
