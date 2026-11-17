-- V17.1T PRIVATE OWNER AUTH STORE ADMISSION -- READ ONLY PREFLIGHT
-- Do NOT insert, update, authenticate, log tokens, or enumerate user IDs.
BEGIN TRANSACTION READ ONLY;
SELECT
 (SELECT count(DISTINCT tenant_key)::int FROM tien404_r1_qa.tenant_identity_map) AS qa_mapped_tenants,
 (SELECT count(DISTINCT store_key)::int FROM tien404_r1_qa.tenant_identity_map) AS qa_mapped_stores,
 (SELECT count(*)::int FROM tien404_r1_qa.owner_bindings b
     JOIN tien404_r1_qa.tenant_identity_map m
       ON m.tenant_key=b.tenant_key AND m.store_key=b.store_key) AS owner_links,
 (SELECT count(*)::int FROM (
      SELECT tenant_key FROM tien404_r1_qa.owner_bindings
      GROUP BY tenant_key HAVING count(DISTINCT store_key)>=2
           AND count(DISTINCT owner_ref)>=2
   ) dual) AS same_tenant_two_store_distinct_owners,
 (SELECT count(*)::int FROM (
      SELECT m.tenant_id FROM auth.sessions s
      JOIN public.tenant_memberships m ON m.user_id=s.user_id AND m.active
      GROUP BY m.tenant_id HAVING count(DISTINCT s.user_id)>=2
   ) paired) AS same_tenant_two_active_auth_session_members,
 (SELECT count(*)::int FROM pg_policies
     WHERE schemaname='public'
     AND tablename IN ('products','orders','customers')
     AND qual ILIKE '%store%') AS core_store_scope_policies,
 (SELECT count(*)::int FROM information_schema.columns
     WHERE table_schema='public'
     AND table_name IN ('products','orders','customers')
     AND column_name='store_id') AS core_store_id_columns,
 (SELECT has_function_privilege('anon',p.oid,'EXECUTE')
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='qa_shop_b_zalo_claim'
     ORDER BY p.oid LIMIT 1) AS legacy_privileged_claim_anon_executable;
ROLLBACK;
