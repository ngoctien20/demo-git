-- TIEN404 V15 Sales Lite P0-C — ISOLATED PG17 EXPAND / ROLLBACK REHEARSAL
-- SYNTHETIC DISPOSABLE DATABASE ONLY, NEVER execute on Supabase hosted.
-- No real IDs, no customers, no credentials, no outgoing API/network calls.
-- This is a migration-design experiment, NOT owner-approved application SQL.
\set ON_ERROR_STOP on

-- CHECKPOINT BEFORE: represent the existing tenant-only Commerce architecture.
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE SCHEMA p0c;
GRANT USAGE ON SCHEMA auth,p0c TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;

CREATE TABLE p0c.tenants(id uuid PRIMARY KEY);
CREATE TABLE p0c.tenant_memberships(
 tenant_id uuid NOT NULL REFERENCES p0c.tenants(id),
 user_id uuid NOT NULL,role text NOT NULL, active boolean NOT NULL,
 PRIMARY KEY(tenant_id,user_id));
CREATE TABLE p0c.products(
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES p0c.tenants(id),
 sku text NOT NULL,price_vnd bigint NOT NULL CHECK(price_vnd>=0),
 stock_on_hand integer NOT NULL CHECK(stock_on_hand>=0),
 UNIQUE(tenant_id,id),CONSTRAINT products_tenant_sku UNIQUE(tenant_id,sku));
CREATE TABLE p0c.orders(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES p0c.tenants(id),
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),status text NOT NULL,
 UNIQUE(tenant_id,id));

ALTER TABLE p0c.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE p0c.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE p0c.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE p0c.tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE p0c.products FORCE ROW LEVEL SECURITY;
ALTER TABLE p0c.orders FORCE ROW LEVEL SECURITY;
GRANT SELECT ON p0c.tenant_memberships,p0c.products,p0c.orders TO authenticated;
CREATE POLICY tm_read ON p0c.tenant_memberships FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) AND active);
CREATE POLICY products_legacy_tenant_read ON p0c.products
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM p0c.tenant_memberships m
  WHERE m.tenant_id=products.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.active));
CREATE POLICY orders_legacy_tenant_read ON p0c.orders
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM p0c.tenant_memberships m
  WHERE m.tenant_id=orders.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.active));

INSERT INTO p0c.tenants VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
INSERT INTO p0c.tenant_memberships VALUES
 ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','owner',true),
 ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','owner',true),
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','owner',true);
INSERT INTO p0c.products VALUES
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','A001',159000,5),
 ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','A001',219000,9);
INSERT INTO p0c.orders VALUES
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',159000,'pending'),
 ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',219000,'pending');

-- Negative baseline: Both A and B currently see tenant-one legacy row.
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM p0c.products) <> 1 THEN RAISE EXCEPTION 'BASELINE_A_NOT_TENANT_SCOPED'; END IF;
END $$;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF (SELECT count(*) FROM p0c.products) <> 1 THEN RAISE EXCEPTION 'BASELINE_B_NOT_TENANT_SCOPED'; END IF;
END $$;
RESET ROLE;

-- MIGRATION REHEARSAL: one transaction on a disposable DB. ROLLBACK AT END.
BEGIN;
CREATE TABLE p0c.stores(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES p0c.tenants(id),
 status text NOT NULL CHECK(status IN('draft','active','paused','revoked')),
 CONSTRAINT stores_tenant_id_id_key UNIQUE(tenant_id,id));
CREATE TABLE p0c.store_memberships(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN('owner','manager','staff')),
 active boolean NOT NULL,
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES p0c.stores(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES p0c.tenant_memberships(tenant_id,user_id));
ALTER TABLE p0c.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE p0c.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE p0c.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE p0c.store_memberships FORCE ROW LEVEL SECURITY;
GRANT SELECT ON p0c.stores,p0c.store_memberships TO authenticated;
CREATE POLICY store_member_self ON p0c.store_memberships FOR SELECT TO authenticated USING(
 user_id=(SELECT auth.uid()) AND active
 AND EXISTS(SELECT 1 FROM p0c.tenant_memberships tm
 WHERE tm.tenant_id=store_memberships.tenant_id
 AND tm.user_id=(SELECT auth.uid()) AND tm.active));
CREATE POLICY store_read ON p0c.stores FOR SELECT TO authenticated USING(
 status='active' AND EXISTS(SELECT 1 FROM p0c.store_memberships sm
 WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.id
 AND sm.user_id=(SELECT auth.uid()) AND sm.active));

