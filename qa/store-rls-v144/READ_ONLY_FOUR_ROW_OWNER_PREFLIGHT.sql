-- TIEN404 AI V14.4A.1 — READ-ONLY row-ownership evidence preflight
-- No record IDs, customer details, phone numbers, credentials or Order contents.
-- This query confirms aggregate consistency ONLY, NOT store ownership.
-- Run only with approved read-only SQL access on tien404-staging.

-- 1. Exactly four Commerce rows currently require private owner mapping.
WITH core AS (
 SELECT tenant_id,'products'::text AS kind,count(*)::int AS row_count
 FROM public.products GROUP BY tenant_id
 UNION ALL
 SELECT tenant_id,'orders'::text AS kind,count(*)::int
 FROM public.orders GROUP BY tenant_id
),
qa_candidates AS (
 SELECT auth_tenant_id,count(DISTINCT store_key)::int AS synthetic_candidate_count,
 min(store_key) AS candidate_alias
 FROM tien404_r1_qa.tenant_identity_map GROUP BY auth_tenant_id
)
SELECT t.slug AS qa_tenant_alias,r.kind,r.row_count,
 q.synthetic_candidate_count,q.candidate_alias,
 'CANDIDATE_ONLY_NOT_OWNER_APPROVED'::text AS evidence_status
FROM core r JOIN public.tenants t ON t.id=r.tenant_id
LEFT JOIN qa_candidates q ON q.auth_tenant_id=r.tenant_id
ORDER BY t.slug,r.kind;

-- 2. Current Store schema and column expansion readiness.
SELECT to_regclass('public.stores') IS NOT NULL AS stores_present,
 to_regclass('public.store_memberships') IS NOT NULL AS store_memberships_present,
 EXISTS(SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='products'
 AND column_name='store_id') AS product_store_scope_present,
 FALSE AS approved_to_apply_migration,
 FALSE AS approved_to_backfill,
 FALSE AS approved_to_replace_rls;

-- 3. Existing cross-Store OR-permissive policy risk, names only.
SELECT tablename,policyname,permissive,cmd,roles
FROM pg_policies WHERE schemaname='public'
AND tablename IN ('products','orders','customers','order_items','conversations','messages')
AND cmd IN ('SELECT','ALL')
ORDER BY tablename,policyname;

-- 4. Security-definer privileges requiring review. NO function invocation.
SELECT p.proname,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_executable,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_executable
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
AND p.proname IN ('qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product')
ORDER BY p.proname;
