-- TIEN404 AI V14.4.7 | READ-ONLY HOSTED POSTURE REPORT
-- ALLOWED: SELECT against pg_catalog, function ACL metadata and aggregate counts.
-- FORBIDDEN: DDL, DML, GRANT, REVOKE, executing RPC, raw row/customer/secret output.
-- Operator must verify target project is staging ifxlvrhyjhbzbrkdsida.
WITH core AS (
 SELECT c.oid,c.relname AS table_name,c.relrowsecurity AS rls_on,
        c.relforcerowsecurity AS force_rls,
        EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid
          AND a.attname='store_id' AND NOT a.attisdropped) AS store_id_present
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
   AND c.relname IN ('products','orders','order_items','customers','conversations','messages')
), legacy AS (
 SELECT c.table_name,COUNT(p.oid) FILTER(
    WHERE p.polcmd='r' AND p.polpermissive AND
      pg_get_expr(p.polqual,p.polrelid) ILIKE '%tenant_memberships%'
      AND pg_get_expr(p.polqual,p.polrelid) NOT ILIKE '%store_id%'
 ) AS old_tenant_wide_permissive_reads
 FROM core c LEFT JOIN pg_policy p ON p.polrelid=c.oid
 GROUP BY c.table_name
), rpc AS (
 SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS signature,
        p.prosecdef AS definer,
        has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
        has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
        position('store_id' IN lower(pg_get_functiondef(p.oid)))>0 AS references_store_id
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
   AND p.proname IN ('save_merchant_product','save_merchant_product_v2',
                   'qa_owner_pairing','qa_shop_b_zalo_claim')
)
SELECT jsonb_build_object(
 'tag','V14.4.7_READ_ONLY_HOSTED_POSTURE',
 'postgres_version',current_setting('server_version'),
 'store_tables_present',jsonb_build_object(
   'stores',to_regclass('public.stores') IS NOT NULL,
   'store_memberships',to_regclass('public.store_memberships') IS NOT NULL),
 'core_table_count',(SELECT count(*) FROM core),
 'core_tables',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table',c.table_name,'rls',c.rls_on,'force_rls',c.force_rls,
      'store_id',c.store_id_present,'legacy_tenant_wide_read',
      l.old_tenant_wide_permissive_reads) ORDER BY c.table_name),'[]'::jsonb)
   FROM core c JOIN legacy l USING(table_name)),
 'app_row_counts',jsonb_build_object(
   'products',(SELECT count(*) FROM public.products),
   'orders',(SELECT count(*) FROM public.orders)),
 'rpc_acl',(SELECT coalesce(jsonb_agg(to_jsonb(rpc) ORDER BY proname),'[]'::jsonb) FROM rpc)
) AS audit_report;
