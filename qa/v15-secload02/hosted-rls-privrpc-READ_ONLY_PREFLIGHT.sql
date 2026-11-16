-- TIEN404 V15-SECLOAD-02 — READ-ONLY AUTHORIZATION / RLS REVIEW
-- Host: known Supabase STAGING only; no rows, customer records or credentials.
-- Do not insert/alter/grant/revoke or execute ANY business RPC.
BEGIN TRANSACTION READ ONLY;
SELECT current_setting('server_version') AS postgres_version,
 (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='stores') AS canonical_stores,
 (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='store_memberships') AS store_memberships,
 (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='store_id' AND table_name IN ('products','orders','customers','messages','conversations','tenant_agent_configs')) AS commerce_store_id_columns;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
 (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count,
 (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname
 AND (coalesce(p.qual,'') || ' ' || coalesce(p.with_check,'')) ILIKE '%store_id%') AS store_policy_count,
 (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname
 AND (coalesce(p.qual,'') || ' ' || coalesce(p.with_check,'')) ILIKE '%auth.uid%') AS auth_uid_policy_count
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
AND c.relname IN ('tenants','tenant_memberships','products','orders',
 'customers','messages','conversations','tenant_agent_configs')
ORDER BY 1;

SELECT p.proname AS rpc_name,
 pg_get_userbyid(p.proowner) AS owner_role,
 p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_executable,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_executable,
 p.proconfig IS NOT NULL AND array_to_string(p.proconfig,';') ILIKE '%search_path%' AS search_path_configured,
 encode(extensions.digest(convert_to(pg_get_functiondef(p.oid),'UTF8'),'sha256'),'hex') AS body_sha256
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product')
ORDER BY 1;
COMMIT;

-- No pg_get_functiondef result body, Vault/PSID, JWT or customer row in
-- this output. Structure-only review does NOT certify exploit resistance.
