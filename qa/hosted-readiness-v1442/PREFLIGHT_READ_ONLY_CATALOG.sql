-- TIEN404 AI V14.4.2 / HOSTED PREFLIGHT — READ-ONLY INVENTORY.
-- DO NOT PASTE CUSTOMER DATA OR SECRETS INTO GITHUB.
-- DO NOT RUN any earlier V14.2 migration proposal; that file deliberately aborts.
-- This query performs SELECT only, never DDL/DML, GRANT/REVOKE, pg_dump,
-- Auth session impersonation, profile reads or Store ownership backfill.
-- Always verify selected Supabase project ref in UI: ifxlvrhyjhbzbrkdsida.
WITH
 core AS (
   SELECT c.oid,c.relname as table_name,c.relrowsecurity as rls_on,
          c.relforcerowsecurity as force_rls,
          EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid
            AND a.attname='store_id' AND NOT a.attisdropped) as has_store_id
   FROM pg_class c
   JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p')
     AND c.relname IN ('products','customers','orders','order_items','conversations','messages')
 ),
 read_policies AS (
   SELECT p.polrelid,COUNT(*) FILTER(WHERE p.polcmd='r' AND p.polpermissive) as permissive_reads,
          array_agg(p.polname::text ORDER BY p.polname) FILTER(WHERE p.polcmd='r') as read_names
   FROM pg_policy p WHERE p.polrelid IN (SELECT oid FROM core)
   GROUP BY p.polrelid
 ),
 rpc AS (
  SELECT p.proname as name,p.prosecdef as security_definer,
   has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
   has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
   position('store_id' in lower(pg_get_functiondef(p.oid)))>0 as mentions_store_id
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN ('save_merchant_product','qa_owner_pairing','qa_shop_b_zalo_claim')
 ),
 sku_key AS (
  SELECT c.conname,pg_get_constraintdef(c.oid) as definition
  FROM pg_constraint c
  WHERE c.conrelid='public.products'::regclass
    AND c.contype='u' AND c.conname='products_tenant_id_sku_key'
 )
SELECT jsonb_build_object(
 'source','SUPABASE_READ_ONLY_CATALOG_INSPECTION',
 'postgres_version',current_setting('server_version'),
 'schema_present',jsonb_build_object(
   'stores',to_regclass('public.stores') IS NOT NULL,
   'store_memberships',to_regclass('public.store_memberships') IS NOT NULL,
   'knowledge_releases',to_regclass('app_private.shop_knowledge_releases') IS NOT NULL
 ),
 'row_counts',jsonb_build_object(
    'products',(SELECT count(*) FROM public.products),
    'orders',(SELECT count(*) FROM public.orders),
    'customers',(SELECT count(*) FROM public.customers),
    'order_items',(SELECT count(*) FROM public.order_items),
    'conversations',(SELECT count(*) FROM public.conversations),
    'messages',(SELECT count(*) FROM public.messages)
 ),
 'core_tables',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'table',c.table_name,'rls_on',c.rls_on,'force_rls',c.force_rls,
  'has_store_id',c.has_store_id,
  'permissive_select_count',coalesce(r.permissive_reads,0),
  'read_policy_names',coalesce(to_jsonb(r.read_names),'[]'::jsonb)
 ) ORDER BY c.table_name),'[]'::jsonb)
 FROM core c LEFT JOIN read_policies r ON r.polrelid=c.oid),
 'tenant_sku_unique',(SELECT count(*)>0 FROM sku_key),
 'security_definer_rpcs',(SELECT coalesce(jsonb_agg(to_jsonb(rpc) ORDER BY name),'[]'::jsonb)
                           FROM rpc)
) AS v1442_preflight_read_only;
