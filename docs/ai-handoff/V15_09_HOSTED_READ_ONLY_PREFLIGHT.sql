-- V15.0-09 — READ ONLY hosted metadata preflight. SELECT ONLY.
-- Do NOT use this alone as proof of real authenticated JWT/RLS isolation.
-- Inspect results privately. Never publish auth IDs, credential values or customer data.

-- 1) Canonical Store tables / column coverage.
SELECT table_schema,table_name, bool_or(column_name='store_id') AS has_store_id,
       bool_or(column_name='tenant_id') AS has_tenant_id
FROM information_schema.columns
WHERE table_schema='public'
 AND table_name IN ('stores','store_memberships','products','customers','orders',
                   'order_items','conversations','messages','tenant_agent_configs')
GROUP BY table_schema,table_name ORDER BY table_name;

-- 2) RLS coverage (do not equate FORCE RLS to per-Store authorization).
SELECT n.nspname||'.'||c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
AND c.relname IN ('products','customers','orders','order_items','conversations','messages',
                  'tenant_agent_configs','tenant_memberships','stores','store_memberships')
ORDER BY c.relname;

-- 3) Aggregate owner/Store proof only; omit identifiers and personal data.
SELECT (SELECT count(*) FROM auth.users) AS users,
 (SELECT count(*) FROM public.tenants) AS tenants,
 (SELECT count(*) FROM public.tenant_memberships WHERE active) AS active_memberships,
 (SELECT count(*) FROM tien404_r1_qa.tenant_identity_map) AS qa_identity_map,
 (SELECT count(*) FROM tien404_r1_qa.owner_bindings WHERE status='paired') AS qa_paired_owner_bindings,
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_claims_v3 WHERE status='CONFIRMED') AS qa_synthetic_confirmed_claims,
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_claims_v3 WHERE status='PENDING_OWNER_CONFIRMATION') AS qa_synthetic_pending_claims;

-- 4) RPC security surface; report BOOLEAN privilege, never function bodies/secrets.
SELECT n.nspname||'.'||p.proname AS function_name,p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_executable,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_executable,
 (POSITION('auth.uid' IN LOWER(pg_get_functiondef(p.oid)))>0) AS references_auth_uid
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
 AND p.proname IN ('qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product')
ORDER BY p.proname;

-- 5) Cross-tenant FK integrity aggregate; no row values.
SELECT (SELECT count(*) FROM public.products p WHERE NOT EXISTS
  (SELECT 1 FROM public.tenants t WHERE t.id=p.tenant_id)) AS orphan_products,
 (SELECT count(*) FROM public.orders o WHERE NOT EXISTS
  (SELECT 1 FROM public.tenants t WHERE t.id=o.tenant_id)) AS orphan_orders;
