-- TIEN404 V17.2C.6 — read-only canonical store admission snapshot.
-- Purpose: detect current structural and owner-identity readiness without outputting IDs or personal data.
-- NEVER treat auth-backed owner counts as evidence of consent or Store authorization.
-- PostgreSQL 17; Supabase staging only. SELECT-only, no change, no RPC execution.
WITH live_owners AS (
  SELECT m.tenant_id,
         count(DISTINCT m.user_id) AS owners,
         count(DISTINCT u.id) AS linked_auth_users
  FROM public.tenant_memberships m
  LEFT JOIN auth.users u ON u.id = m.user_id
  WHERE m.active AND m.role = 'owner'
  GROUP BY m.tenant_id
), qa_mapping AS (
  SELECT i.auth_tenant_id,
         count(DISTINCT i.store_key) AS qa_store_keys
  FROM tien404_r1_qa.tenant_identity_map i
  GROUP BY i.auth_tenant_id
), metrics AS (
  SELECT
    (SELECT count(*) FROM auth.users)::int AS auth_user_count,
    (SELECT count(*) FROM live_owners WHERE owners >= 2 AND linked_auth_users >= 2)::int
      AS tenants_with_two_auth_backed_owners,
    (SELECT count(*) FROM qa_mapping WHERE qa_store_keys >= 2)::int
      AS tenants_with_two_qa_store_keys,
    (SELECT count(*) FROM live_owners l JOIN qa_mapping q
       ON q.auth_tenant_id = l.tenant_id
       WHERE l.owners >= 2 AND l.linked_auth_users >= 2 AND q.qa_store_keys >= 2)::int
      AS tenants_with_owner_and_qa_two_store_overlap,
    (SELECT count(*) FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('stores', 'store_memberships', 'channel_installations'))::int
      AS canonical_tables_existing,
    (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('products', 'orders', 'order_items', 'customers', 'conversations', 'messages')
         AND column_name = 'store_id')::int
      AS commerce_store_id_columns,
    (SELECT count(*) FROM public.products)::int AS existing_product_rows,
    (SELECT count(*) FROM public.orders)::int AS existing_order_rows,
    (SELECT count(*) FROM public.customers)::int AS existing_customer_rows
)
SELECT *,
 CASE WHEN tenants_with_two_qa_store_keys = 0
        OR tenants_with_owner_and_qa_two_store_overlap = 0
        OR canonical_tables_existing < 2
        OR commerce_store_id_columns = 0
      THEN 'NO_GO_STRUCTURAL'
      ELSE 'REVIEW_ONLY_NOT_APPROVED' END AS admission_result
FROM metrics;
