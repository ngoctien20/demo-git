-- TIEN404 V17.7H.4S (18 Nov 2026 JST)
-- PostgreSQL staging metadata-only Store authority audit.
-- READ-ONLY. Returns NO personal identifiers, Bot Token, customer/order rows,
-- Store IDs, tenant UUIDs, or secret values. Run with pre-authorized read-only
-- Supabase connector. Never treat success as authorization to read an order.
--
-- Expected result at baseline 2026-11-18:
-- commerce_surfaces=6, force_rls_surfaces=6, tenant_id_surfaces=6,
-- store_id_surfaces=0, qa_same_tenant_ab=0,
-- shop_bot_dry_run=2, owner_binding_paired=2.
WITH surfaces AS (
  SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
    EXISTS(
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema='public' AND ic.table_name=c.relname
        AND ic.column_name='tenant_id'
    ) AS has_tenant,
    EXISTS(
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema='public' AND ic.table_name=c.relname
        AND ic.column_name='store_id'
    ) AS has_store
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
    AND c.relname = ANY(ARRAY[
      'products','orders','order_items','customers','conversations','messages'
    ])
), qa AS (
  SELECT tenant_key,count(DISTINCT store_key) AS shops
  FROM tien404_r1_qa.tenant_identity_map GROUP BY tenant_key
), bot AS (
  SELECT count(*) AS rows_n,
    count(*) FILTER (
      WHERE identity_status='synthetic_qa' AND enabled_mode='dry_run'
    ) AS dry_run_n
  FROM tien404_r1_qa.shop_bots
), owners AS (
  SELECT count(*) AS rows_n,
    count(*) FILTER(WHERE status='paired') AS paired_n
  FROM tien404_r1_qa.owner_bindings
)
SELECT
 (SELECT count(*) FROM surfaces) AS commerce_surfaces,
 (SELECT count(*) FROM surfaces WHERE rls AND force_rls) AS force_rls_surfaces,
 (SELECT count(*) FROM surfaces WHERE has_tenant) AS tenant_id_surfaces,
 (SELECT count(*) FROM surfaces WHERE has_store) AS store_id_surfaces,
 (SELECT count(*) FROM pg_policies
  WHERE schemaname='public'
    AND tablename = ANY(ARRAY[
      'products','orders','order_items','customers','conversations','messages'
    ]) AND cmd='SELECT') AS commerce_select_policies,
 (SELECT count(*) FROM qa) AS qa_tenants,
 (SELECT coalesce(max(shops),0) FROM qa) AS qa_max_stores_one_tenant,
 (SELECT count(*) FROM qa WHERE shops>=2) AS qa_same_tenant_ab,
 bot.rows_n AS shop_bot_rows,
 bot.dry_run_n AS shop_bot_dry_run,
 owners.rows_n AS owner_binding_rows,
 owners.paired_n AS owner_binding_paired
FROM bot CROSS JOIN owners;
