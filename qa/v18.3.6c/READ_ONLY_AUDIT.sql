-- TIEN404 V18.3.6C — READ-ONLY STAGING AUDIT
-- SELECT-only. No DDL, DML, RPC invocation, Auth session/token read, or PII selection.
-- Do not add SELECT * or contact/order payload fields to this file.

-- A. Platform and canonical Store schema presence.
SELECT current_setting('server_version') AS pg_version,
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind='r' AND n.nspname='public') AS public_tables,
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind='r' AND n.nspname='public' AND c.relrowsecurity) AS public_rls_tables,
       (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS public_policy_count,
       (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND permissive='RESTRICTIVE') AS public_restrictive_policy_count,
       (SELECT count(*) FROM information_schema.tables
        WHERE table_schema='public' AND table_name IN ('stores','store_memberships')) AS canonical_store_tables,
       (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name IN ('products','orders','order_items','customers','conversations','messages')
          AND column_name='store_id') AS commerce_store_id_columns,
       (SELECT count(*) FROM public.tenant_memberships WHERE active) AS active_tenant_memberships;

-- B. Commerce schema columns; returns names/types only.
SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('tenants','tenant_memberships','products','orders','order_items',
                     'customers','conversations','messages')
ORDER BY table_name,ordinal_position;

-- C. Current Commerce RLS policies.
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('tenants','tenant_memberships','products','orders','order_items',
                    'customers','conversations','messages')
ORDER BY tablename,policyname;

-- D. Direct grants to client roles on private QA schemas.
SELECT n.nspname AS schema_name,
       has_schema_privilege('anon',n.nspname,'USAGE') AS anon_schema_usage,
       has_schema_privilege('authenticated',n.nspname,'USAGE') AS authenticated_schema_usage,
       c.relname AS table_name,c.relrowsecurity,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
       has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select,
       has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_insert,
       has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update,
       has_table_privilege('authenticated',c.oid,'DELETE') AS authenticated_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='r'
  AND n.nspname IN ('app_private','factory_private','tien404_dialogue_private',
                    'tien404_r1_qa','tien404_v175_qa')
ORDER BY n.nspname,c.relname;

-- E. Security-definer function exposure metadata; does not execute the functions.
SELECT p.proname,p.oid::regprocedure::text AS signature,p.prosecdef,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute,
       coalesce(array_to_string(p.proconfig,','),'(none)') AS function_config
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
ORDER BY p.proname;

-- F. Aggregate-only public Commerce row inventory; no identifiers or PII.
SELECT
 (SELECT count(*) FROM public.products) AS products,
 (SELECT count(*) FROM public.products WHERE tenant_id IS NULL) AS products_missing_tenant,
 (SELECT count(*) FROM public.orders) AS orders,
 (SELECT count(*) FROM public.orders WHERE tenant_id IS NULL) AS orders_missing_tenant,
 (SELECT count(*) FROM public.customers) AS customers,
 (SELECT count(*) FROM public.order_items) AS order_items,
 (SELECT count(*) FROM public.conversations) AS conversations,
 (SELECT count(*) FROM public.messages) AS messages,
 (SELECT count(*) FROM public.products p LEFT JOIN public.tenants t ON t.id=p.tenant_id WHERE t.id IS NULL) AS orphan_products,
 (SELECT count(*) FROM public.orders o LEFT JOIN public.tenants t ON t.id=o.tenant_id WHERE t.id IS NULL) AS orphan_orders,
 (SELECT count(*) FROM public.orders o LEFT JOIN public.customers c
    ON c.id=o.customer_id AND c.tenant_id=o.tenant_id
    WHERE o.customer_id IS NOT NULL AND c.id IS NULL) AS orphan_order_customers;

-- G. Trusted Store authority: only aggregate counts, never raw keys or Auth IDs.
WITH m AS (
 SELECT tenant_key,store_key,bot_key,auth_tenant_id,
        EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=tenant_identity_map.auth_tenant_id) AS tenant_exists,
        EXISTS(SELECT 1 FROM public.tenant_memberships tm
               WHERE tm.tenant_id=tenant_identity_map.auth_tenant_id
                 AND tm.active AND tm.role='owner') AS active_owner_exists
 FROM tien404_r1_qa.tenant_identity_map
), by_tenant AS (
 SELECT auth_tenant_id,count(DISTINCT (tenant_key,store_key,bot_key)) AS store_scopes
 FROM m GROUP BY auth_tenant_id
)
SELECT (SELECT count(*) FROM m) AS mapping_rows,
       (SELECT count(DISTINCT (tenant_key,store_key,bot_key)) FROM m) AS distinct_store_scopes,
       (SELECT count(DISTINCT auth_tenant_id) FROM m) AS distinct_auth_tenants,
       (SELECT count(*) FROM m WHERE tenant_exists) AS mappings_to_existing_tenants,
       (SELECT count(*) FROM m WHERE active_owner_exists) AS mappings_with_active_owner,
       (SELECT max(store_scopes) FROM by_tenant) AS max_store_scopes_per_auth_tenant;

-- H. R1 QA status counts only.
SELECT
 (SELECT count(*) FROM tien404_r1_qa.shop_bots WHERE enabled_mode='dry_run' AND identity_status='synthetic_qa') AS synthetic_dry_run_bots,
 (SELECT count(*) FROM tien404_r1_qa.owner_bindings WHERE status='paired') AS paired_bindings,
 (SELECT count(*) FROM tien404_r1_qa.owner_outbox WHERE state='HELD') AS held_outbox,
 (SELECT count(*) FROM tien404_r1_qa.sandbox_orders WHERE status='pending_sandbox') AS pending_sandbox_orders,
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_claims_v3 WHERE status='CONFIRMED') AS confirmed_claims,
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_claims_v3 WHERE status='PENDING_OWNER_CONFIRMATION') AS pending_claims,
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_challenges WHERE used_at IS NOT NULL) AS used_challenges,
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_challenges
    WHERE expires_at<now() AND used_at IS NULL) AS expired_unused_challenges;

-- I. V17.5 private QA row inventory and Storage inventory.
SELECT
 (SELECT count(*) FROM tien404_v175_qa.customer_identity)
 +(SELECT count(*) FROM tien404_v175_qa.channel_identity)
 +(SELECT count(*) FROM tien404_v175_qa.order_ownership)
 +(SELECT count(*) FROM tien404_v175_qa.authorization_audit)
 +(SELECT count(*) FROM tien404_v175_qa.replay_claims)
 +(SELECT count(*) FROM tien404_v175_qa.otp_challenges)
 +(SELECT count(*) FROM tien404_v175_qa.conversation_handoffs)
 +(SELECT count(*) FROM tien404_v175_qa.auth_customer_binding) AS v175_qa_rows,
 (SELECT count(*) FROM storage.buckets) AS storage_buckets,
 (SELECT count(*) FROM storage.objects) AS storage_objects;

-- J. Applied Supabase migration inventory (version/name only).
SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;
