-- TIEN404 RPC10-G3R / V18-20261118
-- REAL SUPABASE HOSTED AGGREGATE ONLY: ABSOLUTELY NO DDL, DML, RPC,
-- Customer/Order rows, Bot Token, UUID, user identity, JWT, secret, URL.
-- This inventory is NOT permission to run M1/M2/M4 or read real Orders.
WITH six AS (
 SELECT c.relname, c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS force_rls,
   EXISTS(SELECT 1 FROM information_schema.columns ic
          WHERE ic.table_schema='public'
            AND ic.table_name=c.relname AND ic.column_name='tenant_id')
       AS tenant_scoped_column,
   EXISTS(SELECT 1 FROM information_schema.columns ic
          WHERE ic.table_schema='public'
            AND ic.table_name=c.relname AND ic.column_name='store_id')
       AS store_scoped_column
 FROM pg_class c
 JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r'
 AND c.relname=ANY(ARRAY[
  'products','orders','customers','order_items','conversations','messages'])
),
read_policy AS (
 SELECT tablename,
   count(*) FILTER(WHERE permissive='PERMISSIVE' AND cmd='SELECT')
     AS legacy_permissive_selects,
   count(*) FILTER(WHERE cmd='SELECT' AND qual ~* 'store_id')
     AS store_predicate_selects,
   count(*) FILTER(WHERE cmd='SELECT' AND qual ~* 'tenant_id')
     AS tenant_predicate_selects
 FROM pg_policies WHERE schemaname='public'
  AND tablename=ANY(ARRAY[
   'products','orders','customers','order_items','conversations','messages'])
 GROUP BY tablename
),
owner_per_tenant AS (
 SELECT tenant_id,
    count(DISTINCT user_id) FILTER
       (WHERE active AND role='owner') AS distinct_owner_ids,
    count(DISTINCT user_id) FILTER
       (WHERE active AND role IN ('owner','manager')) AS eligible_ids
 FROM public.tenant_memberships GROUP BY tenant_id
),
qa_map AS (
 SELECT tenant_key,count(DISTINCT store_key) AS stores
 FROM tien404_r1_qa.tenant_identity_map GROUP BY tenant_key
),
routine_grants AS (
 SELECT p.proname, p.prosecdef,
   has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
   has_function_privilege('authenticated',p.oid,'EXECUTE')
      AS authenticated_execute
 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
 AND p.proname=ANY(ARRAY[
  'qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product'])
)
SELECT
  (SELECT count(*) FROM six) AS six_commerce_tables,
  (SELECT count(*) FROM six WHERE rls_enabled AND force_rls)
     AS six_force_rls_count,
  (SELECT count(*) FROM six WHERE tenant_scoped_column)
     AS six_tenant_id_count,
  (SELECT count(*) FROM six WHERE store_scoped_column)
     AS six_store_id_count,
  (SELECT count(*) FROM read_policy) AS read_policy_table_count,
  (SELECT coalesce(sum(legacy_permissive_selects),0)
     FROM read_policy) AS permissive_read_policy_count,
  (SELECT coalesce(sum(store_predicate_selects),0)
     FROM read_policy) AS store_predicate_policy_count,
  (SELECT count(*) FROM owner_per_tenant)
     AS tenant_with_membership_count,
  (SELECT coalesce(max(distinct_owner_ids),0)
     FROM owner_per_tenant) AS max_distinct_owner_auth_ids_one_tenant,
  (SELECT count(*) FROM owner_per_tenant WHERE distinct_owner_ids>=2)
     AS tenants_with_two_distinct_owner_auth_ids,
  (SELECT count(*) FROM qa_map WHERE stores>=2)
     AS same_tenant_two_store_qa_count,
  (SELECT count(*) FROM routine_grants WHERE prosecdef)
     AS public_privileged_rpc_count,
  (SELECT count(*) FROM routine_grants WHERE prosecdef AND anon_execute)
     AS anon_executable_privileged_rpc_count,
  (SELECT count(*) FROM routine_grants WHERE prosecdef AND authenticated_execute)
     AS authenticated_privileged_rpc_count,
  (SELECT count(*) FROM tien404_r1_qa.shop_bots
   WHERE identity_status='synthetic_qa' AND enabled_mode='dry_run')
     AS synthetic_bot_dry_run_count,
  (SELECT count(*) FROM tien404_r1_qa.owner_bindings
   WHERE status='paired') AS synthetic_owner_paired_rows,
  to_regclass('public.stores') IS NOT NULL AS canonical_stores_exist,
  to_regclass('public.store_memberships') IS NOT NULL
     AS canonical_store_memberships_exist;
