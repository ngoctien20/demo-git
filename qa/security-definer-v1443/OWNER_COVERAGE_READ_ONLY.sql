-- TIEN404 V14.4.3 — OWNER COVERAGE READ-ONLY AGGREGATE.
-- Returns NO tenant UUID, record IDs, product SKU, customer details or emails.
-- This is NOT a record-to-store ownership proof; owner review is mandatory.
WITH records AS (
  SELECT tenant_id,count(*) AS n,'product'::text AS kind
    FROM public.products GROUP BY tenant_id
  UNION ALL
  SELECT tenant_id,count(*),'order'::text
    FROM public.orders GROUP BY tenant_id
), per_tenant AS (
  SELECT tenant_id,
    coalesce(sum(n) FILTER (WHERE kind='product'),0) AS products,
    coalesce(sum(n) FILTER (WHERE kind='order'),0) AS orders
  FROM records GROUP BY tenant_id
), anonymous AS (
  SELECT row_number() OVER (ORDER BY products DESC,orders DESC,tenant_id) AS opaque_group,
    products,orders,
    (SELECT count(*) FROM public.tenant_memberships m
      WHERE m.tenant_id=t.tenant_id AND m.active) AS active_memberships,
    (SELECT count(*) FROM public.tenant_memberships m
      WHERE m.tenant_id=t.tenant_id AND m.active AND m.role='owner') AS active_owner_memberships
  FROM per_tenant t
)
SELECT opaque_group,products,orders,active_memberships,active_owner_memberships,
  false AS independently_verified_store_owner,
  'TENANT_COUNTS_ARE_NOT_STORE_PROOF'::text AS scope
FROM anonymous ORDER BY opaque_group;
