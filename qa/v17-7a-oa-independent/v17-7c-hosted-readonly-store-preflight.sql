-- TIEN404 V17.7C — PII-free, READ-ONLY hosted Store RLS preflight.
-- Run ONLY on approved Supabase STAGING project ifxlvrhyjhbzbrkdsida.
-- This DOES NOT impersonate a merchant JWT, read customer/order rows,
-- run DDL/DML, change policies, create fixtures, or prove cross-store RLS.
-- A policy that mentions store_id/store_key is not automatically safe;
-- any such result is UNREVIEWED and must receive independent policy analysis.

WITH public_surfaces AS (
  SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls,
    EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid=c.oid
        AND a.attnum>0 AND NOT a.attisdropped
        AND a.attname='tenant_id'
    ) AS tenant_id_present,
    EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid=c.oid
        AND a.attnum>0 AND NOT a.attisdropped
        AND a.attname='store_id'
    ) AS store_id_present,
    (
      SELECT count(*) FROM pg_policy pol
      WHERE pol.polrelid=c.oid AND pol.polcmd='r'
    ) AS select_policy_count,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname='public'
        AND p.tablename=c.relname
        AND p.cmd='SELECT'
        AND (p.qual ILIKE '%store_id%' OR p.qual ILIKE '%store_key%')
    ) THEN 'UNREVIEWED_STORE_PREDICATE'
    ELSE 'TENANT_ONLY_OR_NO_EXPLICIT_STORE_PREDICATE'
    END AS store_policy_preflight
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND c.relkind IN ('r','p')
    AND c.relname IN (
      'products','orders','order_items',
      'customers','conversations','messages'
    )
),
tenant_counts AS (
  SELECT tenant_key,count(DISTINCT store_key) AS stores
  FROM tien404_r1_qa.tenant_identity_map
  GROUP BY tenant_key
)
SELECT
  (SELECT count(*) FROM public_surfaces) AS commerce_public_surface_count,
  (SELECT count(*) FROM public_surfaces WHERE rls_enabled AND force_rls)
    AS protected_surface_count,
  (SELECT count(*) FROM public_surfaces WHERE tenant_id_present)
    AS tenant_column_count,
  (SELECT count(*) FROM public_surfaces WHERE store_id_present)
    AS store_column_count,
  (SELECT count(*) FROM public_surfaces
    WHERE store_policy_preflight='UNREVIEWED_STORE_PREDICATE')
    AS needs_manual_store_policy_review_count,
  (SELECT count(*) FROM tenant_counts) AS qa_tenant_count,
  (SELECT coalesce(max(stores),0) FROM tenant_counts)
    AS qa_max_stores_in_one_tenant,
  (SELECT count(*) FROM tenant_counts WHERE stores>=2)
    AS qa_tenants_with_two_stores,
  'REAL_JWT_RLS_NOT_EXECUTED' AS real_jwt_rls_status,
  'NO_SEND_NO_WRITE' AS admission_mode;
