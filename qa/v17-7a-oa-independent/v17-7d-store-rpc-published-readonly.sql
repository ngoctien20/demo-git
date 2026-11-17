-- TIEN404 V17.7D — cross-team STORE/RPC host baseline, SELECT ONLY, zero PII.
-- Executes only on the user-owned Supabase STAGING project after operator verifies
-- project_id=ifxlvrhyjhbzbrkdsida. It is NOT a migration or RLS acceptance.
-- The result is an aggregated diagnostic, NOT a password, owner proof, JWT
-- or a sufficient criterion to allow hosted business reads/writes.
WITH core AS (
  SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,
    EXISTS (SELECT 1 FROM pg_attribute a
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
        AND a.attname='tenant_id') AS has_tenant_id,
    EXISTS (SELECT 1 FROM pg_attribute a
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
        AND a.attname='store_id') AS has_store_id
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND c.relname IN (
      'products','orders','order_items','customers','conversations','messages'
    )
),
policies AS (
  SELECT p.tablename,COUNT(*) AS total_select,
    COUNT(*) FILTER (WHERE p.permissive='PERMISSIVE')
      AS permissive_select,
    COUNT(*) FILTER (WHERE p.qual ILIKE '%store_id%'
      OR p.qual ILIKE '%store_key%'
      OR p.qual ILIKE '%store_membership%') AS explicit_store_text
  FROM pg_policies p
  WHERE p.schemaname='public'
    AND p.cmd='SELECT'
    AND p.tablename IN (
      'products','orders','order_items','customers','conversations','messages'
    )
  GROUP BY p.tablename
),
privileged AS (
  SELECT p.proname,p.prosecdef,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'qa_owner_pairing','qa_shop_b_zalo_claim','save_merchant_product'
  )
),
qa_stores AS (
  SELECT tenant_key,COUNT(DISTINCT store_key) AS store_count
  FROM tien404_r1_qa.tenant_identity_map
  GROUP BY tenant_key
)
SELECT
  (SELECT COUNT(*) FROM core) AS core_table_count,
  (SELECT COUNT(*) FROM core WHERE relrowsecurity AND relforcerowsecurity)
    AS core_rls_force_count,
  (SELECT COUNT(*) FROM core WHERE has_tenant_id) AS core_tenant_column_count,
  (SELECT COUNT(*) FROM core WHERE has_store_id) AS core_store_column_count,
  (SELECT COALESCE(SUM(total_select),0) FROM policies) AS select_policy_count,
  (SELECT COALESCE(SUM(permissive_select),0) FROM policies)
    AS permissive_select_policy_count,
  (SELECT COALESCE(SUM(explicit_store_text),0) FROM policies)
    AS explicit_store_predicate_count,
  (SELECT COUNT(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('stores','store_memberships')
  ) AS canonical_store_table_count,
  (SELECT COUNT(*) FROM privileged WHERE prosecdef) AS privileged_definer_count,
  (SELECT COUNT(*) FROM privileged WHERE anon_execute) AS anon_executable_definer_count,
  (SELECT COUNT(*) FROM qa_stores) AS qa_tenant_count,
  (SELECT COALESCE(MAX(store_count),0) FROM qa_stores) AS qa_max_stores_in_tenant,
  (SELECT COUNT(*) FROM qa_stores WHERE store_count>=2)
    AS qa_same_tenant_two_store_count,
  'HOSTED_STORE_NO_GO' AS release_status,
  'READ_ONLY_AGGREGATE_NO_CUSTOMER_ROWS' AS query_scope;
