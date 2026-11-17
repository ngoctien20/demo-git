-- V17.1U private QA identity provisioning review: aggregate READ ONLY
BEGIN TRANSACTION READ ONLY;
SELECT
 (SELECT count(DISTINCT tenant_key)::int FROM tien404_r1_qa.tenant_identity_map) qa_tenants,
 (SELECT count(DISTINCT store_key)::int FROM tien404_r1_qa.tenant_identity_map) qa_stores,
 (SELECT count(*)::int FROM (SELECT tenant_key FROM tien404_r1_qa.owner_bindings
  GROUP BY tenant_key HAVING count(DISTINCT store_key)>=2
  AND count(DISTINCT owner_ref)>=2) t) same_tenant_distinct_store_owners,
 (SELECT count(*)::int FROM (SELECT m.tenant_id FROM auth.sessions s
  JOIN public.tenant_memberships m ON m.user_id=s.user_id AND m.active
  GROUP BY m.tenant_id HAVING count(DISTINCT s.user_id)>=2) t) same_tenant_session_members,
 (SELECT count(*)::int FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('products','orders','customers')
  AND qual ILIKE '%store%') legacy_store_policies,
 (SELECT count(*)::int FROM information_schema.columns
  WHERE table_schema='public' AND table_name IN ('products','orders','customers')
  AND column_name='store_id') store_columns;
ROLLBACK;