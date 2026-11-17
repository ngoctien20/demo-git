-- V17.1X — aggregate-only Supabase QA eligibility; NO AUTH/ROLE/RLS writes.
BEGIN TRANSACTION READ ONLY;
SELECT
 (SELECT count(DISTINCT tenant_key)::int FROM tien404_r1_qa.tenant_identity_map) qa_mapped_tenants,
 (SELECT count(DISTINCT store_key)::int FROM tien404_r1_qa.tenant_identity_map) qa_mapped_stores,
 (SELECT count(*)::int FROM (SELECT tenant_key FROM tien404_r1_qa.owner_bindings
  GROUP BY tenant_key HAVING count(DISTINCT store_key)>=2 AND count(DISTINCT owner_ref)>=2) x) qualifying_same_tenant_dual_store_owner_pairs,
 (SELECT count(*)::int FROM (SELECT m.tenant_id FROM auth.sessions s
  JOIN public.tenant_memberships m ON m.user_id=s.user_id AND m.active
  GROUP BY m.tenant_id HAVING count(DISTINCT s.user_id)>=2) x) qualifying_shared_tenant_auth_session_pairs,
 (SELECT count(*)::int FROM pg_policies
   WHERE schemaname='public' AND tablename IN ('products','orders','customers')
   AND qual ILIKE '%store%') legacy_commerce_store_policies;
ROLLBACK;
