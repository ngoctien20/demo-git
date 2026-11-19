-- TIEN404 V18.7.6B: disposable PG17 TRANSACTIONAL migration preview.
-- NEVER execute on Supabase. Only synthetic QA data.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database() <> 'tien404_v1876b_qa' THEN
  RAISE EXCEPTION 'REFUSE non-disposable database';
 END IF;
END $guard$;
SELECT v1876b_qa.assert_explicit_assignments();
CREATE TABLE v1876b_qa.customers(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,id uuid NOT NULL,label text NOT NULL,
 PRIMARY KEY(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES v1876b_qa.stores(tenant_id,id)
);
CREATE TABLE v1876b_qa.products(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,id uuid NOT NULL,sku text NOT NULL,price_vnd bigint NOT NULL CHECK(price_vnd>0),
 PRIMARY KEY(tenant_id,store_id,id),UNIQUE(tenant_id,store_id,sku),
 FOREIGN KEY(tenant_id,store_id) REFERENCES v1876b_qa.stores(tenant_id,id)
);
CREATE TABLE v1876b_qa.orders(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,id uuid NOT NULL,customer_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES v1876b_qa.stores(tenant_id,id),
 FOREIGN KEY(tenant_id,store_id,customer_id) REFERENCES v1876b_qa.customers(tenant_id,store_id,id)
);
CREATE TABLE v1876b_qa.order_items(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,id uuid NOT NULL,order_id uuid NOT NULL,product_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id,order_id) REFERENCES v1876b_qa.orders(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id,product_id) REFERENCES v1876b_qa.products(tenant_id,store_id,id)
);
CREATE TABLE v1876b_qa.page_connections(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,provider text NOT NULL CHECK(provider='messenger'),
 page_key text NOT NULL, status text NOT NULL CHECK(status IN ('connected','revoked','reauthorization_required')),
 PRIMARY KEY(tenant_id,store_id,page_key),
 FOREIGN KEY(tenant_id,store_id) REFERENCES v1876b_qa.stores(tenant_id,id)
);
CREATE UNIQUE INDEX qa_unique_active_page ON v1876b_qa.page_connections(provider,page_key)
 WHERE status IN ('connected','reauthorization_required');
INSERT INTO v1876b_qa.customers
 SELECT c.tenant_id,m.store_id,c.id,c.label FROM v1876b_qa.legacy_customers c
 JOIN v1876b_qa.store_assignments m ON m.tenant_id=c.tenant_id AND m.entity_id=c.id AND m.entity_type='customer' AND m.approved=true;
INSERT INTO v1876b_qa.products
 SELECT p.tenant_id,m.store_id,p.id,p.sku,p.price_vnd FROM v1876b_qa.legacy_products p
 JOIN v1876b_qa.store_assignments m ON m.tenant_id=p.tenant_id AND m.entity_id=p.id AND m.entity_type='product' AND m.approved=true;
INSERT INTO v1876b_qa.orders
 SELECT o.tenant_id,m.store_id,o.id,o.customer_id FROM v1876b_qa.legacy_orders o
 JOIN v1876b_qa.store_assignments m ON m.tenant_id=o.tenant_id AND m.entity_id=o.id AND m.entity_type='order' AND m.approved=true;
INSERT INTO v1876b_qa.order_items
 SELECT i.tenant_id,m.store_id,i.id,i.order_id,i.product_id FROM v1876b_qa.legacy_order_items i
 JOIN v1876b_qa.store_assignments m ON m.tenant_id=i.tenant_id AND m.entity_id=i.id AND m.entity_type='item' AND m.approved=true;
-- Two same-tenant stores can now use the SAME sku with DIFFERENT prices.
INSERT INTO v1876b_qa.products VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000011','SKU-SHARED',12000),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000013','SKU-SHARED',14500);
INSERT INTO v1876b_qa.page_connections VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','messenger','QA-PAGE-A','connected'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','messenger','QA-PAGE-C','connected');
ALTER TABLE v1876b_qa.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.products FORCE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.page_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1876b_qa.page_connections FORCE ROW LEVEL SECURITY;
GRANT SELECT ON v1876b_qa.stores,v1876b_qa.store_memberships,
 v1876b_qa.customers,v1876b_qa.products,v1876b_qa.orders,
 v1876b_qa.order_items,v1876b_qa.page_connections TO v1876b_authenticated;
-- No SELECT grants on any legacy/source/assignment tables for the app role.
-- No INSERT, UPDATE, DELETE, TRUNCATE or REFERENCES grants for the app role.
CREATE POLICY member_self ON v1876b_qa.store_memberships FOR SELECT TO v1876b_authenticated
 USING (active=true AND user_id=NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid);
CREATE POLICY own_active_store ON v1876b_qa.stores FOR SELECT TO v1876b_authenticated
 USING (active=true AND EXISTS(
  SELECT 1 FROM v1876b_qa.store_memberships m
   WHERE m.tenant_id=stores.tenant_id AND m.store_id=stores.id AND m.active=true
    AND m.user_id=NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
 ));
CREATE POLICY scoped_products ON v1876b_qa.products FOR SELECT TO v1876b_authenticated
 USING (EXISTS(
  SELECT 1 FROM v1876b_qa.stores s
   WHERE s.tenant_id=products.tenant_id AND s.id=products.store_id
 ));
CREATE POLICY scoped_orders ON v1876b_qa.orders FOR SELECT TO v1876b_authenticated
 USING (EXISTS(
  SELECT 1 FROM v1876b_qa.store_memberships m
  JOIN v1876b_qa.stores s ON s.tenant_id=m.tenant_id AND s.id=m.store_id
   WHERE m.tenant_id=orders.tenant_id AND m.store_id=orders.store_id
   AND m.user_id=NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
   AND m.active=true AND m.role IN ('owner','manager') AND s.active=true
 ));
CREATE POLICY scoped_customers ON v1876b_qa.customers FOR SELECT TO v1876b_authenticated
 USING (EXISTS(
  SELECT 1 FROM v1876b_qa.store_memberships m
   JOIN v1876b_qa.stores s ON s.tenant_id=m.tenant_id AND s.id=m.store_id
  WHERE m.tenant_id=customers.tenant_id AND m.store_id=customers.store_id
   AND m.user_id=NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
   AND m.active=true AND m.role IN ('owner','manager') AND s.active=true
 ));
CREATE POLICY scoped_items ON v1876b_qa.order_items FOR SELECT TO v1876b_authenticated
 USING (EXISTS(
  SELECT 1 FROM v1876b_qa.orders o
  WHERE o.tenant_id=order_items.tenant_id AND o.store_id=order_items.store_id
  AND o.id=order_items.order_id
 ));
CREATE POLICY scoped_page_bindings ON v1876b_qa.page_connections FOR SELECT TO v1876b_authenticated
 USING (EXISTS(
  SELECT 1 FROM v1876b_qa.store_memberships m
   JOIN v1876b_qa.stores s ON s.tenant_id=m.tenant_id AND s.id=m.store_id
  WHERE m.tenant_id=page_connections.tenant_id AND m.store_id=page_connections.store_id
   AND m.user_id=NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
   AND m.active=true AND m.role IN ('owner','manager') AND s.active=true
 ));
COMMIT;
