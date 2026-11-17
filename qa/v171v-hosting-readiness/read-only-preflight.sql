-- TIEN404 V17.1V: READ-ONLY AGGREGATE PREFLIGHT. No IDs/JWT/PII.
BEGIN TRANSACTION READ ONLY;
SELECT
 (SELECT COUNT(DISTINCT tenant_key)::int FROM tien404_r1_qa.tenant_identity_map) qa_tenant_count,
 (SELECT COUNT(DISTINCT store_key)::int FROM tien404_r1_qa.tenant_identity_map) qa_store_count,
 (SELECT COUNT(*)::int FROM tien404_r1_qa.owner_bindings) qa_owner_binding_count,
 (SELECT COUNT(*)::int FROM (
   SELECT tenant_key FROM tien404_r1_qa.owner_bindings
   GROUP BY tenant_key HAVING COUNT(DISTINCT store_key)>=2
   AND COUNT(DISTINCT owner_ref)>=2
 ) x) actual_same_tenant_distinct_store_owner_pairs,
 (SELECT COUNT(*)::int FROM (
   SELECT m.tenant_id FROM auth.sessions s
   JOIN public.tenant_memberships m ON m.user_id=s.user_id
   WHERE m.active GROUP BY m.tenant_id
   HAVING COUNT(DISTINCT s.user_id)>=2
 ) x) actual_two_distinct_owner_auth_session_tenant_pairs,
 (SELECT COUNT(*)::int FROM information_schema.columns
   WHERE table_schema='public' AND table_name IN ('products','orders','customers')
   AND column_name='store_id') legacy_core_store_id_column_count,
 (SELECT COUNT(*)::int FROM pg_policies
   WHERE schemaname='public' AND tablename IN ('products','orders','customers')
   AND qual ILIKE '%store%') legacy_core_store_scope_policies;
SELECT p.proname AS privileged_qa_function,p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='qa_shop_b_zalo_claim';
ROLLBACK;
