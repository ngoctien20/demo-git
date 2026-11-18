-- V17.2C.32 — CANDIDATE / NOT EXECUTED on Supabase.
-- DO NOT place in supabase/migrations or run on a remote project.
-- Runs ONLY against the synthetic isolated GitHub CI schema named below.
-- The production schema migration, billing, backup, backfill and deployment
-- require separate approval. This candidate never alters public.*.
DO $guard$
BEGIN
 IF current_database()<>'postgres'
  OR to_regclass('tien404_v172c32_preview.orders') IS NULL
  OR to_regclass('tien404_v172c32_preview.tenant_memberships') IS NULL THEN
   RAISE EXCEPTION 'V172C32_EPHEMERAL_PREVIEW_ONLY';
 END IF;
END
$guard$;

BEGIN;
-- Tenant is subscription/billing boundary; Store is isolated business scope.
CREATE TABLE tien404_v172c32_preview.stores(
 tenant_id uuid NOT NULL REFERENCES tien404_v172c32_preview.tenants(id),
 store_id uuid NOT NULL,store_label text NOT NULL,active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,store_id)
);
CREATE TABLE tien404_v172c32_preview.store_memberships(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','viewer')),
 active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id)
  REFERENCES tien404_v172c32_preview.stores(tenant_id,store_id),
 FOREIGN KEY(tenant_id,user_id)
  REFERENCES tien404_v172c32_preview.tenant_memberships(tenant_id,user_id)
);

-- Expand phase: nullable, no DEFAULT, NEVER assign a legacy row to Store
-- just because it belongs to a tenant. No backfill here.
ALTER TABLE tien404_v172c32_preview.products ADD COLUMN store_id uuid;
ALTER TABLE tien404_v172c32_preview.customers ADD COLUMN store_id uuid;
ALTER TABLE tien404_v172c32_preview.orders ADD COLUMN store_id uuid;
ALTER TABLE tien404_v172c32_preview.order_items ADD COLUMN store_id uuid;
ALTER TABLE tien404_v172c32_preview.products ADD CONSTRAINT products_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES tien404_v172c32_preview.stores(tenant_id,store_id);
ALTER TABLE tien404_v172c32_preview.customers ADD CONSTRAINT customers_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES tien404_v172c32_preview.stores(tenant_id,store_id);
ALTER TABLE tien404_v172c32_preview.orders ADD CONSTRAINT orders_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES tien404_v172c32_preview.stores(tenant_id,store_id);
-- Composite references enforce same Store across order/customer/product
-- once provenance is verified. NULL legacy Store remains restricted by RLS.
ALTER TABLE tien404_v172c32_preview.products ADD CONSTRAINT products_tenant_store_id_uq
 UNIQUE(tenant_id,store_id,id);
ALTER TABLE tien404_v172c32_preview.customers ADD CONSTRAINT customers_tenant_store_id_uq
 UNIQUE(tenant_id,store_id,id);
ALTER TABLE tien404_v172c32_preview.orders ADD CONSTRAINT orders_tenant_store_id_uq
 UNIQUE(tenant_id,store_id,id);
ALTER TABLE tien404_v172c32_preview.orders ADD CONSTRAINT orders_scoped_customer_fk
 FOREIGN KEY(tenant_id,store_id,customer_id)
 REFERENCES tien404_v172c32_preview.customers(tenant_id,store_id,id);
ALTER TABLE tien404_v172c32_preview.order_items ADD CONSTRAINT items_scoped_order_fk
 FOREIGN KEY(tenant_id,store_id,order_id)
 REFERENCES tien404_v172c32_preview.orders(tenant_id,store_id,id);
ALTER TABLE tien404_v172c32_preview.order_items ADD CONSTRAINT items_scoped_product_fk
 FOREIGN KEY(tenant_id,store_id,product_id)
 REFERENCES tien404_v172c32_preview.products(tenant_id,store_id,id);
CREATE INDEX store_memberships_actor_scope_idx
 ON tien404_v172c32_preview.store_memberships(user_id,active,tenant_id,store_id);
