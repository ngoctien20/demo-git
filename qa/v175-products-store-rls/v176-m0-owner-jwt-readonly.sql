-- TIEN404 V17.6: OPERATOR-READY PII-FREE M0/JWT-RLS READ-ONLY PREFLIGHT
-- Target Supabase project: ifxlvrhyjhbzbrkdsida (staging only).
-- Both result sets were independently obtained using the connected Supabase
-- SQL interface on 2026-11-17 (JST); rerun for a fresh timestamp.
-- SELECT/CTE only. No actual JWT, row IDs, Auth identities, restore or writes.
-- DO NOT interpret tenant-owner membership as Store ownership.
WITH pt AS (SELECT tenant_id,count(*) AS n FROM public.products GROUP BY tenant_id),
     ot AS (SELECT tenant_id,count(*) AS n FROM public.orders GROUP BY tenant_id),
     own AS (SELECT tenant_id,count(*) AS n
             FROM public.tenant_memberships
             WHERE active AND role='owner' GROUP BY tenant_id)
SELECT
 (SELECT count(*) FROM public.tenants) AS tenants,
 (SELECT count(*) FROM public.products) AS products,
 (SELECT count(*) FROM public.orders) AS orders,
 (SELECT count(*) FROM public.customers) AS customers,
 (SELECT count(*) FROM public.tenant_memberships) AS all_memberships,
 (SELECT count(*) FROM public.tenant_memberships
  WHERE active AND role='owner') AS active_owner_memberships,
 (SELECT count(*) FROM auth.users) AS auth_users_count_only,
 (SELECT count(*) FROM storage.buckets) AS storage_buckets_count_only,
 (SELECT count(*) FROM storage.objects) AS storage_objects_count_only,
 (SELECT count(*) FROM pt WHERE n=1) AS tenants_with_one_product,
 (SELECT count(*) FROM ot WHERE n=1) AS tenants_with_one_order,
 (SELECT count(*) FROM own WHERE n>=1) AS tenants_with_active_owner,
 (SELECT count(*) FROM pt p JOIN ot o USING (tenant_id)
                   JOIN own w USING (tenant_id)
  WHERE p.n=1 AND o.n=1 AND w.n>=1) AS tenants_with_product_order_owner,
 (to_regclass('public.stores') IS NOT NULL) AS has_canonical_stores,
 (to_regclass('public.store_memberships') IS NOT NULL) AS has_store_memberships;

-- JWT/RLS SCHEMA PREFLIGHT ONLY: never claim a real signed JWT was supplied.
WITH target(name) AS (
 VALUES ('products'),('orders'),('order_items'),
        ('customers'),('conversations'),('messages')
), tbl AS (
 SELECT t.name,c.oid AS rel,
        coalesce(c.relrowsecurity,false) AS rls,
        coalesce(c.relforcerowsecurity,false) AS force_rls,
        EXISTS(SELECT 1 FROM information_schema.columns ic
          WHERE ic.table_schema='public'
            AND ic.table_name=t.name AND ic.column_name='store_id') AS has_store_id
 FROM target t
 LEFT JOIN pg_class c ON c.relname=t.name
  AND c.relnamespace='public'::regnamespace AND c.relkind IN('r','p')
)
SELECT t.name,t.rls,t.force_rls,t.has_store_id,
 coalesce((SELECT count(*) FROM pg_policies p
   WHERE p.schemaname='public' AND p.tablename=t.name),0) AS policy_count,
 coalesce((SELECT count(*) FROM pg_policies p
   WHERE p.schemaname='public' AND p.tablename=t.name AND p.permissive='PERMISSIVE'),0) AS permissive_count,
 coalesce((SELECT count(*) FROM pg_policies p
   WHERE p.schemaname='public' AND p.tablename=t.name
     AND (coalesce(p.qual,'') ILIKE '%store%'
       OR coalesce(p.with_check,'') ILIKE '%store%')),0) AS store_qualified_count,
 has_table_privilege('anon',t.rel,'SELECT') AS anon_select,
 has_table_privilege('authenticated',t.rel,'SELECT') AS authenticated_select,
 has_table_privilege('authenticated',t.rel,'INSERT') AS authenticated_insert,
 has_table_privilege('authenticated',t.rel,'UPDATE') AS authenticated_update,
 has_table_privilege('authenticated',t.rel,'DELETE') AS authenticated_delete
FROM tbl t ORDER BY t.name;

-- Acceptance remains BLOCKED without primary four-row Store provenance,
-- current independently restored backup, real SAME-TENANT Shop A/B signed JWTs,
-- transactional RLS allow+deny tests, and phase-scoped operator authorization.
