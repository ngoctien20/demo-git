\set ON_ERROR_STOP on
-- V17.25N: execute ONLY after P0D on disposable PostgreSQL 17 with fake records.
-- NEVER use in Supabase staging/production or with any real customer row.
DO $guard$
DECLARE found_policies integer;
BEGIN
 IF current_database()<>'t404_v180_p0d_ci'
    OR current_user<>'postgres'
    OR current_setting('server_version_num')::integer<170000
    OR to_regclass('shop_qa.orders') IS NULL
    OR to_regclass('shop_qa.store_memberships') IS NULL
    OR to_regclass('shop_qa.stores') IS NULL
 THEN RAISE EXCEPTION 'V1725N_DISPOSABLE_PG17_ONLY' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO found_policies FROM pg_policies
 WHERE schemaname='shop_qa' AND tablename='orders' AND policyname='orders_read';
 IF found_policies<>1 THEN
  RAISE EXCEPTION 'V1725N_REQUIRES_PINNED_P0D_FIXTURE' USING ERRCODE='42501';
 END IF;
 SELECT count(*) INTO found_policies FROM pg_policies
 WHERE schemaname='shop_qa' AND tablename='orders'
 AND policyname IN ('qa_legacy_tenant_allow','qa_restrict_store_membership');
 IF found_policies<>0 THEN
  RAISE EXCEPTION 'V1725N_PREEXISTING_QA_POLICY' USING ERRCODE='42501';
 END IF;
 RAISE NOTICE 'PASS_V1725N_DISPOSABLE_GUARD';
END $guard$;

-- P0D ends by revoking B member and suspending A. Restore FAKE rows only.
UPDATE shop_qa.store_memberships SET active=true
WHERE user_id='10000000-0000-4000-8000-000000000002';
UPDATE shop_qa.stores SET is_active=true
WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'N_BASELINE_OWNER_A_ONE');
RESET ROLE;

-- Deliberately insecure PERMISSIVE intermediate state for QA only.
CREATE POLICY qa_legacy_tenant_allow ON shop_qa.orders
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM shop_qa.store_memberships m
 WHERE m.tenant_id=orders.tenant_id
 AND m.user_id=(SELECT auth.uid()) AND m.active
 AND m.role IN ('owner','manager')
));
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE tenant_id=''11111111-1111-4111-8111-111111111111''',
 2,'N_INSECURE_OR_LEAKS_B_TO_OWNER_A');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE tenant_id=''11111111-1111-4111-8111-111111111111''',
 2,'N_INSECURE_OR_LEAKS_A_TO_OWNER_B');
RESET ROLE;

CREATE POLICY qa_restrict_store_membership ON shop_qa.orders
AS RESTRICTIVE FOR SELECT TO authenticated
USING (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager']));
DO $policy$
DECLARE p integer; q integer; forced boolean;
BEGIN
 SELECT count(*) FILTER (WHERE permissive='PERMISSIVE'),
        count(*) FILTER (WHERE permissive='RESTRICTIVE')
 INTO p,q FROM pg_policies
 WHERE schemaname='shop_qa' AND tablename='orders' AND cmd='SELECT';
 SELECT c.relrowsecurity AND c.relforcerowsecurity INTO forced
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='shop_qa' AND c.relname='orders';
 IF p<>2 OR q<>1 OR NOT COALESCE(forced,false) THEN
  RAISE EXCEPTION 'V1725N_POLICY_COMPOSITION_DRIFT';
 END IF;
 RAISE NOTICE 'PASS_V1725N_TWO_PERMISSIVE_ONE_RESTRICTIVE_FORCE_RLS';
END $policy$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'N_RESTRICT_A_SEES_ONLY_A');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',
 0,'N_RESTRICT_A_DENY_B');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'N_RESTRICT_B_SEES_ONLY_B');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE store_id=''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''',
 0,'N_RESTRICT_B_DENY_A');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',0,'N_RESTRICT_STAFF_DENIED');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',0,'N_RESTRICT_OUTSIDER_DENIED');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'N_RESTRICT_OTHER_TENANT_ONLY_C');
RESET ROLE;

-- Dual owner is legitimately allowed both stores. Tenant-only HTTP is ambiguous.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE tenant_id=''11111111-1111-4111-8111-111111111111''',
 2,'N_DUAL_OWNER_LEGACY_TENANT_IS_AMBIGUOUS');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE tenant_id=''11111111-1111-4111-8111-111111111111'' AND store_id=''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''',
 1,'N_DUAL_OWNER_SERVER_SCOPED_A_ONE');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE tenant_id=''11111111-1111-4111-8111-111111111111'' AND store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',
 1,'N_DUAL_OWNER_SERVER_SCOPED_B_ONE');
-- A custom request GUC can be set by the caller: never treat it as a signed scope.
SELECT set_config('request.jwt.claim.selected_store','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE tenant_id=''11111111-1111-4111-8111-111111111111''',
 2,'N_SPOOFED_REQUEST_GUC_DOES_NOT_BIND_SELECTED_STORE');
RESET ROLE;

-- Remove deliberately insecure policy before this disposable job ends.
DROP POLICY qa_legacy_tenant_allow ON shop_qa.orders;
DO $cleanup$
DECLARE p integer; q integer;
BEGIN
 SELECT count(*) FILTER (WHERE permissive='PERMISSIVE'),
        count(*) FILTER (WHERE permissive='RESTRICTIVE')
 INTO p,q FROM pg_policies WHERE schemaname='shop_qa' AND tablename='orders' AND cmd='SELECT';
 IF p<>1 OR q<>1 THEN RAISE EXCEPTION 'V1725N_CLEANUP_POLICY_DRIFT'; END IF;
 RAISE NOTICE 'PASS_V1725N_UNSAFE_POLICY_REMOVED_IN_DISPOSABLE_DB';
 RAISE NOTICE 'V1725N_NO_HOSTED_MIGRATION_NO_REAL_JWT_NO_CUSTOMER_ROWS';
END $cleanup$;