CREATE INDEX orders_scoped_recent_idx
 ON tien404_v172c32_preview.orders(tenant_id,store_id,id);
CREATE INDEX items_scoped_order_idx
 ON tien404_v172c32_preview.order_items(tenant_id,store_id,order_id);

ALTER TABLE tien404_v172c32_preview.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.products FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.customers FORCE ROW LEVEL SECURITY;

-- In actual migration, replacing old tenant SELECT policies must be atomic.
-- Adding a second permissive policy without removing the old one leaves
-- same-tenant cross-Store reads permitted (permissive policies are OR-ed).
DROP POLICY legacy_tenant_order_read ON tien404_v172c32_preview.orders;
DROP POLICY legacy_tenant_item_read ON tien404_v172c32_preview.order_items;

-- Store membership is visible ONLY to the authenticated user, and only
-- when their owning tenant membership also remains active.
CREATE POLICY scoped_membership_self_read
 ON tien404_v172c32_preview.store_memberships
 FOR SELECT TO authenticated USING(
   user_id=(SELECT auth.uid()) AND active
   AND EXISTS(SELECT 1 FROM tien404_v172c32_preview.tenant_memberships tm
    WHERE tm.tenant_id=store_memberships.tenant_id
     AND tm.user_id=(SELECT auth.uid()) AND tm.active)
 );
CREATE POLICY scoped_store_read ON tien404_v172c32_preview.stores
 FOR SELECT TO authenticated USING(
  active AND EXISTS(SELECT 1 FROM tien404_v172c32_preview.store_memberships sm
   WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.store_id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active)
 );

CREATE POLICY scoped_order_read ON tien404_v172c32_preview.orders
 FOR SELECT TO authenticated USING(
  store_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM tien404_v172c32_preview.store_memberships sm
   JOIN tien404_v172c32_preview.tenant_memberships tm
     ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
   WHERE sm.tenant_id=orders.tenant_id AND sm.store_id=orders.store_id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active AND tm.active
    AND sm.role IN ('owner','manager') AND tm.role IN ('owner','manager')
  )
 );
CREATE POLICY scoped_items_read ON tien404_v172c32_preview.order_items
 FOR SELECT TO authenticated USING(
  store_id IS NOT NULL
  AND EXISTS(
   SELECT 1 FROM tien404_v172c32_preview.orders o
   WHERE o.tenant_id=order_items.tenant_id AND o.store_id=order_items.store_id
    AND o.id=order_items.order_id
  )
 );
CREATE POLICY scoped_products_read ON tien404_v172c32_preview.products
 FOR SELECT TO authenticated USING(
  store_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM tien404_v172c32_preview.store_memberships sm
   JOIN tien404_v172c32_preview.tenant_memberships tm
    ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
   WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active AND tm.active
    AND sm.role IN ('owner','manager') AND tm.role IN ('owner','manager')
  )
 );
CREATE POLICY scoped_customers_read ON tien404_v172c32_preview.customers
 FOR SELECT TO authenticated USING(
  store_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM tien404_v172c32_preview.store_memberships sm
   JOIN tien404_v172c32_preview.tenant_memberships tm
    ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
   WHERE sm.tenant_id=customers.tenant_id AND sm.store_id=customers.store_id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active AND tm.active
    AND sm.role IN ('owner','manager') AND tm.role IN ('owner','manager')
  )
 );
-- Preserve original client WRITE restrictions (no INSERT/UPDATE/DELETE).
REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172c32_preview FROM PUBLIC,anon;
REVOKE ALL ON tien404_v172c32_preview.stores,
 tien404_v172c32_preview.store_memberships FROM authenticated;
GRANT SELECT ON tien404_v172c32_preview.stores,
 tien404_v172c32_preview.store_memberships,
 tien404_v172c32_preview.products,
 tien404_v172c32_preview.customers TO authenticated;
COMMIT;

-- Known limitations: legacy tenant-scoped SKU UNIQUE(tenant,sku) remains;
-- direct grants are read-only; revenue and privileged backend writers have
-- NOT been migrated. No Store IDs are guessed for unscoped old orders.
