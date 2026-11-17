-- TIEN404 V18.0-P0D READ-ONLY aggregate — SUPABASE STAGING ONLY.
-- Scope: ORIGINAL STORE ORIGIN × M0 RECOVERY × AUTH SESSION PRE-ADMISSION.
-- Never return UUIDs, phone, email, JWT, row contents, passwords or private proofs.
-- NO raw owner evidence, no M0 backup/export, no signed-JWT verification.
-- AUTHORIZE NO WRITES. DO NOT RUN IN A MIGRATION / PRIVILEGED RPC.
BEGIN TRANSACTION READ ONLY;

-- Four legacy row *slots*, not merchant ownership certification.
WITH tenant_slots AS (
  SELECT id, row_number() OVER (ORDER BY id) AS slot
  FROM public.tenants
)
SELECT slot,
  (SELECT count(*) FROM public.products p WHERE p.tenant_id=t.id) AS products,
  (SELECT count(*) FROM public.orders o WHERE o.tenant_id=t.id) AS orders,
  (SELECT count(*) FROM public.tenant_memberships m WHERE m.tenant_id=t.id
     AND m.active AND m.role='owner') AS active_tenant_owner_memberships,
  (SELECT count(*) FROM tien404_r1_qa.tenant_identity_map im
     WHERE im.auth_tenant_id=t.id) AS qa_identity_maps,
  (SELECT count(DISTINCT im.store_key) FROM tien404_r1_qa.tenant_identity_map im
     WHERE im.auth_tenant_id=t.id) AS distinct_qa_store_keys
FROM tenant_slots t ORDER BY slot;

-- Source/origin evidence availability, never actual customer/merchant row fields.
SELECT
 (SELECT count(*) FROM public.tenants) AS tenant_count,
 (SELECT count(*) FROM public.products) AS products,
 (SELECT count(*) FROM public.orders) AS orders,
 (SELECT count(*) FROM public.customers) AS customers,
 (SELECT count(*) FROM public.orders WHERE order_source IS NOT NULL
      AND btrim(order_source) <> '') AS orders_with_source_label,
 (SELECT count(*) FROM public.orders WHERE customer_id IS NOT NULL) AS linked_order_customers,
 (SELECT count(*) FROM tien404_r1_qa.tenant_identity_map) AS qa_map_rows,
 (SELECT count(*) FROM tien404_r1_qa.owner_bindings) AS qa_owner_binding_rows,
 (SELECT count(*) FROM tien404_r1_qa.tenant_identity_map m
      JOIN tien404_r1_qa.owner_bindings b
       ON b.tenant_key=m.tenant_key
       AND b.store_key=m.store_key
       AND b.bot_key=m.bot_key) AS qa_pairing_matching_keys,
 (SELECT count(*) FROM (
    SELECT tenant_key FROM tien404_r1_qa.tenant_identity_map
    GROUP BY tenant_key HAVING count(DISTINCT store_key)>=2
  ) x) AS qa_same_tenant_two_store_groups,
 (to_regclass('public.stores') IS NOT NULL) AS public_stores_present,
 (to_regclass('public.store_memberships') IS NOT NULL) AS public_store_memberships_present,
 (to_regnamespace('rpc178_qa') IS NOT NULL) AS private_candidate_schema_present,
 (SELECT count(*) FROM information_schema.columns
  WHERE table_schema='public' AND column_name='store_id'
    AND table_name IN ('products','orders','customers','order_items','conversations','messages'))
   AS commerce_store_id_columns;

-- Auth rows and session metadata *cannot* prove signed JWT ownership, validity
-- or permission for a Store. Do not query session IDs / tokens / IPs.
SELECT
 (SELECT count(*) FROM auth.users WHERE deleted_at IS NULL) AS auth_users,
 (SELECT count(*) FROM auth.users WHERE deleted_at IS NULL
  AND email_confirmed_at IS NOT NULL) AS confirmed_auth_users,
 (SELECT count(*) FROM auth.sessions) AS session_rows,
 (SELECT count(DISTINCT user_id) FROM auth.sessions) AS session_history_users,
 (SELECT count(DISTINCT s.user_id) FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
   WHERE u.deleted_at IS NULL AND (s.not_after IS NULL OR s.not_after>now()))
   AS users_with_nonexpired_session_records,
 (SELECT count(DISTINCT m.user_id) FROM public.tenant_memberships m
   JOIN auth.users u ON u.id=m.user_id
   WHERE m.active AND m.role='owner' AND u.deleted_at IS NULL)
   AS active_tenant_owner_users,
 (SELECT count(DISTINCT m.user_id) FROM public.tenant_memberships m
   JOIN auth.sessions s ON s.user_id=m.user_id
   WHERE m.active AND m.role='owner')
   AS owner_users_with_session_history,
 (SELECT count(*) FROM storage.buckets) AS storage_buckets,
 (SELECT count(*) FROM storage.objects) AS storage_objects;

-- RLS shape; tenant-only SELECT policies are NOT Store A/B admission.
SELECT tablename, count(*) AS select_policies,
  count(*) FILTER (WHERE permissive='PERMISSIVE'
       AND coalesce(qual,'') NOT ILIKE '%store%') AS tenant_or_other_storeless_permissive_select_policies
FROM pg_policies
WHERE schemaname='public'
 AND tablename IN ('products','orders','customers','order_items')
 AND cmd='SELECT'
GROUP BY tablename
ORDER BY tablename;

ROLLBACK;
