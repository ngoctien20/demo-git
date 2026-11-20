-- TIEN404 V19.8.17: DISPOSABLE PostgreSQL 17 ONLY. NEVER APPLY TO HOSTED.
-- Mirrors known legacy tenant-scoped constraints; it is NOT a production dump.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA t404_v19817;
SET search_path=t404_v19817,pg_catalog;
CREATE TABLE tenants (id uuid PRIMARY KEY);
CREATE TABLE products (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
 sku text NOT NULL, price_vnd bigint NOT NULL CHECK(price_vnd>=0),
 stock_on_hand integer NOT NULL CHECK(stock_on_hand>=0),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,sku)
);
CREATE TABLE customers (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
 UNIQUE(tenant_id,id)
);
CREATE TABLE orders (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
 customer_id uuid NOT NULL,
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,customer_id) REFERENCES customers(tenant_id,id)
);
CREATE TABLE order_items (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
 order_id uuid NOT NULL, product_id uuid NOT NULL,
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
CREATE TABLE conversations (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 UNIQUE(tenant_id,id)
);
CREATE TABLE messages (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,conversation_id uuid NOT NULL,
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES conversations(tenant_id,id)
);
-- Deliberate compatibility lane: represents old single-store DEMO, not a Commerce writer.
CREATE SCHEMA t404_v19817_legacy;
CREATE TABLE t404_v19817_legacy.products(tenant_id uuid NOT NULL, sku text NOT NULL,
 price_vnd bigint NOT NULL, PRIMARY KEY(tenant_id,sku));
CREATE FUNCTION t404_v19817_legacy.save_product(p_tenant uuid,p_sku text,p_price bigint)
RETURNS void LANGUAGE sql AS $f$
 INSERT INTO t404_v19817_legacy.products(tenant_id,sku,price_vnd)
 VALUES (p_tenant,p_sku,p_price)
 ON CONFLICT(tenant_id,sku) DO UPDATE SET price_vnd=excluded.price_vnd
$f$;
CREATE TABLE t404_v19817_legacy.function_hash(checksum text NOT NULL);
INSERT INTO t404_v19817_legacy.function_hash
SELECT md5(pg_get_functiondef('t404_v19817_legacy.save_product(uuid,text,bigint)'::regprocedure));

INSERT INTO tenants VALUES ('00000000-0000-0000-0000-000000000101');
INSERT INTO customers VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101');
INSERT INTO products VALUES ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','F01',159000,5);
INSERT INTO orders VALUES ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000001');
INSERT INTO order_items VALUES ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
INSERT INTO conversations VALUES ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101');
INSERT INTO messages VALUES ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','50000000-0000-0000-0000-000000000001');
SELECT t404_v19817_legacy.save_product('00000000-0000-0000-0000-000000000101','F01',159000);

-- MIGRATION DRILL begins: all mapping values are explicit synthetic fixture decisions.
CREATE TABLE stores (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 store_key text NOT NULL,active boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,store_key)
);
CREATE TABLE store_memberships (
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','staff')),active boolean NOT NULL,
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES stores(tenant_id,id)
);
INSERT INTO stores VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000101','A',true),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000101','B',true);
INSERT INTO store_memberships VALUES
 ('00000000-0000-0000-0000-000000000101','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-0000-0000-0000-000000000001','owner',true),
 ('00000000-0000-0000-0000-000000000101','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-0000-0000-0000-000000000002','owner',true);
-- Start nullable, simulate explicit verified backfill for synthetic historical rows only.
ALTER TABLE products ADD COLUMN store_id uuid;
ALTER TABLE customers ADD COLUMN store_id uuid;
ALTER TABLE orders ADD COLUMN store_id uuid;
ALTER TABLE order_items ADD COLUMN store_id uuid;
ALTER TABLE conversations ADD COLUMN store_id uuid;
ALTER TABLE messages ADD COLUMN store_id uuid;
UPDATE products SET store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
UPDATE customers SET store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
UPDATE orders SET store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
UPDATE order_items SET store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
UPDATE conversations SET store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
UPDATE messages SET store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Crucial: NOT NULL BEFORE composite FKs, avoiding MATCH SIMPLE null bypass.
ALTER TABLE products ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE products ADD CONSTRAINT products_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES stores(tenant_id,id);
ALTER TABLE customers ADD CONSTRAINT customers_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES stores(tenant_id,id);
ALTER TABLE orders ADD CONSTRAINT orders_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES stores(tenant_id,id);
ALTER TABLE order_items ADD CONSTRAINT order_items_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES stores(tenant_id,id);
ALTER TABLE conversations ADD CONSTRAINT conversations_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES stores(tenant_id,id);
ALTER TABLE messages ADD CONSTRAINT messages_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES stores(tenant_id,id);
ALTER TABLE products ADD CONSTRAINT products_tenant_store_id_unique UNIQUE(tenant_id,store_id,id);
ALTER TABLE customers ADD CONSTRAINT customers_tenant_store_id_unique UNIQUE(tenant_id,store_id,id);
ALTER TABLE orders ADD CONSTRAINT orders_tenant_store_id_unique UNIQUE(tenant_id,store_id,id);
ALTER TABLE conversations ADD CONSTRAINT conversations_tenant_store_id_unique UNIQUE(tenant_id,store_id,id);
ALTER TABLE orders ADD CONSTRAINT orders_customer_same_store_fk
 FOREIGN KEY(tenant_id,store_id,customer_id) REFERENCES customers(tenant_id,store_id,id);
