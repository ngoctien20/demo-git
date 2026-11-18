-- TIEN404 V18.6.3: disposable PostgreSQL 17 only. NEVER execute on Supabase.
\set ON_ERROR_STOP on
CREATE ROLE v1863_authenticated NOLOGIN;
CREATE SCHEMA v1863_qa;
GRANT USAGE ON SCHEMA v1863_qa TO v1863_authenticated;
CREATE TABLE v1863_qa.tenants (id uuid PRIMARY KEY, label text NOT NULL);
CREATE TABLE v1863_qa.stores (
 tenant_id uuid NOT NULL REFERENCES v1863_qa.tenants(id),
 id uuid NOT NULL,
 label text NOT NULL,
 status text NOT NULL CHECK(status IN ('active','disabled')),
 PRIMARY KEY (tenant_id,id)
);
CREATE TABLE v1863_qa.store_memberships (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','staff')),
 active boolean NOT NULL,
 PRIMARY KEY (tenant_id,store_id,user_id),
 FOREIGN KEY (tenant_id,store_id) REFERENCES v1863_qa.stores(tenant_id,id)
);
CREATE TABLE v1863_qa.orders (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 id uuid NOT NULL,
 description text NOT NULL,
 PRIMARY KEY(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES v1863_qa.stores(tenant_id,id)
);
CREATE TABLE v1863_qa.products (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 sku text NOT NULL,
 PRIMARY KEY(tenant_id,store_id,sku),
 FOREIGN KEY(tenant_id,store_id) REFERENCES v1863_qa.stores(tenant_id,id)
);
CREATE TABLE v1863_qa.page_connections (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 platform text NOT NULL CHECK(platform='messenger'),
 page_id text NOT NULL,
 status text NOT NULL CHECK(status IN ('connected','disconnected','reauthorization_required')),
 PRIMARY KEY(tenant_id,store_id,platform,page_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES v1863_qa.stores(tenant_id,id)
);
CREATE UNIQUE INDEX v1863_unique_active_page ON v1863_qa.page_connections(platform,page_id)
 WHERE status IN ('connected','reauthorization_required');

-- Synthetic identities; never user/customer IDs.
INSERT INTO v1863_qa.tenants VALUES
 ('10000000-0000-4000-8000-000000000001','tenant-1'),
 ('10000000-0000-4000-8000-000000000002','tenant-2');
INSERT INTO v1863_qa.stores VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','A','active'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','B','active'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','C','active');
INSERT INTO v1863_qa.store_memberships VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','owner',true),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','owner',true),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','manager',true),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000005','staff',true),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000006','owner',false),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','owner',true);
INSERT INTO v1863_qa.orders VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','order-a'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','order-b'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003','order-c');
INSERT INTO v1863_qa.products VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','SKU-A'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','SKU-B'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','SKU-C');
INSERT INTO v1863_qa.page_connections VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','messenger','mock-page-a','connected'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','messenger','mock-page-b','connected');

ALTER TABLE v1863_qa.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1863_qa.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1863_qa.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1863_qa.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE v1863_qa.page_connections ENABLE ROW LEVEL SECURITY;
-- Selection grants only: no order/product/page writes by the test role.
GRANT SELECT ON ALL TABLES IN SCHEMA v1863_qa TO v1863_authenticated;
CREATE POLICY own_membership ON v1863_qa.store_memberships FOR SELECT TO v1863_authenticated
 USING (active AND user_id = nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
CREATE POLICY store_read ON v1863_qa.stores FOR SELECT TO v1863_authenticated
 USING (status='active' AND EXISTS (
  SELECT 1 FROM v1863_qa.store_memberships m WHERE m.tenant_id=stores.tenant_id AND m.store_id=stores.id
  AND m.active AND m.user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
 ));
CREATE POLICY products_read ON v1863_qa.products FOR SELECT TO v1863_authenticated
 USING (EXISTS (
  SELECT 1 FROM v1863_qa.stores s WHERE s.tenant_id=products.tenant_id AND s.id=products.store_id
 ));
CREATE POLICY orders_manager_read ON v1863_qa.orders FOR SELECT TO v1863_authenticated
 USING (EXISTS (
  SELECT 1 FROM v1863_qa.store_memberships m JOIN v1863_qa.stores s ON s.tenant_id=m.tenant_id AND s.id=m.store_id
  WHERE m.tenant_id=orders.tenant_id AND m.store_id=orders.store_id
   AND m.user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid AND m.active
   AND m.role IN ('owner','manager') AND s.status='active'
 ));
CREATE POLICY page_manager_read ON v1863_qa.page_connections FOR SELECT TO v1863_authenticated
 USING (EXISTS (
  SELECT 1 FROM v1863_qa.store_memberships m JOIN v1863_qa.stores s ON s.tenant_id=m.tenant_id AND s.id=m.store_id
  WHERE m.tenant_id=page_connections.tenant_id AND m.store_id=page_connections.store_id
   AND m.user_id=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid AND m.active
   AND m.role IN ('owner','manager') AND s.status='active'
 ));
