-- V17.1Y aggregate-only actual Supabase read; zero JWT, PII, or DDL.
BEGIN TRANSACTION READ ONLY;
SELECT (SELECT count(DISTINCT tenant_key)::int FROM tien404_r1_qa.tenant_identity_map) mapped_tenants,
 (SELECT count(DISTINCT store_key)::int FROM tien404_r1_qa.tenant_identity_map) mapped_stores,
 (SELECT count(*)::int FROM tien404_r1_qa.owner_bindings) owner_bindings,
 (SELECT count(*)::int FROM (
  SELECT tenant_key FROM tien404_r1_qa.owner_bindings
  GROUP BY tenant_key HAVING count(DISTINCT store_key)>=2
  AND count(DISTINCT owner_ref)>=2) x) qualifying_two_owner_store_same_tenant,
 (SELECT count(*)::int FROM (
  SELECT m.tenant_id FROM auth.sessions s JOIN public.tenant_memberships m
  ON m.user_id=s.user_id WHERE m.active GROUP BY m.tenant_id
  HAVING count(DISTINCT s.user_id)>=2) x) qualifying_two_auth_user_sessions_same_tenant,
 (SELECT count(*)::int FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('products','orders','customers')
  AND qual ILIKE '%store%') legacy_core_store_rls_policies;
ROLLBACK;
