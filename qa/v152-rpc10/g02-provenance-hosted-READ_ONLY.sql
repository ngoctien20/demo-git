-- RPC.10-G0.2 — operator-safe hosted aggregate provenance inventory, READ ONLY.
-- Prints ONLY counts/schema-presence and anonymous Tenant slot numbers, never UUID/PII.
-- No primary-source Merchant attestation can be established by this query.
-- No customer Product/Order rows, JWT, auth.users, secret, event payload or
-- private request_key/request_sha256 are SELECTed/exported.
BEGIN TRANSACTION READ ONLY;

WITH tenant_slots AS (
  SELECT id, row_number() OVER (ORDER BY id) AS slot FROM public.tenants
),
slot_totals AS (
  SELECT t.slot,
   (SELECT count(*) FROM public.products p WHERE p.tenant_id=t.id) AS products,
   (SELECT count(*) FROM public.orders o WHERE o.tenant_id=t.id) AS orders,
   (SELECT count(*) FROM public.orders o WHERE o.tenant_id=t.id
    AND o.order_source IS NOT NULL AND btrim(o.order_source)<>'') AS source_labeled_orders,
   (SELECT count(*) FROM public.orders o WHERE o.tenant_id=t.id
    AND o.customer_id IS NOT NULL) AS customer_linked_orders,
   (SELECT count(*) FROM public.tenant_memberships m WHERE m.tenant_id=t.id
    AND m.active AND m.role='owner') AS tenant_owner_memberships,
   (SELECT count(*) FROM public.tenant_agent_configs c WHERE c.tenant_id=t.id) AS agent_config_rows
  FROM tenant_slots t
),
column_flags AS (
 SELECT
  count(*) FILTER (WHERE table_schema='public' AND table_name='products' AND
    column_name IN ('store_id','created_by','source_ref','origin_ref')) AS product_provenance_candidates,
  count(*) FILTER (WHERE table_schema='public' AND table_name='orders' AND
    column_name IN ('store_id','created_by','source_ref','origin_ref')) AS order_provenance_candidates,
  count(*) FILTER (WHERE table_schema='public' AND table_name IN
    ('products','orders','customers','order_items','conversations','messages')
    AND column_name='store_id') AS commerce_store_columns,
  count(*) FILTER (WHERE table_schema='public' AND table_name='orders'
    AND column_name='order_source') AS order_source_column_present
 FROM information_schema.columns
),
private_evidence AS (
 SELECT
  (SELECT count(*) FROM app_private.order_idempotency) AS idempotency_rows,
  (SELECT count(DISTINCT o.id) FROM app_private.order_idempotency i
    JOIN public.orders o ON o.id=i.order_id AND o.tenant_id=i.tenant_id) AS orders_linked_to_idempotency,
  (SELECT count(*) FROM factory_private.events) AS factory_events,
  (SELECT count(*) FROM factory_private.agent_runs) AS factory_agent_runs
),
policy_info AS (
 SELECT count(*) AS legacy_permissive_storeless_read_policies FROM pg_policies
 WHERE schemaname='public' AND cmd='SELECT' AND permissive='PERMISSIVE'
 AND tablename IN ('products','orders','customers','order_items','conversations','messages')
 AND coalesce(qual,'') NOT ILIKE '%store_id%'
)
SELECT jsonb_build_object(
 'contract','T404_RPC10_G02_HOSTED_AGGREGATES_V1',
 'scope','HOSTED_READ_ONLY_AGGREGATES',
 'collectedAtUtc',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
 'tenants',(SELECT count(*) FROM public.tenants),
 'products',(SELECT count(*) FROM public.products),
 'orders',(SELECT count(*) FROM public.orders),
 'customers',(SELECT count(*) FROM public.customers),
 'canonicalStoresPresent',to_regclass('public.stores') IS NOT NULL,
 'storeMembershipsPresent',to_regclass('public.store_memberships') IS NOT NULL,
 'slotAggregates',(SELECT jsonb_agg(jsonb_build_object(
     'slot',slot,'products',products,'orders',orders,
     'sourceLabeledOrders',source_labeled_orders,
     'customerLinkedOrders',customer_linked_orders,
     'tenantOwnerMemberships',tenant_owner_memberships,
     'agentConfigRows',agent_config_rows) ORDER BY slot) FROM slot_totals),
 'productProvenanceCandidates',(SELECT product_provenance_candidates FROM column_flags),
 'orderProvenanceCandidates',(SELECT order_provenance_candidates FROM column_flags),
 'commerceStoreColumns',(SELECT commerce_store_columns FROM column_flags),
 'orderSourceColumnPresent',(SELECT order_source_column_present FROM column_flags),
 'idempotencyRows',(SELECT idempotency_rows FROM private_evidence),
 'ordersLinkedToIdempotency',(SELECT orders_linked_to_idempotency FROM private_evidence),
 'factoryEvents',(SELECT factory_events FROM private_evidence),
 'factoryAgentRuns',(SELECT factory_agent_runs FROM private_evidence),
 'legacyPermissiveStorelessReadPolicies',(SELECT legacy_permissive_storeless_read_policies FROM policy_info)
) AS sanitized_provenance_snapshot;
COMMIT;
-- An optional private Operator running this should retain the resulting *counts*
-- only. Never interpret labeled order source as merchant/Store ownership proof.
