-- TIEN404 V17.5 — HOSTED READ-ONLY Store/RLS preflight
-- Scope: Supabase project ifxlvrhyjhbzbrkdsida (staging) ONLY
-- Executed with Supabase read-only SQL connector on 2026-11-17 JST.
-- No customer or credential row selection; no mutation, session impersonation or RPC invocation.
-- A passing query is NOT proof of live JWT-based Store isolation.
WITH core(table_name) AS (
  VALUES ('products'), ('orders'), ('customers'),
         ('order_items'), ('conversations'), ('messages')
),
schema_counts AS (
  SELECT
    count(*) FILTER (WHERE c.column_name = 'store_id') AS store_id_columns,
    count(DISTINCT core.table_name) FILTER (WHERE cls.relrowsecurity) AS rls_on,
    count(DISTINCT core.table_name) FILTER (WHERE cls.relforcerowsecurity) AS force_rls,
    count(DISTINCT core.table_name) AS core_tables
  FROM core
  LEFT JOIN pg_class cls
    ON cls.relname = core.table_name AND cls.relnamespace = 'public'::regnamespace
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = core.table_name AND c.column_name = 'store_id'
),
qa_constraints AS (
  SELECT
    count(*) FILTER (
      WHERE contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%(tenant_key, store_key, bot_key%'
    ) AS scoped_fks,
    count(*) FILTER (
      WHERE contype = 'u'
        AND pg_get_constraintdef(oid) LIKE '%tenant_key, store_key, bot_key%'
    ) AS scoped_uniques
  FROM pg_constraint
  WHERE connamespace = 'tien404_r1_qa'::regnamespace
)
SELECT
  s.core_tables, s.store_id_columns, s.rls_on, s.force_rls,
  (to_regclass('public.stores') IS NOT NULL) AS canonical_stores_present,
  (to_regclass('public.store_memberships') IS NOT NULL) AS store_memberships_present,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename IN
        ('products','orders','customers','order_items','conversations','messages')
      AND (coalesce(p.qual, '') LIKE '%store_id%'
        OR coalesce(p.with_check, '') LIKE '%store_id%')
  ) AS store_qualified_policy_count,
  (SELECT count(*) FROM tien404_r1_qa.shop_bots) AS qa_shop_bots,
  (SELECT count(*) FROM tien404_r1_qa.owner_bindings) AS qa_owner_bindings,
  (SELECT count(*) FROM tien404_r1_qa.catalog) AS qa_catalog,
  (SELECT count(*) FROM tien404_r1_qa.sandbox_orders) AS qa_orders,
  (SELECT count(*) FROM tien404_r1_qa.shop_bots b
    LEFT JOIN tien404_r1_qa.tenant_identity_map i
      USING (tenant_key,store_key,bot_key)
    WHERE i.bot_key IS NULL
  ) AS qa_unmapped_bots,
  (SELECT count(*) FROM tien404_r1_qa.owner_bindings b
    LEFT JOIN tien404_r1_qa.shop_bots s
      USING (tenant_key,store_key,bot_key)
    WHERE s.bot_key IS NULL
  ) AS qa_orphan_bindings,
  (SELECT count(*) FROM tien404_r1_qa.catalog c
    LEFT JOIN tien404_r1_qa.shop_bots s
      USING (tenant_key,store_key,bot_key)
    WHERE s.bot_key IS NULL
  ) AS qa_orphan_catalog,
  (SELECT count(*) FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) AS anon_callable_public_definer_count,
  q.scoped_fks, q.scoped_uniques
FROM schema_counts s CROSS JOIN qa_constraints q;

-- Expected read-only OBSERVATION on 2026-11-17:
-- core_tables=6; rls_on=6; force_rls=6
-- store_id_columns=0; canonical_stores_present=false; store_memberships_present=false
-- store_qualified_policy_count=0
-- qa_shop_bots=2; qa_owner_bindings=2; qa_catalog=2; qa_orders=4
-- qa_unmapped_bots=0; qa_orphan_bindings=0; qa_orphan_catalog=0
-- anon_callable_public_definer_count=1; scoped_fks=9; scoped_uniques=4
-- Conclusion: private synthetic Store schema has integrity references, but public Commerce
-- has not passed same-Tenant cross-Store RLS. RELEASE=NO_GO.