ALTER TABLE p0c.products ADD COLUMN store_id uuid;
ALTER TABLE p0c.orders ADD COLUMN store_id uuid;
ALTER TABLE p0c.products ADD CONSTRAINT products_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES p0c.stores(tenant_id,id) NOT VALID;
ALTER TABLE p0c.orders ADD CONSTRAINT orders_tenant_store_fk
 FOREIGN KEY(tenant_id,store_id) REFERENCES p0c.stores(tenant_id,id) NOT VALID;
ALTER TABLE p0c.products ADD CONSTRAINT products_tenant_store_id_key UNIQUE(tenant_id,store_id,id);
ALTER TABLE p0c.orders ADD CONSTRAINT orders_tenant_store_id_key UNIQUE(tenant_id,store_id,id);
ALTER TABLE p0c.products DROP CONSTRAINT products_tenant_sku;
ALTER TABLE p0c.products ADD CONSTRAINT products_store_sku UNIQUE(tenant_id,store_id,sku);

-- Store-scoped restrictive policy intersects the old permissive Tenant policy.
-- Hence legacy store_id=NULL records fail closed without any automatic backfill.
CREATE POLICY products_store_scope ON p0c.products AS RESTRICTIVE FOR SELECT TO authenticated USING(
 store_id IS NOT NULL AND EXISTS(
  SELECT 1 FROM p0c.store_memberships sm
  JOIN p0c.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id
  WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
  AND sm.user_id=(SELECT auth.uid()) AND sm.active AND s.status='active'));
CREATE POLICY orders_store_scope ON p0c.orders AS RESTRICTIVE FOR SELECT TO authenticated USING(
 store_id IS NOT NULL AND EXISTS(
  SELECT 1 FROM p0c.store_memberships sm
  JOIN p0c.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id
  WHERE sm.tenant_id=orders.tenant_id AND sm.store_id=orders.store_id
  AND sm.user_id=(SELECT auth.uid()) AND sm.active AND s.status='active'));

-- In real deployment direct writes remain disabled until another approved cutover.
-- These policy-only tests do not grant INSERT/UPDATE to authenticated.

-- A/B same Tenant, C separate Tenant: all are fake and authorized only in rehearsal.
INSERT INTO p0c.stores VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','active');
INSERT INTO p0c.store_memberships VALUES
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','owner',true),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','owner',true),
 ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','owner',true);
-- Legacy rows remain NULL store_id; new fake QA rows get explicit store IDs.
INSERT INTO p0c.products(id,tenant_id,sku,price_vnd,stock_on_hand,store_id) VALUES
 ('30000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','A001',159000,5,'10000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','A001',199000,8,'10000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000002','A001',219000,9,'10000000-0000-0000-0000-000000000003');
INSERT INTO p0c.orders(id,tenant_id,total_vnd,status,store_id) VALUES
 ('40000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',159000,'pending','10000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001',199000,'pending','10000000-0000-0000-0000-000000000002');

-- Auth A sees only A. Neither B nor unassigned legacy is exposed.
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM p0c.products) <> 1 THEN RAISE EXCEPTION 'A_CROSS_STORE_PRODUCT_READ'; END IF;
 IF (SELECT min(price_vnd) FROM p0c.products) <> 159000 THEN RAISE EXCEPTION 'A_WRONG_PRICE'; END IF;
 IF (SELECT count(*) FROM p0c.orders) <> 1 THEN RAISE EXCEPTION 'A_CROSS_STORE_ORDER_READ'; END IF;
 IF (SELECT count(*) FROM p0c.stores) <> 1 THEN RAISE EXCEPTION 'A_STORE_MEMBERSHIP_LEAK'; END IF;
END $$;
SET app.untrusted_store_id='10000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF (SELECT count(*) FROM p0c.products WHERE store_id='10000000-0000-0000-0000-000000000002') <> 0
 THEN RAISE EXCEPTION 'CLIENT_STORE_CLAIM_ESCALATION'; END IF;
END $$;
RESET ROLE;

-- Same tenant B sees only B with a different price for the SAME SKU.
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF (SELECT count(*) FROM p0c.products) <> 1 THEN RAISE EXCEPTION 'B_CROSS_STORE_PRODUCT_READ'; END IF;
 IF (SELECT min(price_vnd) FROM p0c.products) <> 199000 THEN RAISE EXCEPTION 'B_WRONG_PRICE'; END IF;
 IF (SELECT count(*) FROM p0c.orders) <> 1 THEN RAISE EXCEPTION 'B_CROSS_STORE_ORDER_READ'; END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000003';
