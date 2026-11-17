-- V17.2B LIVE READ-ONLY ADMISSION PREFLIGHT
-- Never creates Auth users, modifies store memberships, RLS, views, or secrets.
BEGIN TRANSACTION READ ONLY;
SELECT
 to_regclass('tien404_v172a_qa.qa_catalog') IS NOT NULL AS qa_catalog_deployed,
 to_regclass('public.tien404_v172a_qa_catalog') IS NOT NULL AS qa_security_invoker_view_deployed,
 (SELECT count(*)::int FROM auth.users) auth_user_total,
 (SELECT count(*)::int FROM (
   SELECT m.tenant_id FROM auth.sessions s
   JOIN public.tenant_memberships m ON m.user_id=s.user_id AND m.active
   GROUP BY m.tenant_id HAVING COUNT(DISTINCT s.user_id)>=2
 ) g) possible_two_distinct_auth_sessions_same_tenant,
 (SELECT count(*)::int FROM (
   SELECT tenant_key FROM tien404_r1_qa.owner_bindings
   GROUP BY tenant_key
   HAVING count(DISTINCT store_key)>=2 AND count(DISTINCT owner_ref)>=2
 ) g) eligible_legacy_distinct_store_owner_pairs,
 (SELECT count(*)::int FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('orders','products','customers')
  AND (COALESCE(qual,'') ILIKE '%store%' OR COALESCE(with_check,'') ILIKE '%store%')) commerce_store_scope_rls_policies;
SELECT schemaname,tablename,policyname,cmd,roles,qual
 FROM pg_policies
 WHERE schemaname='public' AND tablename='tenant_memberships';
ROLLBACK;
