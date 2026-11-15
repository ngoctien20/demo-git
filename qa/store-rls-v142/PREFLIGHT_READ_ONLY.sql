-- TIEN404 V14.2 — READ-ONLY PREFLIGHT FOR HUMAN REVIEW
-- Safe to run on tien404-staging using Supabase SQL editor.
-- This is a set of SELECT statements ONLY: NO DDL, DML, impersonation, JWT, secrets.
-- Evidence generated here is NOT a database backup or ownership confirmation.

-- A. Core schema and blocked dependencies.
SELECT
  to_regclass('public.stores') IS NOT NULL AS canonical_stores_exist,
  to_regclass('public.store_memberships') IS NOT NULL AS store_assignments_exist,
  to_regclass('app_private.shop_knowledge_releases') IS NOT NULL AS knowledge_releases_exist,
  to_regclass('app_private.shop_knowledge_items') IS NOT NULL AS knowledge_items_exist,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='store_id'
  ) AS products_store_id_exists;

-- B. No row values or customer identifiers leave the database.
SELECT 'products' AS table_name, count(*) AS row_count FROM public.products
UNION ALL SELECT 'orders', count(*) FROM public.orders
UNION ALL SELECT 'customers', count(*) FROM public.customers
UNION ALL SELECT 'order_items', count(*) FROM public.order_items
UNION ALL SELECT 'conversations', count(*) FROM public.conversations
UNION ALL SELECT 'messages', count(*) FROM public.messages
ORDER BY table_name;

-- C. Map candidate ONLY, never ownership approval or safe backfill consent.
WITH qa_candidate AS (
  SELECT auth_tenant_id, count(DISTINCT store_key) candidate_count, min(store_key) candidate
  FROM tien404_r1_qa.tenant_identity_map GROUP BY auth_tenant_id
), records AS (
  SELECT tenant_id, 'products' kind, count(*) AS row_count FROM public.products GROUP BY tenant_id
  UNION ALL
  SELECT tenant_id, 'orders' kind, count(*) FROM public.orders GROUP BY tenant_id
)
SELECT t.slug AS qa_tenant_slug,r.kind,r.row_count,
       c.candidate_count,c.candidate,
       'SYNTHETIC_CANDIDATE_NOT_OWNERSHIP_VERIFIED' AS evidence_level
FROM records r
JOIN public.tenants t ON t.id=r.tenant_id
LEFT JOIN qa_candidate c ON c.auth_tenant_id=r.tenant_id
ORDER BY t.slug,r.kind;

-- D. Spot permissive OR widening risks BEFORE drafting any policy replacement.
SELECT tablename,policyname,permissive,cmd,roles
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('products','orders','customers','order_items','conversations','messages')
ORDER BY tablename,policyname;

-- E. Security-definer exposure: names and roles only; never extract secrets.
SELECT p.proname,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_executable,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_executable
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
ORDER BY p.proname;

-- F. Critical uniqueness and referential constraints.
SELECT c.conname,rel.relname AS table_name,pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class rel ON rel.oid=c.conrelid
JOIN pg_namespace n ON n.oid=rel.relnamespace
WHERE n.nspname='public' AND c.contype IN ('u','f','p')
 AND rel.relname IN ('products','orders','order_items','customers','conversations','messages')
ORDER BY rel.relname,c.conname;

-- G. This is a deliberate STOP indicator, not an automatic approval.
SELECT 'BLOCKED_UNTIL_BACKUP_RESTORE_TEST_OWNER_MAPPINGS_ROLLBACK_SIGNOFF_AND_HOSTED_JWT_QA' AS release_gate,
       false AS safe_to_apply_ddl,
       false AS approved_to_backfill,
       false AS approved_to_replace_rls;
