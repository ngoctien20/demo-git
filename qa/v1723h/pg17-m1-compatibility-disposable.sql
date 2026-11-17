-- V17.23H disposable PostgreSQL 17 M1 compatibility rehearsal, NEVER run on hosted.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE t404_h_member NOLOGIN;
CREATE SCHEMA t404_h;
GRANT USAGE ON SCHEMA t404_h TO t404_h_member;
CREATE TABLE t404_h.products(tenant_id uuid NOT NULL,id uuid NOT NULL,sku text NOT NULL,PRIMARY KEY(id),UNIQUE(tenant_id,id),UNIQUE(tenant_id,sku));
CREATE TABLE t404_h.orders(tenant_id uuid NOT NULL,id uuid NOT NULL,customer_id uuid,status text NOT NULL,PRIMARY KEY(id),UNIQUE(tenant_id,id));
CREATE TABLE t404_h.order_items(tenant_id uuid NOT NULL,order_id uuid NOT NULL,product_id uuid NOT NULL,quantity int NOT NULL,FOREIGN KEY(tenant_id,order_id) REFERENCES t404_h.orders(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES t404_h.products(tenant_id,id));
INSERT INTO t404_h.products VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','SKU-A'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','SKU-B');
INSERT INTO t404_h.orders VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',NULL,'pending'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',NULL,'pending');
INSERT INTO t404_h.order_items VALUES ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1);
-- M1 expand preserves every unknown legacy Store lineage as NULL.
CREATE TABLE t404_h.stores(tenant_id uuid NOT NULL,id uuid NOT NULL,name text NOT NULL,PRIMARY KEY(tenant_id,id));
CREATE TABLE t404_h.store_memberships(tenant_id uuid NOT NULL,store_id uuid NOT NULL,user_id uuid NOT NULL,role text NOT NULL,active boolean NOT NULL,PRIMARY KEY(tenant_id,store_id,user_id),FOREIGN KEY(tenant_id,store_id) REFERENCES t404_h.stores(tenant_id,id));
ALTER TABLE t404_h.products ADD COLUMN store_id uuid;
ALTER TABLE t404_h.orders ADD COLUMN store_id uuid;
ALTER TABLE t404_h.order_items ADD COLUMN store_id uuid;
DO $test$
BEGIN
 IF (SELECT count(*) FROM t404_h.products WHERE store_id IS NULL)<>2 THEN RAISE EXCEPTION 'LEGACY_PRODUCTS_MUTATED'; END IF;
 IF (SELECT count(*) FROM t404_h.orders WHERE store_id IS NULL)<>2 THEN RAISE EXCEPTION 'LEGACY_ORDERS_MUTATED'; END IF;
 IF (SELECT count(*) FROM t404_h.order_items WHERE store_id IS NULL)<>1 THEN RAISE EXCEPTION 'LEGACY_ITEMS_MUTATED'; END IF;
 IF EXISTS(SELECT 1 FROM t404_h.stores) OR EXISTS(SELECT 1 FROM t404_h.store_memberships) THEN RAISE EXCEPTION 'INFERRED_STORE_OWNERSHIP'; END IF;
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='t404_h.order_items'::regclass AND contype='f')<>2 THEN RAISE EXCEPTION 'LEGACY_FK_LOST'; END IF;
END $test$;
-- Synthetic future-M4 candidate: Store A/B in the SAME Tenant, no real owner claims.
INSERT INTO t404_h.stores VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','A'),
('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4','B');
INSERT INTO t404_h.store_memberships VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','owner',true),
('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5','owner',true);
INSERT INTO t404_h.orders(tenant_id,id,status,store_id) VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6','pending','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'),
('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6','pending','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4');
CREATE FUNCTION t404_h.current_actor() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER AS $fn$ SELECT nullif(current_setting('t404_h.test_actor',true),'')::uuid $fn$;
ALTER TABLE t404_h.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_h.orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_permissive ON t404_h.orders FOR SELECT TO t404_h_member USING (tenant_id='11111111-1111-4111-8111-111111111111'::uuid);
ALTER TABLE t404_h.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_h.store_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY active_self ON t404_h.store_memberships FOR SELECT TO t404_h_member USING (active AND user_id=(SELECT t404_h.current_actor()));
CREATE POLICY store_restrictive AS RESTRICTIVE ON t404_h.orders FOR SELECT TO t404_h_member USING (store_id IS NOT NULL AND EXISTS(
 SELECT 1 FROM t404_h.store_memberships m WHERE m.tenant_id=orders.tenant_id AND m.store_id=orders.store_id AND m.user_id=(SELECT t404_h.current_actor()) AND m.active AND m.role IN ('owner','manager')
));
GRANT SELECT ON t404_h.orders,t404_h.store_memberships TO t404_h_member;
GRANT EXECUTE ON FUNCTION t404_h.current_actor() TO t404_h_member;
SET LOCAL ROLE t404_h_member;
DO $check$
DECLARE n int;
BEGIN
 PERFORM set_config('t404_h.test_actor','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',true);
 SELECT count(*) INTO n FROM t404_h.orders; IF n<>1 THEN RAISE EXCEPTION 'A_VISIBLE_%',n; END IF;
 SELECT count(*) INTO n FROM t404_h.orders WHERE store_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'; IF n<>0 THEN RAISE EXCEPTION 'A_READ_B'; END IF;
 PERFORM set_config('t404_h.test_actor','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',true);
 SELECT count(*) INTO n FROM t404_h.orders; IF n<>1 THEN RAISE EXCEPTION 'B_VISIBLE_%',n; END IF;
 SELECT count(*) INTO n FROM t404_h.orders WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'; IF n<>0 THEN RAISE EXCEPTION 'B_READ_A'; END IF;
 PERFORM set_config('t404_h.test_actor','',true);
 SELECT count(*) INTO n FROM t404_h.orders; IF n<>0 THEN RAISE EXCEPTION 'NO_IDENTITY_LEAK'; END IF;
 IF has_table_privilege(current_user,'t404_h.orders','INSERT') OR has_table_privilege(current_user,'t404_h.orders','UPDATE') OR has_table_privilege(current_user,'t404_h.orders','DELETE') THEN RAISE EXCEPTION 'WRITE_PRIVILEGE'; END IF;
END $check$;
RESET ROLE;
ROLLBACK;
DO $rollback$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='t404_h') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='t404_h_member') THEN RAISE EXCEPTION 'ROLLBACK_RESIDUE'; END IF;
END $rollback$;
\echo 'V1723H_DISPOSABLE_PG17_M1_COMPAT_RLS_ROLLBACK_PASS_SYNTHETIC_ONLY'