DO $$ BEGIN
 IF (SELECT count(*) FROM p0c.products) <> 1 THEN RAISE EXCEPTION 'C_TENANT_CROSS_READ'; END IF;
 IF (SELECT min(price_vnd) FROM p0c.products) <> 219000 THEN RAISE EXCEPTION 'C_WRONG_PRICE'; END IF;
 IF (SELECT count(*) FROM p0c.orders) <> 0 THEN RAISE EXCEPTION 'C_ORDER_LEAK'; END IF;
END $$;
RESET ROLE;

-- Anonymous user must not access products even with a schema read attempt.
SET ROLE anon;
DO $$ DECLARE denied boolean := false; BEGIN
 BEGIN
   PERFORM 1 FROM p0c.products;
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'ANON_READ_NOT_DENIED'; END IF;
END $$;
RESET ROLE;

-- No bypass by attempting a direct INSERT into products.
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
DO $$ DECLARE denied boolean := false; BEGIN
 BEGIN
 INSERT INTO p0c.products(id,tenant_id,store_id,sku,price_vnd,stock_on_hand)
 VALUES('30000000-0000-0000-0000-000000000051',
 '00000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000002','MAL',1,1);
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'HOSTED_WRITES_UNLOCKED_IN_EXPAND'; END IF;
END $$;
RESET ROLE;

-- Revoke A membership: tenant membership alone no longer suffices.
UPDATE p0c.store_memberships SET active=false
 WHERE store_id='10000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM p0c.products) <> 0 THEN RAISE EXCEPTION 'REVOKED_MEMBER_READS_PRODUCTS'; END IF;
 IF (SELECT count(*) FROM p0c.orders) <> 0 THEN RAISE EXCEPTION 'REVOKED_MEMBER_READS_ORDERS'; END IF;
END $$;
RESET ROLE;

-- Paused Store B is blocked even while Store membership stays active.
UPDATE p0c.stores SET status='paused'
 WHERE id='10000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000002';
DO $$ BEGIN
 IF (SELECT count(*) FROM p0c.products) <> 0 THEN RAISE EXCEPTION 'PAUSED_STORE_PRODUCTS_VISIBLE'; END IF;
END $$;
RESET ROLE;

-- Exact data provenance: old rows remain in place unassigned, NEVER backfilled.
DO $$ BEGIN
 IF (SELECT count(*) FROM p0c.products WHERE store_id IS NULL) <> 2 THEN
  RAISE EXCEPTION 'LEGACY_PRODUCTS_AUTO_BACKFILLED'; END IF;
 IF (SELECT count(*) FROM p0c.orders WHERE store_id IS NULL) <> 2 THEN
  RAISE EXCEPTION 'LEGACY_ORDERS_AUTO_BACKFILLED'; END IF;
END $$;

-- Roll back the entire synthetic expansion. This proves transactional DDL only.
ROLLBACK;

-- POST-ROLLBACK: original legacy rows/constraints/policies are restored.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.tables
           WHERE table_schema='p0c' AND table_name IN('stores','store_memberships')) THEN
  RAISE EXCEPTION 'ROLLBACK_LEFT_STORE_TABLE'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns
           WHERE table_schema='p0c' AND table_name IN('products','orders')
             AND column_name='store_id') THEN
  RAISE EXCEPTION 'ROLLBACK_LEFT_STORE_ID'; END IF;
 IF (SELECT count(*) FROM p0c.products) <> 2 OR (SELECT count(*) FROM p0c.orders) <> 2 THEN
  RAISE EXCEPTION 'ROLLBACK_LOST_LEGACY_ROWS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='p0c.products'::regclass
   AND conname='products_tenant_sku') THEN
  RAISE EXCEPTION 'ROLLBACK_LOST_ORIGINAL_SKU_UNIQUE'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies
  WHERE schemaname='p0c' AND policyname IN('products_store_scope','orders_store_scope')) THEN
  RAISE EXCEPTION 'ROLLBACK_LEFT_STORE_RLS'; END IF;
END $$;
SELECT 'PASS_DISPOSABLE_PG17_P0C_EXPAND_AND_ROLLBACK_NOT_HOSTED' AS result;
