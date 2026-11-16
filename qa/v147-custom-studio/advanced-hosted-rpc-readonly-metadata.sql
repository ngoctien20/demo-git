-- TIEN404 AI V15.2 ADV.5D — READ-ONLY METADATA REPORT ONLY.
-- Run by an authorized security auditor, NEVER a customer-facing chatbot.
-- This script neither runs qa_shop_b_zalo_claim nor exposes Vault, JWT, OTP,
-- function source, customer identities, phone numbers, order values or logs.
-- Never pass real user session/JWT, private evidence or service_role to this file.
BEGIN TRANSACTION READ ONLY;

-- A. Named privileged RPC: owner, flags, fingerprint and grants (not values).
SELECT p.oid::regprocedure::text AS rpc_signature,
       pg_get_userbyid(p.proowner) AS owner_role,
       p.prosecdef AS security_definer,
       p.proconfig AS routine_settings,
       md5(pg_get_functiondef(p.oid)) AS implementation_md5,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_schema_privilege('anon', n.oid,'USAGE') AS anon_schema_usage
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname='qa_shop_b_zalo_claim';

-- B. Direct ACL (PUBLIC=OID 0), WITHOUT invoking the function.
SELECT p.oid::regprocedure::text AS rpc_signature,
       CASE WHEN acl.grantee=0 THEN 'PUBLIC'
            ELSE pg_get_userbyid(acl.grantee) END AS grantee_role,
       acl.privilege_type,acl.is_grantable
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid=p.pronamespace
CROSS JOIN LATERAL aclexplode(
  coalesce(p.proacl,acldefault('f',p.proowner))) AS acl
WHERE n.nspname='public'
  AND p.proname='qa_shop_b_zalo_claim'
ORDER BY grantee_role,privilege_type;

-- C. Delegated private function: presence and inaccessible private schema.
SELECT p.oid::regprocedure::text AS delegated_signature,
       n.nspname AS schema_name,
       p.prosecdef AS security_definer,
       p.proconfig AS routine_settings,
       md5(pg_get_functiondef(p.oid)) AS implementation_md5,
       has_schema_privilege('anon',n.oid,'USAGE') AS anon_schema_usage,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='tien404_r1_qa'
  AND p.proname='claim_owner_pairing_v3_synthetic';

-- D. Structural store readiness: no sample business/customer records.
SELECT t.table_name,
  count(*) FILTER(WHERE t.column_name='tenant_id')::int AS has_tenant_key,
  count(*) FILTER(WHERE t.column_name='store_id')::int AS has_store_key
FROM information_schema.columns AS t
WHERE t.table_schema='public'
  AND t.table_name IN ('orders','order_items','products','stores',
                       'store_memberships','tenant_memberships')
GROUP BY t.table_name
ORDER BY t.table_name;

-- E. RLS state only, not user data or row counts.
SELECT c.relname AS relation_name,c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relkind='r'
  AND c.relname IN ('orders','order_items','products','stores',
                     'store_memberships','tenant_memberships')
ORDER BY c.relname;

-- F. Policy scope; only simple name/role/verb metadata, no policy source.
SELECT tablename,policyname,roles,cmd
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('orders','order_items','products','stores',
                     'store_memberships','tenant_memberships')
ORDER BY tablename,policyname;

COMMIT;
