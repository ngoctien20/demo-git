-- TIEN404 H11R10: Disposable PostgreSQL17 compatibility, NOT hosted migration.
-- Inherit previously verified same-Tenant Store regression; keep real hosted unchanged.
\set ON_ERROR_STOP on
\ir ../h11r9/pg17-same-tenant-role-gap.regression.sql
BEGIN;
CREATE SCHEMA qa_h11r10;
CREATE TABLE qa_h11r10.tenants (id uuid PRIMARY KEY);
CREATE TABLE qa_h11r10.products (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES qa_h11r10.tenants(id),
 sku text NOT NULL, price_vnd bigint NOT NULL CHECK(price_vnd >= 0),
 CONSTRAINT products_tenant_id_id_key UNIQUE(tenant_id,id),
 CONSTRAINT products_tenant_id_sku_key UNIQUE(tenant_id,sku)
);
CREATE TABLE qa_h11r10.orders (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES qa_h11r10.tenants(id),
 total_vnd bigint NOT NULL CHECK(total_vnd >= 0),
 CONSTRAINT orders_tenant_id_id_key UNIQUE(tenant_id,id)
);
CREATE TABLE qa_h11r10.order_items (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, order_id uuid NOT NULL,product_id uuid NOT NULL,
 quantity integer NOT NULL CHECK(quantity > 0),
 FOREIGN KEY(tenant_id,order_id) REFERENCES qa_h11r10.orders(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES qa_h11r10.products(tenant_id,id)
);
INSERT INTO qa_h11r10.tenants VALUES('01000000-0000-4000-8000-000000000001');
INSERT INTO qa_h11r10.products VALUES
 ('03000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001','LEG-A',159000),
 ('03000000-0000-4000-8000-000000000002','01000000-0000-4000-8000-000000000001','LEG-B',199000);
INSERT INTO qa_h11r10.orders VALUES
 ('04000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001',318000),
 ('04000000-0000-4000-8000-000000000002','01000000-0000-4000-8000-000000000001',199000);
INSERT INTO qa_h11r10.order_items VALUES
 ('05000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001',
 '04000000-0000-4000-8000-000000000001','03000000-0000-4000-8000-000000000001',2);
-- EXPAND only. Existing business rows remain NULL/unassigned until verified mapping.
CREATE TABLE qa_h11r10.stores(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES qa_h11r10.tenants(id),
 UNIQUE(tenant_id,id));
INSERT INTO qa_h11r10.stores VALUES
 ('02000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001'),
 ('02000000-0000-4000-8000-000000000002','01000000-0000-4000-8000-000000000001');
ALTER TABLE qa_h11r10.products ADD COLUMN store_id uuid;
ALTER TABLE qa_h11r10.orders ADD COLUMN store_id uuid;
ALTER TABLE qa_h11r10.order_items ADD COLUMN store_id uuid;
ALTER TABLE qa_h11r10.products
 ADD CONSTRAINT products_tenant_store_fk FOREIGN KEY(tenant_id,store_id)
 REFERENCES qa_h11r10.stores(tenant_id,id);
ALTER TABLE qa_h11r10.orders
 ADD CONSTRAINT orders_tenant_store_fk FOREIGN KEY(tenant_id,store_id)
 REFERENCES qa_h11r10.stores(tenant_id,id);
ALTER TABLE qa_h11r10.products
 ADD CONSTRAINT products_tenant_store_id_key UNIQUE(tenant_id,store_id,id);
ALTER TABLE qa_h11r10.orders
 ADD CONSTRAINT orders_tenant_store_id_key UNIQUE(tenant_id,store_id,id);
ALTER TABLE qa_h11r10.order_items
 ADD CONSTRAINT order_items_tenant_store_order_fk FOREIGN KEY(tenant_id,store_id,order_id)
 REFERENCES qa_h11r10.orders(tenant_id,store_id,id);
ALTER TABLE qa_h11r10.order_items
 ADD CONSTRAINT order_items_tenant_store_product_fk FOREIGN KEY(tenant_id,store_id,product_id)
 REFERENCES qa_h11r10.products(tenant_id,store_id,id);
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_h11r10.products WHERE store_id IS NULL)<>2
 OR (SELECT count(*) FROM qa_h11r10.orders WHERE store_id IS NULL)<>2
 OR (SELECT count(*) FROM qa_h11r10.order_items WHERE store_id IS NULL)<>1
 THEN RAISE EXCEPTION 'H11R10_SILENT_LEGACY_STORE_ASSIGNMENT'; END IF;
 RAISE NOTICE 'H11R10_PASS_LEGACY_UNASSIGNED_AFTER_EXPAND';