ALTER TABLE order_items ADD CONSTRAINT items_order_same_store_fk
 FOREIGN KEY(tenant_id,store_id,order_id) REFERENCES orders(tenant_id,store_id,id);
ALTER TABLE order_items ADD CONSTRAINT items_product_same_store_fk
 FOREIGN KEY(tenant_id,store_id,product_id) REFERENCES products(tenant_id,store_id,id);
ALTER TABLE messages ADD CONSTRAINT messages_conversation_same_store_fk
 FOREIGN KEY(tenant_id,store_id,conversation_id) REFERENCES conversations(tenant_id,store_id,id);
ALTER TABLE products DROP CONSTRAINT products_tenant_id_sku_key;
ALTER TABLE products ADD CONSTRAINT products_tenant_store_sku_key UNIQUE(tenant_id,store_id,sku);

-- Store B: same SKU allowed at a different price and stock.
INSERT INTO products(id,tenant_id,store_id,sku,price_vnd,stock_on_hand)
 VALUES('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','F01',189000,9);
INSERT INTO customers(id,tenant_id,store_id)
 VALUES('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
INSERT INTO orders(id,tenant_id,store_id,customer_id)
 VALUES('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','10000000-0000-0000-0000-000000000002');
INSERT INTO order_items(id,tenant_id,store_id,order_id,product_id)
 VALUES('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002');
INSERT INTO conversations VALUES('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
INSERT INTO messages VALUES('60000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000101','50000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Test helpers catch only integrity error codes; unexpected SQL failure aborts CI.
CREATE FUNCTION test_rejected(p_sql text,p_label text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
 EXECUTE p_sql;
 RAISE EXCEPTION 'UNEXPECTED_ACCEPTANCE: %',p_label;
EXCEPTION
 WHEN foreign_key_violation OR not_null_violation OR unique_violation THEN
   RAISE NOTICE 'PASS_DENY_%',p_label;
END $f$;
SELECT test_rejected($q$INSERT INTO order_items VALUES
 ('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000101',
 '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$q$,'ITEM_CROSS_STORE_PRODUCT');
SELECT test_rejected($q$INSERT INTO order_items VALUES
 ('40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000101',
 '30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$q$,'ITEM_CROSS_STORE_ORDER');
SELECT test_rejected($q$INSERT INTO orders(id,tenant_id,customer_id,store_id) VALUES
 ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000101',
 '10000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$q$,'ORDER_CROSS_STORE_CUSTOMER');
SELECT test_rejected($q$INSERT INTO messages VALUES
 ('60000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000101',
 '50000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$q$,'MESSAGE_CROSS_STORE_CONVERSATION');
SELECT test_rejected($q$INSERT INTO products(id,tenant_id,sku,price_vnd,stock_on_hand) VALUES
 ('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000101','NO_STORE',1,0)$q$,'LEGACY_CANONICAL_INSERT_WITHOUT_STORE');
SELECT test_rejected($q$INSERT INTO products(id,tenant_id,store_id,sku,price_vnd,stock_on_hand) VALUES
 ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000101',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01',1,0)$q$,'SAME_STORE_DUPLICATE_SKU');

-- Existing fixture owner authority: fail closed after revocation.
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores FORCE ROW LEVEL SECURITY;
ALTER TABLE store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
-- No policies or API grants: this drill evaluates integrity, NOT runtime RLS/JWT acceptance.
DO $d$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM products WHERE sku='F01';
 IF n<>2 THEN RAISE EXCEPTION 'TWO_STORE_SKU_FAILED'; END IF;
 IF (SELECT price_vnd FROM products WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')<>159000
 OR (SELECT price_vnd FROM products WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')<>189000 THEN
 RAISE EXCEPTION 'PRICE_ISOLATION_FAILED'; END IF;
 IF (SELECT count(*) FROM order_items)<>2 OR (SELECT count(*) FROM messages)<>2
 THEN RAISE EXCEPTION 'LEGACY_ROWS_LOST'; END IF;
 IF (SELECT md5(pg_get_functiondef('t404_v19817_legacy.save_product(uuid,text,bigint)'::regprocedure)))
 <> (SELECT checksum FROM t404_v19817_legacy.function_hash) THEN
 RAISE EXCEPTION 'LEGACY_WRITER_FUNCTION_CHANGED'; END IF;
 IF (SELECT price_vnd FROM t404_v19817_legacy.products WHERE sku='F01')<>159000 THEN
 RAISE EXCEPTION 'LEGACY_DEMO_DATA_CHANGED'; END IF;
 RAISE NOTICE 'PASS_MIGRATION_ALL_SIX_TABLES_COMPOSITE_FK_AND_LEGACY_HASH';
END $d$;
COMMIT;
-- Demo compatibility after migration remains distinct and writable in its own lane:
SELECT t404_v19817_legacy.save_product('00000000-0000-0000-0000-000000000101','F02',100000);
DO $d$
BEGIN
 IF (SELECT price_vnd FROM t404_v19817_legacy.products WHERE sku='F02')<>100000
 THEN RAISE EXCEPTION 'LEGACY_WRITER_BROKEN'; END IF;
 RAISE NOTICE 'PASS_LEGACY_DEMO_WRITER_UNCHANGED';
END $d$;
