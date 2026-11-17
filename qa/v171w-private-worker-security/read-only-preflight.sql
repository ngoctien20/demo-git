-- V17.1W -- READ ONLY, aggregate-only, no JWT/PII retrieved.
BEGIN READ ONLY;
SELECT
 (SELECT COUNT(DISTINCT tenant_key)::int FROM tien404_r1_qa.tenant_identity_map) qa_tenant_count,
 (SELECT COUNT(DISTINCT store_key)::int FROM tien404_r1_qa.tenant_identity_map) qa_store_count,
 (SELECT COUNT(*)::int FROM (
  SELECT tenant_key FROM tien404_r1_qa.owner_bindings
  GROUP BY tenant_key HAVING COUNT(DISTINCT store_key)>=2 AND COUNT(DISTINCT owner_ref)>=2
 ) eligible) same_tenant_two_owner_store_pairs,
 (SELECT COUNT(*)::int FROM (
  SELECT m.tenant_id FROM auth.sessions s
  JOIN public.tenant_memberships m ON m.user_id=s.user_id AND m.active
  GROUP BY m.tenant_id HAVING COUNT(DISTINCT s.user_id)>=2
 ) eligible) two_active_user_sessions_same_tenant,
 (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('products','orders','customers')
  AND qual ILIKE '%store%') legacy_store_rls_policies;
ROLLBACK;