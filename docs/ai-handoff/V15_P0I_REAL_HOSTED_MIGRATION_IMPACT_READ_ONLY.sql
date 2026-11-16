-- TIEN404 V15 P0-I REAL STAGING SCHEMA MIGRATION IMPACT (READ ONLY)
-- Aggregate only; no Store/Owner/Provider identifiers or customer content.
-- Never run this query as a migration or export operation.
BEGIN TRANSACTION READ ONLY;

SELECT
 'V15_P0I_HOSTED_DECISION_PREFLIGHT_V1' AS contract,
 (SELECT count(*) FROM public.tenants)::int AS tenants,
 (SELECT count(*) FROM public.tenant_memberships WHERE active)::int AS active_tenant_memberships,
 (SELECT count(*) FROM public.products)::int AS legacy_products,
 (SELECT count(*) FROM public.orders)::int AS legacy_orders,
 (SELECT count(*) FROM public.customers)::int AS legacy_customers,
 (SELECT count(*) FROM app_private.channel_secrets)::int AS private_channel_bindings,
 (SELECT count(*) FROM tien404_r1_qa.owner_bindings WHERE status='paired')::int AS qa_paired,
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_claims_v3 WHERE status='CONFIRMED')::int AS qa_confirmed_claims,
 (SELECT count(*) FROM tien404_r1_qa.shop_bots WHERE identity_status='synthetic_qa')::int AS qa_synthetic_bots,
 (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='stores')::int AS store_tables,
 (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='store_memberships')::int AS store_member_tables,
 (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='store_id')::int AS product_store_columns,
 (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='store_id')::int AS order_store_columns,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('products','orders','customers','order_items','conversations','messages','tenant_agent_configs')
    AND cmd='SELECT' AND permissive='PERMISSIVE'
    AND coalesce(qual,'') ILIKE '%tenant_memberships%')::int AS legacy_tenant_permissive_policies,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('products','orders','customers','order_items','conversations','messages','tenant_agent_configs')
    AND cmd='SELECT' AND coalesce(qual,'') ILIKE '%store_memberships%')::int AS store_scoped_policies,
 (SELECT count(*) FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='products'
      AND c.contype='u' AND pg_get_constraintdef(c.oid)='UNIQUE (tenant_id, sku)')::int AS product_tenant_sku_unique,
 (SELECT count(*) FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='app_private' AND t.relname='channel_secrets'
      AND c.contype='p' AND pg_get_constraintdef(c.oid)='PRIMARY KEY (tenant_id, platform)')::int AS channel_tenant_platform_pk,
 (SELECT count(*) FROM public.tenant_agent_configs WHERE channel='pilot_lab')::int AS preview_lab_agent_configs,
 (SELECT count(*) FROM (SELECT platform,external_account_ref
    FROM app_private.channel_secrets GROUP BY platform,external_account_ref HAVING count(*)>1) d)::int AS duplicate_provider_bindings;

COMMIT;
