-- TIEN404 V18.7.6B: DISPOSABLE PostgreSQL 17 ONLY, NEVER SUPABASE.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 'tien404_v1876b_qa' THEN
  RAISE EXCEPTION 'REFUSE non-disposable database';
 END IF;
END $guard$;
CREATE ROLE v1876b_authenticated NOLOGIN;
CREATE SCHEMA v1876b_qa;
GRANT USAGE ON SCHEMA v1876b_qa TO v1876b_authenticated;
CREATE TABLE v1876b_qa.tenants(id uuid PRIMARY KEY, label text NOT NULL);
CREATE TABLE v1876b_qa.stores(
 tenant_id uuid NOT NULL REFERENCES v1876b_qa.tenants(id),
 id uuid NOT NULL, label text NOT NULL,
 active boolean NOT NULL DEFAULT true, PRIMARY KEY(tenant_id,id)
);
CREATE TABLE v1876b_qa.store_memberships(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','staff')),
 active boolean NOT NULL,PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES v1876b_qa.stores(tenant_id,id)
);
-- These are intentionally tenant-only legacy structures for migration simulation.
CREATE TABLE v1876b_qa.legacy_products(
 tenant_id uuid NOT NULL REFERENCES v1876b_qa.tenants(id),
 id uuid NOT NULL,sku text NOT NULL,price_vnd bigint NOT NULL,
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,sku)
);
CREATE TABLE v1876b_qa.legacy_customers(
 tenant_id uuid NOT NULL,id uuid NOT NULL,label text NOT NULL,PRIMARY KEY(tenant_id,id)
);
CREATE TABLE v1876b_qa.legacy_orders(
 tenant_id uuid NOT NULL,id uuid NOT NULL,customer_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,customer_id) REFERENCES v1876b_qa.legacy_customers(tenant_id,id)
);
CREATE TABLE v1876b_qa.legacy_order_items(
 tenant_id uuid NOT NULL,id uuid NOT NULL,order_id uuid NOT NULL,product_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES v1876b_qa.legacy_orders(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES v1876b_qa.legacy_products(tenant_id,id)
);
-- Explicit, approved QA assignments only. No inference by tenant, SKU or phone.
CREATE TABLE v1876b_qa.store_assignments(
 entity_type text NOT NULL CHECK(entity_type IN ('product','customer','order','item')),
 tenant_id uuid NOT NULL,entity_id uuid NOT NULL,store_id uuid NOT NULL,
 approved boolean NOT NULL DEFAULT false,
 PRIMARY KEY(entity_type,tenant_id,entity_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES v1876b_qa.stores(tenant_id,id)
);
INSERT INTO v1876b_qa.tenants VALUES
 ('10000000-0000-4000-8000-000000000001','Tenant-A'),
 ('10000000-0000-4000-8000-000000000002','Tenant-B');
INSERT INTO v1876b_qa.stores VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Store-A',true),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','Store-C',true),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Store-B',true);
INSERT INTO v1876b_qa.store_memberships VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','owner',true),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','owner',true),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','owner',true),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','staff',true),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000005','owner',false);
INSERT INTO v1876b_qa.legacy_products VALUES
 ('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','SKU-A',12500),
 ('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','SKU-C',13900),
 ('10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','SKU-B',85000);
INSERT INTO v1876b_qa.legacy_customers VALUES
 ('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','QA-A'),
 ('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','QA-C'),
 ('10000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','QA-B');
INSERT INTO v1876b_qa.legacy_orders VALUES
 ('10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003'),
 ('10000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002');
INSERT INTO v1876b_qa.legacy_order_items VALUES
 ('10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003'),
 ('10000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002');
