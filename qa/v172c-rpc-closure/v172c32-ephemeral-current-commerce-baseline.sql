-- V17.2C.32: TEST FIXTURE ONLY, GitHub ephemeral PostgreSQL 17.
-- This represents the essential current Commerce tenant-only keys + grants.
-- NEVER apply to connected Supabase, never read/write production data.
CREATE SCHEMA tien404_v172c32_preview;
REVOKE ALL ON SCHEMA tien404_v172c32_preview FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA tien404_v172c32_preview TO authenticated;
CREATE TABLE tien404_v172c32_preview.tenants(id uuid PRIMARY KEY);
CREATE TABLE tien404_v172c32_preview.tenant_memberships(
 tenant_id uuid NOT NULL REFERENCES tien404_v172c32_preview.tenants(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL CHECK (role IN ('owner','manager','staff')),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE tien404_v172c32_preview.customers(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tien404_v172c32_preview.tenants(id),
 display_name text NOT NULL,
 UNIQUE(tenant_id,id)
);
CREATE TABLE tien404_v172c32_preview.products(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tien404_v172c32_preview.tenants(id),
 sku text NOT NULL,name text NOT NULL,price_vnd bigint NOT NULL CHECK(price_vnd>=0),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,sku)
);
CREATE TABLE tien404_v172c32_preview.orders(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tien404_v172c32_preview.tenants(id),
 customer_id uuid NULL,status text NOT NULL DEFAULT 'pending',
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),
 order_source text NOT NULL DEFAULT 'manual',
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,customer_id) REFERENCES tien404_v172c32_preview.customers(tenant_id,id)
);
CREATE TABLE tien404_v172c32_preview.order_items(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,
 order_id uuid NOT NULL,product_id uuid NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0),
 unit_price_vnd bigint NOT NULL CHECK(unit_price_vnd>=0),
 FOREIGN KEY(tenant_id,order_id) REFERENCES tien404_v172c32_preview.orders(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES tien404_v172c32_preview.products(tenant_id,id),
 UNIQUE(order_id,product_id)
);
INSERT INTO auth.users(id) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff') ON CONFLICT DO NOTHING;
INSERT INTO tien404_v172c32_preview.tenants(id) VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
INSERT INTO tien404_v172c32_preview.tenant_memberships(tenant_id,user_id,role,active) VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner',true),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','manager',true),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc','owner',true);
INSERT INTO tien404_v172c32_preview.customers(id,tenant_id,display_name) VALUES
 ('71717171-7171-4717-8717-717171717171','dddddddd-dddd-4ddd-8ddd-dddddddddddd','Synthetic A'),
 ('72727272-7272-4727-8727-727272727272','dddddddd-dddd-4ddd-8ddd-dddddddddddd','Synthetic B'),
 ('73737373-7373-4737-8737-737373737373','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Synthetic C');
INSERT INTO tien404_v172c32_preview.products(id,tenant_id,sku,name,price_vnd) VALUES
 ('51515151-5151-4515-8515-515151515151','dddddddd-dddd-4ddd-8ddd-dddddddddddd','A-SKU','Synthetic A product',159000),
 ('52525252-5252-4525-8525-525252525252','dddddddd-dddd-4ddd-8ddd-dddddddddddd','B-SKU','Synthetic B product',159000),
 ('53535353-5353-4535-8535-535353535353','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','C-SKU','Synthetic C product',159000);
INSERT INTO tien404_v172c32_preview.orders(id,tenant_id,customer_id,status,total_vnd) VALUES
 ('10101010-1010-4010-8010-101010101010','dddddddd-dddd-4ddd-8ddd-dddddddddddd','71717171-7171-4717-8717-717171717171','pending',159000),
 ('20202020-2020-4020-8020-202020202020','dddddddd-dddd-4ddd-8ddd-dddddddddddd','72727272-7272-4727-8727-727272727272','pending',159000),
 ('30303030-3030-4030-8030-303030303030','dddddddd-dddd-4ddd-8ddd-dddddddddddd',NULL,'pending',250000),
 ('40404040-4040-4040-8040-404040404040','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','73737373-7373-4737-8737-737373737373','pending',159000);
INSERT INTO tien404_v172c32_preview.order_items(id,tenant_id,order_id,product_id,quantity,unit_price_vnd) VALUES
 ('61616161-6161-4616-8616-616161616161','dddddddd-dddd-4ddd-8ddd-dddddddddddd','10101010-1010-4010-8010-101010101010','51515151-5151-4515-8515-515151515151',1,159000),
 ('62626262-6262-4626-8626-626262626262','dddddddd-dddd-4ddd-8ddd-dddddddddddd','20202020-2020-4020-8020-202020202020','52525252-5252-4525-8525-525252525252',1,159000),
 ('63636363-6363-4636-8636-636363636363','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','40404040-4040-4040-8040-404040404040','53535353-5353-4535-8535-535353535353',1,159000);

-- Reproduce observed tenant-wide read policy: QA A and QA B both see
-- three tenant-1 Orders even if the business later requires A/B separation.
ALTER TABLE tien404_v172c32_preview.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c32_preview.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY membership_own_read ON tien404_v172c32_preview.tenant_memberships
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND active);
CREATE POLICY legacy_tenant_order_read ON tien404_v172c32_preview.orders
 FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM tien404_v172c32_preview.tenant_memberships m
 WHERE m.tenant_id=orders.tenant_id AND m.user_id=(SELECT auth.uid())
 AND m.active AND m.role IN ('owner','manager')));
CREATE POLICY legacy_tenant_item_read ON tien404_v172c32_preview.order_items
 FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM tien404_v172c32_preview.tenant_memberships m
 WHERE m.tenant_id=order_items.tenant_id AND m.user_id=(SELECT auth.uid())
 AND m.active AND m.role IN ('owner','manager')));
GRANT SELECT ON tien404_v172c32_preview.tenant_memberships,
 tien404_v172c32_preview.orders,tien404_v172c32_preview.order_items TO authenticated;
