-- V17.1Q READ ONLY / PII-FREE AUTH STORE OWNER UAT PREFLIGHT
-- No user IDs, JWTs, emails or business rows returned. NO DDL/DML.
BEGIN TRANSACTION READ ONLY;
SELECT
 (SELECT count(DISTINCT tenant_key)::int FROM tien404_r1_qa.tenant_identity_map) AS mapped_tenants,
 (SELECT count(DISTINCT store_key)::int FROM tien404_r1_qa.tenant_identity_map) AS mapped_stores,
 (SELECT count(*)::int FROM tien404_r1_qa.owner_bindings b
    JOIN tien404_r1_qa.tenant_identity_map t USING (tenant_key,store_key)) AS matched_owner_installation_links,
 (SELECT count(*)::int FROM (
    SELECT tenant_key FROM tien404_r1_qa.owner_bindings
    GROUP BY tenant_key HAVING count(DISTINCT store_key)>=2 AND count(DISTINCT owner_ref)>=2
  ) x) AS same_tenant_two_store_owners,
 (SELECT count(*)::int FROM (
    SELECT m.tenant_id FROM auth.sessions s
    JOIN public.tenant_memberships m ON m.user_id=s.user_id AND m.active
    GROUP BY m.tenant_id HAVING count(DISTINCT s.user_id)>=2
  ) x) AS tenants_with_two_active_session_members,
 (SELECT count(*)::int FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('orders','products','customers')
    AND qual ILIKE '%store%') AS legacy_store_rls_predicates;
ROLLBACK;
