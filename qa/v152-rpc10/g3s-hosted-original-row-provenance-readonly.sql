-- RPC10-G3S / 2026-11-18 JST
-- Read-only aggregate, no actual merchant/product/order IDs, names, SKU,
-- phone, address, customer records, provider token or JWT returned.
-- This cannot itself prove the original Store owner for four legacy rows.
WITH tenant_slots AS (
 SELECT t.id,
   count(DISTINCT p.id) AS products,
   count(DISTINCT o.id) AS orders,
   count(DISTINCT o.id) FILTER(WHERE o.customer_id IS NOT NULL) AS customer_linked_orders,
   count(DISTINCT o.id) FILTER(WHERE length(trim(o.order_source))>0)
      AS orders_with_source_label,
   count(DISTINCT tm.user_id) FILTER(WHERE tm.role='owner' AND tm.active)
      AS current_tenant_owner_auth_ids
 FROM public.tenants t
 LEFT JOIN public.products p ON p.tenant_id=t.id
 LEFT JOIN public.orders o ON o.tenant_id=t.id
 LEFT JOIN public.tenant_memberships tm ON tm.tenant_id=t.id
 GROUP BY t.id
),
store_cols AS (
 SELECT count(*) AS n FROM information_schema.columns
 WHERE table_schema='public' AND column_name='store_id'
 AND table_name=ANY(ARRAY[
  'products','orders','order_items','customers','conversations','messages'])
),
rpcs AS (
 SELECT p.proname,p.prosecdef,
   (pg_get_functiondef(p.oid) ILIKE '%store_id%') AS mentions_store,
   (pg_get_functiondef(p.oid) ILIKE '%tenant_id%') AS mentions_tenant
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname=ANY(ARRAY[
  'save_merchant_product','qa_owner_pairing','qa_shop_b_zalo_claim'])
)
SELECT (SELECT count(*) FROM tenant_slots) AS tenant_count,
 (SELECT count(*) FROM tenant_slots WHERE products>=1 AND orders>=1)
    AS tenants_with_legacy_product_and_order,
 (SELECT coalesce(sum(products),0) FROM tenant_slots) AS legacy_products,
 (SELECT coalesce(sum(orders),0) FROM tenant_slots) AS legacy_orders,
 (SELECT coalesce(sum(customer_linked_orders),0) FROM tenant_slots)
    AS customer_linked_orders,
 (SELECT coalesce(sum(orders_with_source_label),0) FROM tenant_slots)
    AS orders_with_source_label,
 (SELECT count(*) FROM tenant_slots WHERE current_tenant_owner_auth_ids>=2)
    AS tenants_with_two_owner_auth_ids,
 (SELECT n FROM store_cols) AS canonical_store_column_count,
 to_regclass('public.stores') IS NOT NULL AS public_stores_present,
 to_regclass('public.store_memberships') IS NOT NULL AS store_memberships_present,
 (SELECT count(*) FROM rpcs WHERE prosecdef) AS definer_rpc_count,
 (SELECT count(*) FROM rpcs WHERE prosecdef AND NOT mentions_store)
    AS definer_rpcs_without_store_reference,
 (SELECT count(*) FROM rpcs
   WHERE proname='save_merchant_product' AND mentions_tenant AND NOT mentions_store)
    AS tenant_writer_lacks_store_reference;
