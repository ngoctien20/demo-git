-- TIEN404 V17.7 M0 RECOVERY + STORE OWNERSHIP (READ-ONLY METADATA)
-- Project: ifxlvrhyjhbzbrkdsida | checked 2026-11-17 JST
-- Never SELECT real row IDs, owner emails, phones, JWTs, credentials or backup bytes.
-- This is NOT a recoverability test, Store provenance proof or JWT acceptance test.
WITH pc AS (
  SELECT tenant_id, count(*) AS n FROM public.products GROUP BY tenant_id
), oc AS (
  SELECT tenant_id, count(*) AS n FROM public.orders GROUP BY tenant_id
), mw AS (
  SELECT tenant_id, count(*) AS n FROM public.tenant_memberships
  WHERE active AND role = 'owner' GROUP BY tenant_id
), core AS (
  SELECT count(*) FILTER(WHERE column_name = 'store_id') AS store_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN
      ('products','orders','customers','order_items','conversations','messages')
)
SELECT
  (SELECT count(*) FROM public.tenants) AS tenant_count,
  (SELECT count(*) FROM public.products) AS product_count,
  (SELECT count(*) FROM public.orders) AS order_count,
  (SELECT count(*) FROM public.customers) AS customer_count,
  (SELECT count(*) FROM public.tenant_memberships
    WHERE active AND role = 'owner') AS owner_membership_count,
  (SELECT count(*) FROM pc p
    JOIN oc o USING(tenant_id)
    JOIN mw m USING(tenant_id)
    WHERE p.n=1 AND o.n=1 AND m.n>=1) AS tenants_with_product_order_owner,
  (SELECT count(*) FROM auth.users) AS auth_users_count,
  (SELECT count(*) FROM storage.buckets) AS storage_bucket_count,
  (SELECT count(*) FROM storage.objects) AS storage_object_count,
  (SELECT store_cols FROM core) AS core_store_id_columns,
  (to_regclass('public.stores') IS NOT NULL) AS canonical_stores_exist,
  (to_regclass('public.store_memberships') IS NOT NULL) AS store_memberships_exist,
  (SELECT count(*) FROM pg_policies p
   WHERE p.schemaname='public'
     AND p.tablename IN ('products','orders','customers','order_items','conversations','messages')
     AND (coalesce(p.qual,'') ILIKE '%store_id%'
       OR coalesce(p.with_check,'') ILIKE '%store_id%')
  ) AS store_qualified_policies,
  (SELECT count(*) FROM pg_proc pr
    JOIN pg_namespace ns ON pr.pronamespace=ns.oid
   WHERE ns.nspname='public' AND pr.prosecdef
     AND has_function_privilege('anon',pr.oid,'EXECUTE')
  ) AS anon_definer_executable_count;

-- At verification:
-- tenant_count=2, product_count=2, order_count=2, customer_count=0
-- owner_membership_count=3, tenants_with_product_order_owner=2
-- auth_users_count=3, storage_bucket_count=0, storage_object_count=0
-- core_store_id_columns=0, canonical_stores_exist=false
-- store_memberships_exist=false, store_qualified_policies=0
-- anon_definer_executable_count=1
-- M0_RECOVERY=NO_GO; ORIGINAL_4_ROW_STORE_AUTHORITY=NOT_INDEPENDENTLY_VERIFIED
-- COMMERCIAL_STORE_RLS=NO_GO; no mutation may be inferred from this check.
