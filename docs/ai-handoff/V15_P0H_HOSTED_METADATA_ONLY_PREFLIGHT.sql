-- TIEN404 V15 Sales Lite P0-H — REAL HOSTED METADATA PREFLIGHT
-- STAGING ONLY, aggregate metadata only. Never SELECT sensitive row values.
-- Does NOT verify actual provider signatures, merchant consent or backed-up RLS.
-- Must not be used as an executable approval for live Commerce reads/sends.
BEGIN TRANSACTION READ ONLY;

SELECT
 'V15_P0H_HOSTED_METADATA_V1'::text AS preflight_contract,
 (SELECT count(*) FROM public.tenants)::int AS tenant_rows,
 (SELECT count(*) FROM public.tenant_memberships WHERE active)::int AS active_membership_rows,
 (SELECT count(*) FROM public.products)::int AS product_rows,
 (SELECT count(*) FROM public.orders)::int AS order_rows,
 (SELECT count(*) FROM app_private.channel_secrets)::int AS private_channel_binding_rows,
 (SELECT count(*) FROM public.tenant_agent_configs)::int AS tenant_agent_config_rows,
 (SELECT count(*) FROM public.tenant_agent_configs WHERE channel='pilot_lab')::int AS preview_lab_config_rows,
 (SELECT count(*) FROM tien404_r1_qa.shop_bots)::int AS qa_bot_rows,
 (SELECT count(*) FROM tien404_r1_qa.shop_bots WHERE identity_status='synthetic_qa')::int AS qa_synthetic_bot_rows,
 (SELECT count(*) FROM tien404_r1_qa.tenant_identity_map)::int AS qa_identity_map_rows,
 (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='stores')::int AS canonical_store_tables,
 (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name='store_memberships')::int AS store_membership_tables,
 (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='store_id')::int AS products_store_id_columns,
 (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='store_id')::int AS orders_store_id_columns,
 (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND cmd='SELECT'
      AND coalesce(qual,'') ILIKE '%tenant_memberships%')::int AS tenant_scoped_product_select_policies,
 (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND cmd='SELECT'
      AND coalesce(qual,'') ILIKE '%store_memberships%')::int AS store_scoped_product_select_policies,
 (SELECT count(*) FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app_private' AND c.relname='channel_secrets'
      AND con.contype='p'
      AND pg_get_constraintdef(con.oid)='PRIMARY KEY (tenant_id, platform)')::int AS legacy_tenant_platform_pk,
 (SELECT count(*) FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app_private' AND c.relname='channel_secrets'
      AND con.contype='u'
      AND pg_get_constraintdef(con.oid)='UNIQUE (platform, external_account_ref)')::int AS provider_account_unique_constraints,
 (SELECT count(*) FROM (
    SELECT platform,external_account_ref FROM app_private.channel_secrets
    GROUP BY platform,external_account_ref HAVING count(*)>1
  ) as dup)::int AS duplicate_provider_account_bindings,
 (SELECT count(*) FROM app_private.channel_secrets s
    LEFT JOIN public.tenants t ON t.id=s.tenant_id WHERE t.id IS NULL)::int AS orphan_provider_tenant_bindings,
 (SELECT c.relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app_private' AND c.relname='channel_secrets') AS private_channel_rls_enabled,
 (SELECT has_table_privilege('anon',c.oid,'SELECT') FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app_private' AND c.relname='channel_secrets') AS private_channel_anon_select,
 (SELECT has_table_privilege('authenticated',c.oid,'SELECT') FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app_private' AND c.relname='channel_secrets') AS private_channel_authenticated_select;

COMMIT;
