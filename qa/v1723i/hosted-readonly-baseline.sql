-- V17.23I HOSTED READ-ONLY AGGREGATE BASELINE. No row IDs, credentials, phone or customer data.
BEGIN TRANSACTION READ ONLY;
SELECT
 (SELECT count(*) FROM public.tenants) AS tenants,
 (SELECT count(*) FROM public.products) AS products,
 (SELECT count(*) FROM public.orders) AS orders,
 (SELECT count(*) FROM public.customers) AS customers,
 (SELECT count(*) FROM auth.users) AS auth_users,
 (SELECT count(*) FROM public.tenant_memberships WHERE active) AS active_tenant_memberships,
 (SELECT count(*) FROM tien404_r1_qa.tenant_identity_map) AS qa_store_identity_maps,
 (SELECT count(*) FROM tien404_r1_qa.owner_bindings) AS qa_owner_binding_rows,
 (SELECT count(*) FROM (SELECT tenant_key FROM tien404_r1_qa.tenant_identity_map GROUP BY tenant_key HAVING count(DISTINCT store_key)>=2) q) AS qa_same_tenant_store_groups,
 (SELECT count(*) FROM tien404_v175_qa.auth_customer_binding) AS verified_auth_customer_binding_rows,
 (SELECT count(*) FROM tien404_v175_qa.channel_identity) AS verified_channel_identity_rows,
 (SELECT count(*) FROM tien404_v175_qa.order_ownership) AS verified_order_ownership_rows,
 to_regclass('public.stores') IS NOT NULL AS canonical_stores_present,
 to_regclass('public.store_memberships') IS NOT NULL AS canonical_store_memberships_present,
 (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='store_id' AND table_name IN ('products','orders','customers','order_items','conversations','messages')) AS six_surface_store_id_count,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND cmd='SELECT' AND permissive='PERMISSIVE' AND coalesce(qual,'') NOT ILIKE '%store%') AS legacy_tenant_only_order_read_policies;
SELECT table_name, count(*) FILTER (WHERE column_name='store_id') AS store_id_count
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('products','orders','customers','order_items','conversations','messages')
GROUP BY table_name ORDER BY table_name;
SELECT tablename,policyname,permissive,cmd,
  (coalesce(qual,'') ILIKE '%store%') AS mentions_store,
  (coalesce(qual,'') ILIKE '%tenant%') AS mentions_tenant
FROM pg_policies WHERE schemaname='public'
AND tablename IN ('products','orders','customers','order_items','conversations','messages')
AND cmd='SELECT' ORDER BY tablename,policyname;
ROLLBACK;
