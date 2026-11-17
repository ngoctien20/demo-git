-- TIEN404 V17.MULTI-CHANNEL-03B — REAL HOSTED PROVENANCE READ-ONLY
-- No raw tenant IDs/slugs/names, customer data, SKUs, order amounts or tokens.
-- Returns aggregate metadata only; QA-looking values are NOT an original seed proof.
-- Requires authorized read-only staging DB operator. Never use for production writes.
WITH tenant_slots AS (
  SELECT id, row_number() OVER (ORDER BY id) AS slot, slug, name, created_at
  FROM public.tenants
), product_counts AS (
  SELECT t.slot, count(p.id) n,
    min(p.created_at) first_at, max(p.created_at) last_at
  FROM tenant_slots t LEFT JOIN public.products p ON p.tenant_id=t.id
  GROUP BY t.slot
), order_counts AS (
  SELECT t.slot, count(o.id) n,
    count(o.id) FILTER (WHERE o.order_source='manual') manual_count,
    count(o.id) FILTER (WHERE o.customer_id IS NOT NULL) with_customer,
    min(o.created_at) first_at,max(o.created_at) last_at
  FROM tenant_slots t LEFT JOIN public.orders o ON o.tenant_id=t.id
  GROUP BY t.slot
), audit_counts AS (
  SELECT t.slot, count(a.id) audit_total
  FROM tenant_slots t LEFT JOIN app_private.audit_events a ON a.tenant_id=t.id
  GROUP BY t.slot
)
SELECT jsonb_build_object(
 'contract','T404_MC03B_LIVE_PROVENANCE_AGGREGATE_V1',
 'tenant_count',(SELECT count(*) FROM tenant_slots),
 'audited_products',(SELECT count(*) FROM public.products),
 'audited_orders',(SELECT count(*) FROM public.orders),
 'audit_event_count',(SELECT count(*) FROM app_private.audit_events),
 'per_tenant',(
  SELECT jsonb_agg(jsonb_build_object(
   'slot',t.slot,
   'tenant_test_label',t.slug~*'(demo|test|qa|fixture|seed|staging|sandbox)'
     AND t.name~*'(demo|test|qa|fixture|seed|staging|sandbox|thử nghiệm)',
   'products',p.n,
   'orders',o.n,
   'manual_orders',o.manual_count,
   'orders_with_customer_link',o.with_customer,
   'creation_timestamp_equal',(
       p.n=1 AND o.n=1 AND t.created_at=p.first_at
       AND t.created_at=o.first_at
   ),
   'created_at_utc',to_char(t.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'audit_events',a.audit_total
  ) ORDER BY t.slot)
  FROM tenant_slots t
  JOIN product_counts p USING(slot)
  JOIN order_counts o USING(slot)
  JOIN audit_counts a USING(slot)
 )
) AS redacted_provenance;
