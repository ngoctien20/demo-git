-- V17.1Z READ-ONLY OPERATOR PREFLIGHT, NO AUTH JWT/PII
-- This query audits existing constraints, never changes permissions or data.
BEGIN TRANSACTION READ ONLY;
SELECT
 (SELECT count(DISTINCT tenant_key)::int FROM tien404_r1_qa.tenant_identity_map) qa_mapped_tenants,
 (SELECT count(DISTINCT store_key)::int FROM tien404_r1_qa.tenant_identity_map) qa_mapped_stores,
 (SELECT count(*)::int FROM tien404_r1_qa.owner_bindings) qa_owner_links,
 (SELECT count(*)::int FROM (SELECT tenant_key FROM tien404_r1_qa.owner_bindings GROUP BY tenant_key
  HAVING count(DISTINCT store_key)>=2 AND count(DISTINCT owner_ref)>=2) x) eligible_same_tenant_distinct_owners,
 (SELECT count(*)::int FROM (SELECT m.tenant_id FROM auth.sessions s
  JOIN public.tenant_memberships m ON m.user_id=s.user_id AND m.active
  GROUP BY m.tenant_id HAVING count(DISTINCT s.user_id)>=2) x) tenant_pairs_with_two_active_auth_users,
 (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename IN
  ('products','orders','customers') AND
  (COALESCE(qual,'') ILIKE '%store%' OR COALESCE(with_check,'') ILIKE '%store%')) store_scoped_legacy_policies;
SELECT n.nspname AS schema_name,c.relname AS table_name,
 con.conname AS constraint_name,con.contype,pg_get_constraintdef(con.oid) definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='tien404_r1_qa' AND c.relname='tenant_identity_map')
  OR (n.nspname='public' AND c.relname='tenant_memberships')
ORDER BY 1,2,3;
ROLLBACK;
