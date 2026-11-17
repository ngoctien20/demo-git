-- RPC10 G3T / 18 NOV 2026 JST — connected staging READ-ONLY aggregate.
-- Never select raw Auth IDs, session/JWT/token values, Row IDs, Order contents,
-- phone, email, customer payload, original Store source bytes, or Vault data.
-- A database session row is NOT proof of possession of a current JWT.
WITH cohort AS (
 SELECT m.tenant_id,m.user_id,m.role,
   (u.id IS NOT NULL AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)
    AND (u.banned_until IS NULL OR u.banned_until<now())
    AND u.confirmed_at IS NOT NULL) AS eligible,
   EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=m.user_id
    AND (s.not_after IS NULL OR s.not_after>now())) AS session_record
 FROM public.tenant_memberships m JOIN auth.users u ON u.id=m.user_id
 WHERE m.active
), t AS (
 SELECT tenant_id,
  count(DISTINCT user_id) FILTER(WHERE role='owner' AND eligible) AS eligible_owner_ids,
  count(DISTINCT user_id) FILTER(WHERE role='owner' AND eligible AND session_record)
    AS eligible_owner_session_rows
 FROM cohort GROUP BY tenant_id
)
SELECT
 (SELECT count(*) FROM cohort) AS active_tenant_memberships,
 (SELECT count(*) FROM cohort WHERE role='owner') AS active_tenant_owner_memberships,
 (SELECT count(*) FROM cohort WHERE eligible) AS eligible_confirmed_members,
 (SELECT count(*) FROM cohort WHERE eligible AND session_record) AS eligible_members_with_session_record,
 (SELECT count(*) FROM t WHERE eligible_owner_ids>=2) AS tenants_with_two_eligible_owner_ids,
 (SELECT count(*) FROM t WHERE eligible_owner_session_rows>=2)
   AS tenants_with_two_eligible_owner_session_rows,
 (SELECT count(*) FROM auth.users) AS auth_users_total,
 (SELECT count(*) FROM public.products) AS products_total,
 (SELECT count(*) FROM public.orders) AS orders_total,
 (SELECT count(*) FROM public.orders WHERE customer_id IS NOT NULL) AS customer_linked_orders_total,
 (SELECT count(*) FROM public.customers) AS customers_total,
 (SELECT count(*) FROM storage.buckets) AS storage_buckets_total,
 (SELECT count(*) FROM storage.objects) AS storage_objects_total,
 (SELECT count(*) FROM information_schema.columns
  WHERE table_schema='public' AND column_name='store_id'
   AND table_name=ANY(ARRAY[
    'products','orders','order_items','customers','conversations','messages']))
  AS six_store_columns,
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='save_merchant_product'
   AND pg_get_function_identity_arguments(p.oid) ILIKE '%p_store%')
  AS existing_product_writer_signatures_with_store_parameter;
