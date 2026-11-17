-- RPC13: SELECT aggregates only, no Auth PII, UUID, tokens or customer row contents.
-- Can be run by authorized DB Operator. Never interpret as Owner/Store proof.
BEGIN TRANSACTION READ ONLY;
WITH tenant_slots AS (
 SELECT id,row_number() OVER(ORDER BY id) slot FROM public.tenants
), slot_counts AS (
 SELECT t.slot,
  (SELECT count(*) FROM public.products p WHERE p.tenant_id=t.id) product_count,
  (SELECT count(*) FROM public.orders o WHERE o.tenant_id=t.id) order_count,
  (SELECT count(*) FROM public.tenant_memberships tm WHERE tm.tenant_id=t.id AND tm.active AND tm.role='owner') active_owners,
  (SELECT count(*) FROM public.tenant_memberships tm JOIN auth.users u ON u.id=tm.user_id
    WHERE tm.tenant_id=t.id AND tm.active AND tm.role='owner' AND u.email_confirmed_at IS NOT NULL) confirmed_auth_owners,
  (SELECT count(*) FROM public.tenant_memberships tm JOIN auth.users u ON u.id=tm.user_id
    WHERE tm.tenant_id=t.id AND tm.active AND tm.role='owner' AND u.last_sign_in_at IS NOT NULL) owners_ever_signed_in
 FROM tenant_slots t
)
SELECT jsonb_build_object(
 'contract','T404_RPC13_OWNER_AUTH_ADMISSION_AGGREGATES_V1',
 'utc',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
 'tenantCount',(SELECT count(*) FROM public.tenants),
 'productRows',(SELECT count(*) FROM public.products),
 'orderRows',(SELECT count(*) FROM public.orders),
 'authSessionRowsAggregateOnly',(SELECT count(*) FROM auth.sessions),
 'canonicalStoresPresent',(to_regclass('public.stores') IS NOT NULL),
 'storeMembershipsPresent',(to_regclass('public.store_memberships') IS NOT NULL),
 'commerceStoreIdColumns',(SELECT count(*) FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN('products','orders','customers','order_items','conversations','messages') AND column_name='store_id'),
 'sourceManualOrders',(SELECT count(*) FROM public.orders WHERE order_source='manual'),
 'tenantSlots',(SELECT jsonb_agg(jsonb_build_object('slot',slot,'productCount',product_count,
   'orderCount',order_count,'activeOwners',active_owners,'confirmedAuthOwners',confirmed_auth_owners,
   'ownersEverSignedIn',owners_ever_signed_in) ORDER BY slot) FROM slot_counts)
) AS sanitized_readiness;
COMMIT;