-- Authoritative mapping is a synthetic approval fixture, not real customer mapping.
INSERT INTO v1876b_qa.store_assignments(entity_type,tenant_id,entity_id,store_id,approved)
SELECT type,t,id,store,true FROM (VALUES
 ('product','10000000-0000-4000-8000-000000000001'::uuid,'40000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000001'::uuid),
 ('product','10000000-0000-4000-8000-000000000001'::uuid,'40000000-0000-4000-8000-000000000003'::uuid,'20000000-0000-4000-8000-000000000003'::uuid),
 ('product','10000000-0000-4000-8000-000000000002'::uuid,'40000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000002'::uuid),
 ('customer','10000000-0000-4000-8000-000000000001'::uuid,'50000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000001'::uuid),
 ('customer','10000000-0000-4000-8000-000000000001'::uuid,'50000000-0000-4000-8000-000000000003'::uuid,'20000000-0000-4000-8000-000000000003'::uuid),
 ('customer','10000000-0000-4000-8000-000000000002'::uuid,'50000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000002'::uuid),
 ('order','10000000-0000-4000-8000-000000000001'::uuid,'60000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000001'::uuid),
 ('order','10000000-0000-4000-8000-000000000001'::uuid,'60000000-0000-4000-8000-000000000003'::uuid,'20000000-0000-4000-8000-000000000003'::uuid),
 ('order','10000000-0000-4000-8000-000000000002'::uuid,'60000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000002'::uuid),
 ('item','10000000-0000-4000-8000-000000000001'::uuid,'70000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000001'::uuid),
 ('item','10000000-0000-4000-8000-000000000001'::uuid,'70000000-0000-4000-8000-000000000003'::uuid,'20000000-0000-4000-8000-000000000003'::uuid),
 ('item','10000000-0000-4000-8000-000000000002'::uuid,'70000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000002'::uuid)
) AS f(type,t,id,store);
-- Called before ANY migration. Detect missing/unauthorized assignment and cross-Store associations.
CREATE FUNCTION v1876b_qa.assert_explicit_assignments() RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE missing_count int; mismatch_count int;
BEGIN
 SELECT count(*) INTO missing_count
 FROM (
   SELECT 'product'::text et,tenant_id,id FROM v1876b_qa.legacy_products
   UNION ALL SELECT 'customer',tenant_id,id FROM v1876b_qa.legacy_customers
   UNION ALL SELECT 'order',tenant_id,id FROM v1876b_qa.legacy_orders
   UNION ALL SELECT 'item',tenant_id,id FROM v1876b_qa.legacy_order_items
 ) source
 LEFT JOIN v1876b_qa.store_assignments m ON m.entity_type=source.et
  AND m.tenant_id=source.tenant_id AND m.entity_id=source.id AND m.approved=true
 WHERE m.entity_id IS NULL;
 IF missing_count>0 THEN RAISE EXCEPTION 'V1876B UNAPPROVED OR UNMAPPED STORE ROW'; END IF;
 SELECT count(*) INTO mismatch_count
 FROM v1876b_qa.legacy_orders o
 JOIN v1876b_qa.store_assignments ao ON ao.tenant_id=o.tenant_id AND ao.entity_id=o.id AND ao.entity_type='order'
 JOIN v1876b_qa.store_assignments ac ON ac.tenant_id=o.tenant_id AND ac.entity_id=o.customer_id AND ac.entity_type='customer'
 WHERE ao.store_id<>ac.store_id;
 IF mismatch_count>0 THEN RAISE EXCEPTION 'V1876B CROSS STORE ORDER CUSTOMER'; END IF;
 SELECT count(*) INTO mismatch_count
 FROM v1876b_qa.legacy_order_items i
 JOIN v1876b_qa.store_assignments ai ON ai.tenant_id=i.tenant_id AND ai.entity_id=i.id AND ai.entity_type='item'
 JOIN v1876b_qa.store_assignments ao ON ao.tenant_id=i.tenant_id AND ao.entity_id=i.order_id AND ao.entity_type='order'
 JOIN v1876b_qa.store_assignments ap ON ap.tenant_id=i.tenant_id AND ap.entity_id=i.product_id AND ap.entity_type='product'
 WHERE ai.store_id<>ao.store_id OR ai.store_id<>ap.store_id;
 IF mismatch_count>0 THEN RAISE EXCEPTION 'V1876B CROSS STORE ORDER ITEM'; END IF;
 RETURN true;
END $$;