END $qa$;
-- Synthetic evidence flags are TEST INPUT ONLY; never actual merchant proof.
CREATE TABLE qa_h11r10.synthetic_mapping(
 row_kind text NOT NULL CHECK(row_kind IN ('product','order','item')),
 row_id uuid NOT NULL, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 synthetic_verified boolean NOT NULL DEFAULT false,
 PRIMARY KEY(row_kind,row_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_h11r10.stores(tenant_id,id)
);
INSERT INTO qa_h11r10.synthetic_mapping VALUES
 ('product','03000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000001',true),
 ('product','03000000-0000-4000-8000-000000000002','01000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000002',false),
 ('order','04000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000001',true),
 ('order','04000000-0000-4000-8000-000000000002','01000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000002',true),
 ('item','05000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000001',true);
-- Missing mapping must STOP a batch (never accept partial implicit default Store).
DO $qa$ DECLARE missing_count int; BEGIN
 SELECT count(*) INTO missing_count FROM (
 SELECT 'product' kind,id FROM qa_h11r10.products UNION ALL
 SELECT 'order',id FROM qa_h11r10.orders UNION ALL
 SELECT 'item',id FROM qa_h11r10.order_items) x
 LEFT JOIN qa_h11r10.synthetic_mapping m ON m.row_kind=x.kind AND m.row_id=x.id
 WHERE m.synthetic_verified IS DISTINCT FROM true;
 IF missing_count<>1 THEN RAISE EXCEPTION 'H11R10_MISSING_MAPPING_NOT_DETECTED'; END IF;
 IF (SELECT count(*) FROM qa_h11r10.products WHERE store_id IS NOT NULL)<>0
 THEN RAISE EXCEPTION 'H11R10_PARTIAL_BACKFILL_OCCURRED'; END IF;
 RAISE NOTICE 'H11R10_PASS_MISSING_OWNER_MAPPING_FAIL_CLOSED';
END $qa$;
UPDATE qa_h11r10.synthetic_mapping SET synthetic_verified=true WHERE row_kind='product'
 AND row_id='03000000-0000-4000-8000-000000000002';
DO $qa$ BEGIN
 IF EXISTS(SELECT 1 FROM (
 SELECT 'product' kind,id,tenant_id FROM qa_h11r10.products UNION ALL
 SELECT 'order',id,tenant_id FROM qa_h11r10.orders UNION ALL
 SELECT 'item',id,tenant_id FROM qa_h11r10.order_items) x
 LEFT JOIN qa_h11r10.synthetic_mapping m
 ON m.row_kind=x.kind AND m.row_id=x.id AND m.tenant_id=x.tenant_id
 WHERE m.synthetic_verified IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'H11R10_MAPPING_INCOMPLETE'; END IF;
END $qa$;
UPDATE qa_h11r10.products p SET store_id=m.store_id
 FROM qa_h11r10.synthetic_mapping m WHERE m.row_kind='product'
 AND m.row_id=p.id AND m.tenant_id=p.tenant_id AND m.synthetic_verified
 AND p.store_id IS NULL;
UPDATE qa_h11r10.orders o SET store_id=m.store_id
 FROM qa_h11r10.synthetic_mapping m WHERE m.row_kind='order'
 AND m.row_id=o.id AND m.tenant_id=o.tenant_id AND m.synthetic_verified
 AND o.store_id IS NULL;
UPDATE qa_h11r10.order_items i SET store_id=m.store_id
 FROM qa_h11r10.synthetic_mapping m WHERE m.row_kind='item'
 AND m.row_id=i.id AND m.tenant_id=i.tenant_id AND m.synthetic_verified
 AND i.store_id IS NULL;
-- No partial attribution and no legacy ID/amount loss.
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_h11r10.products)<>2
 OR (SELECT count(*) FROM qa_h11r10.orders)<>2
 OR (SELECT count(*) FROM qa_h11r10.order_items)<>1
 OR (SELECT sum(price_vnd) FROM qa_h11r10.products)<>358000
 OR (SELECT sum(total_vnd) FROM qa_h11r10.orders)<>517000
 OR EXISTS (SELECT 1 FROM qa_h11r10.products WHERE store_id IS NULL)
 OR EXISTS (SELECT 1 FROM qa_h11r10.orders WHERE store_id IS NULL)
 OR EXISTS (SELECT 1 FROM qa_h11r10.order_items WHERE store_id IS NULL)
 THEN RAISE EXCEPTION 'H11R10_BACKFILL_INTEGRITY_FAILED'; END IF;
 RAISE NOTICE 'H11R10_PASS_SYNTHETIC_MAPPING_BACKFILL_PRESERVED_IDS_COUNTS_AMOUNTS';
END $qa$;
-- Only after 100% attribution, model SET NOT NULL. No such hosted precondition yet.
ALTER TABLE qa_h11r10.products ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE qa_h11r10.orders ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE qa_h11r10.order_items ALTER COLUMN store_id SET NOT NULL;
-- The existing Tenant-wide SKU uniqueness blocks duplicate SKU in A vs B.
INSERT INTO qa_h11r10.products VALUES
 ('03000000-0000-4000-8000-000000000003','01000000-0000-4000-8000-000000000001','REPEAT',100,
  '02000000-0000-4000-8000-000000000001');
DO $qa$ DECLARE rejected boolean:=false; BEGIN
 BEGIN
  INSERT INTO qa_h11r10.products VALUES
   ('03000000-0000-4000-8000-000000000004','01000000-0000-4000-8000-000000000001','REPEAT',200,
    '02000000-0000-4000-8000-000000000002');
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'H11R10_OLD_SKU_UNIQUE_COMPAT_BLOCKER_NOT_DETECTED'; END IF;
 RAISE NOTICE 'H11R10_PASS_TENANT_SKU_UNIQUE_IS_COMPAT_BLOCKER';
END $qa$;
-- Contract-phase candidate is allowed ONLY inside this disposable transaction.
-- Existing callers must be migrated before dropping Tenant-wide uniqueness for real.
ALTER TABLE qa_h11r10.products DROP CONSTRAINT products_tenant_id_sku_key;
ALTER TABLE qa_h11r10.products ADD CONSTRAINT products_tenant_store_sku_key UNIQUE (tenant_id,store_id,sku);
INSERT INTO qa_h11r10.products VALUES
 ('03000000-0000-4000-8000-000000000004','01000000-0000-4000-8000-000000000001','REPEAT',200,
  '02000000-0000-4000-8000-000000000002');
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_h11r10.products WHERE sku='REPEAT')<>2
 THEN RAISE EXCEPTION 'H11R10_STORE_SKU_NAMESPACE_NOT_SUPPORTED'; END IF;
 RAISE NOTICE 'H11R10_PASS_STORE_SCOPED_SKU_CANDIDATE';
END $qa$;
-- FK test must forbid a Store A order referencing Store B product.
DO $qa$ DECLARE rejected boolean:=false; BEGIN
 BEGIN
  INSERT INTO qa_h11r10.order_items VALUES
   ('05000000-0000-4000-8000-000000000009','01000000-0000-4000-8000-000000000001',
   '04000000-0000-4000-8000-000000000001','03000000-0000-4000-8000-000000000002',1,
   '02000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'H11R10_CROSS_STORE_ORDER_ITEM_ALLOWED'; END IF;
 RAISE NOTICE 'H11R10_PASS_COMPOSITE_FK_CROSS_STORE_DENIED';
END $qa$;
-- Candidate schema and synthetic rows are all rolled back, no hostile mutation.
ROLLBACK;
SELECT 'H11R10_DISPOSABLE_PG17_STORE_COMPATIBILITY_PASS_NOT_HOSTED' AS result;
