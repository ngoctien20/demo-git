-- TIEN404 V15 Sales Lite P0 — disposable PostgreSQL 17 QA ONLY
-- NEVER run against Supabase hosted; synthetic UUIDs, no customer data/credentials.
\set ON_ERROR_STOP on
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE SCHEMA qa_p0;
GRANT USAGE ON SCHEMA auth,qa_p0 TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;

CREATE TABLE qa_p0.tenants(id uuid PRIMARY KEY);
CREATE TABLE qa_p0.tenant_memberships(
  tenant_id uuid NOT NULL REFERENCES qa_p0.tenants(id),
  user_id uuid NOT NULL, role text NOT NULL CHECK(role IN('owner','manager','staff')),
  active boolean NOT NULL, PRIMARY KEY(tenant_id,user_id));
CREATE TABLE qa_p0.stores(
  id uuid NOT NULL, tenant_id uuid NOT NULL REFERENCES qa_p0.tenants(id),
  status text NOT NULL CHECK(status IN('active','paused','revoked')),
  PRIMARY KEY(id), UNIQUE(tenant_id,id));
CREATE TABLE qa_p0.store_memberships(
  tenant_id uuid NOT NULL,store_id uuid NOT NULL,user_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN('owner','manager','staff')),
  active boolean NOT NULL,
  PRIMARY KEY(tenant_id,store_id,user_id),
  FOREIGN KEY(tenant_id,store_id) REFERENCES qa_p0.stores(tenant_id,id),
  FOREIGN KEY(tenant_id,user_id) REFERENCES qa_p0.tenant_memberships(tenant_id,user_id));
CREATE TABLE qa_p0.products(
  id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES qa_p0.tenants(id),
  store_id uuid,sku text NOT NULL,price_vnd bigint NOT NULL CHECK(price_vnd>=0),
  stock integer NOT NULL CHECK(stock>=0),
  UNIQUE(tenant_id,store_id,id),UNIQUE(tenant_id,store_id,sku),
  FOREIGN KEY(tenant_id,store_id) REFERENCES qa_p0.stores(tenant_id,id));
CREATE TABLE qa_p0.orders(
  id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES qa_p0.tenants(id),
  store_id uuid,total_vnd bigint NOT NULL CHECK(total_vnd>=0),
  UNIQUE(tenant_id,store_id,id),
  FOREIGN KEY(tenant_id,store_id) REFERENCES qa_p0.stores(tenant_id,id));
CREATE TABLE qa_p0.order_items(
  id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
  order_id uuid NOT NULL,product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK(quantity>0),unit_price_vnd bigint NOT NULL,
  FOREIGN KEY(tenant_id,store_id,order_id) REFERENCES qa_p0.orders(tenant_id,store_id,id),
  FOREIGN KEY(tenant_id,store_id,product_id) REFERENCES qa_p0.products(tenant_id,store_id,id));
CREATE TABLE qa_p0.replay_inbox(
  tenant_id uuid NOT NULL,store_id uuid NOT NULL,event_key text NOT NULL,
  PRIMARY KEY(tenant_id,store_id,event_key),
  FOREIGN KEY(tenant_id,store_id) REFERENCES qa_p0.stores(tenant_id,id));

ALTER TABLE qa_p0.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.products FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.order_items FORCE ROW LEVEL SECURITY;

GRANT SELECT ON qa_p0.tenant_memberships,qa_p0.store_memberships,qa_p0.stores,qa_p0.products,qa_p0.orders TO authenticated;
GRANT INSERT,UPDATE ON qa_p0.products TO authenticated;
GRANT SELECT ON qa_p0.products TO anon;

CREATE POLICY membership_self ON qa_p0.tenant_memberships FOR SELECT TO authenticated
  USING(user_id=(SELECT auth.uid()) AND active);
CREATE POLICY store_membership_self ON qa_p0.store_memberships FOR SELECT TO authenticated
  USING(user_id=(SELECT auth.uid()) AND active AND EXISTS(
    SELECT 1 FROM qa_p0.tenant_memberships m
    WHERE m.tenant_id=store_memberships.tenant_id
      AND m.user_id=(SELECT auth.uid()) AND m.active));
CREATE POLICY stores_member_read ON qa_p0.stores FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM qa_p0.store_memberships m
     WHERE m.store_id=stores.id AND m.tenant_id=stores.tenant_id
     AND m.user_id=(SELECT auth.uid()) AND m.active)
  AND status='active');

-- Legacy tenant-wide permissive policy is intentionally retained to prove
-- that a RESTRICTIVE Store policy narrows it instead of silently allowing B.
CREATE POLICY products_tenant_read ON qa_p0.products FOR SELECT TO authenticated USING(
  EXISTS(SELECT 1 FROM qa_p0.tenant_memberships m
    WHERE m.tenant_id=products.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.active));
CREATE POLICY products_store_restrict ON qa_p0.products AS RESTRICTIVE FOR SELECT TO authenticated USING(
  store_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM qa_p0.store_memberships m
    JOIN qa_p0.stores s ON s.id=m.store_id AND s.tenant_id=m.tenant_id
    WHERE m.tenant_id=products.tenant_id AND m.store_id=products.store_id
      AND m.user_id=(SELECT auth.uid()) AND m.active AND s.status='active'));
CREATE POLICY products_insert_same_store ON qa_p0.products FOR INSERT TO authenticated WITH CHECK(
  store_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM qa_p0.store_memberships m
    JOIN qa_p0.stores s ON s.id=m.store_id AND s.tenant_id=m.tenant_id
    WHERE m.tenant_id=products.tenant_id AND m.store_id=products.store_id
      AND m.user_id=(SELECT auth.uid()) AND m.active AND m.role IN ('owner','manager')
      AND s.status='active'));
CREATE POLICY products_update_same_store ON qa_p0.products FOR UPDATE TO authenticated USING(
  store_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM qa_p0.store_memberships m
    WHERE m.tenant_id=products.tenant_id AND m.store_id=products.store_id
      AND m.user_id=(SELECT auth.uid()) AND m.active AND m.role IN ('owner','manager')))
  WITH CHECK(store_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM qa_p0.store_memberships m
    WHERE m.tenant_id=products.tenant_id AND m.store_id=products.store_id
      AND m.user_id=(SELECT auth.uid()) AND m.active AND m.role IN('owner','manager')));

CREATE POLICY orders_tenant_read ON qa_p0.orders FOR SELECT TO authenticated USING(
  EXISTS(SELECT 1 FROM qa_p0.tenant_memberships m
    WHERE m.tenant_id=orders.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.active));
CREATE POLICY orders_store_restrict ON qa_p0.orders AS RESTRICTIVE FOR SELECT TO authenticated USING(
  store_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM qa_p0.store_memberships m
    JOIN qa_p0.stores s ON s.id=m.store_id AND s.tenant_id=m.tenant_id
    WHERE m.tenant_id=orders.tenant_id AND m.store_id=orders.store_id
      AND m.user_id=(SELECT auth.uid()) AND m.active AND s.status='active'));

-- Synthetic fixture UUIDs
INSERT INTO qa_p0.tenants(id) VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
INSERT INTO qa_p0.tenant_memberships VALUES
 ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','owner',true),
 ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','owner',true),
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','owner',true);
INSERT INTO qa_p0.stores VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','active');
INSERT INTO qa_p0.store_memberships VALUES
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','owner',true),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','owner',true),
 ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','owner',true);
INSERT INTO qa_p0.products VALUES
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A002',159000,5),
 ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','A002',199000,7),
 ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','A002',219000,9),
 ('30000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001',NULL,'LEGACY',100000,3);
INSERT INTO qa_p0.orders VALUES
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',159000),
 ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',199000),
 ('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',NULL,500000);

-- OWNER A in tenant 1: must see only Store A, not B or unassigned legacy.
SET ROLE authenticated;
SET request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
DO $test$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products) <> 1 THEN RAISE EXCEPTION 'STORE_A_PRODUCTS_LEAK'; END IF;
 IF (SELECT min(price_vnd) FROM qa_p0.products) <> 159000 THEN RAISE EXCEPTION 'STORE_A_WRONG_PRICE'; END IF;
 IF (SELECT count(*) FROM qa_p0.orders) <> 1 THEN RAISE EXCEPTION 'STORE_A_ORDERS_LEAK'; END IF;
 IF (SELECT count(*) FROM qa_p0.stores) <> 1 THEN RAISE EXCEPTION 'STORE_A_OWNERSHIP_LEAK'; END IF;
END $test$;
-- Client-side store claim cannot grant B access.
SET app.untrusted_store_id = '10000000-0000-0000-0000-000000000002';
DO $test$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products WHERE store_id='10000000-0000-0000-0000-000000000002') <> 0
 THEN RAISE EXCEPTION 'CLIENT_STORE_SPOOF_ALLOWED'; END IF;
END $test$;
-- No cross-store insert even when owner A has a tenant-wide membership.
DO $test$ DECLARE rejected boolean:=false; BEGIN
 BEGIN
   INSERT INTO qa_p0.products VALUES('30000000-0000-0000-0000-000000000055',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002','SPOOF',1,1);
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'STORE_B_INSERT_ALLOWED_BY_A'; END IF;
END $test$;
-- Moving an authorized product to another store must fail its WITH CHECK.
DO $test$ DECLARE rejected boolean:=false; BEGIN
 BEGIN
   UPDATE qa_p0.products SET store_id='10000000-0000-0000-0000-000000000002'
   WHERE id='30000000-0000-0000-0000-000000000001';
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'CROSS_STORE_PRODUCT_REASSIGN_ALLOWED'; END IF;
END $test$;
-- UPDATE invisible B product must affect 0 rows.
DO $test$ DECLARE n integer; BEGIN
 UPDATE qa_p0.products SET price_vnd=123 WHERE id='30000000-0000-0000-0000-000000000002';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 0 THEN RAISE EXCEPTION 'B_PRODUCT_UPDATED_BY_A'; END IF;
END $test$;
RESET ROLE;

-- OWNER B belongs to same Tenant but is isolated from Shop A.
SET ROLE authenticated;
SET request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
DO $test$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products) <> 1 THEN RAISE EXCEPTION 'STORE_B_PRODUCTS_LEAK'; END IF;
 IF (SELECT min(price_vnd) FROM qa_p0.products) <> 199000 THEN RAISE EXCEPTION 'STORE_B_WRONG_PRICE'; END IF;
 IF (SELECT count(*) FROM qa_p0.orders) <> 1 THEN RAISE EXCEPTION 'STORE_B_ORDERS_LEAK'; END IF;
END $test$;
RESET ROLE;

-- OWNER C belongs to separate Tenant.
SET ROLE authenticated;
SET request.jwt.claim.sub = '20000000-0000-0000-0000-000000000003';
DO $test$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products) <> 1 THEN RAISE EXCEPTION 'STORE_C_PRODUCTS_LEAK'; END IF;
 IF (SELECT min(price_vnd) FROM qa_p0.products) <> 219000 THEN RAISE EXCEPTION 'STORE_C_WRONG_PRICE'; END IF;
 IF (SELECT count(*) FROM qa_p0.orders) <> 0 THEN RAISE EXCEPTION 'STORE_C_ORDERS_LEAK'; END IF;
END $test$;
RESET ROLE;

-- ANON is still unable to SELECT product records, even if SQL GRANT exists.
SET ROLE anon;
DO $test$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products) <> 0 THEN RAISE EXCEPTION 'ANON_PRODUCT_LEAK'; END IF;
END $test$;
RESET ROLE;

-- Revocation, no stale membership fallback.
UPDATE qa_p0.store_memberships SET active=false
 WHERE store_id='10000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
DO $test$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products) <> 0 THEN RAISE EXCEPTION 'REVOKED_OWNER_STILL_READS'; END IF;
END $test$;
RESET ROLE;
UPDATE qa_p0.store_memberships SET active=true
 WHERE store_id='10000000-0000-0000-0000-000000000001';

-- Foreign keys pin (tenant,store) for both Order and Product in order_items.
INSERT INTO qa_p0.order_items VALUES
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',1,159000);
DO $test$ DECLARE rejected boolean:=false; BEGIN
 BEGIN
   INSERT INTO qa_p0.order_items VALUES
    ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000002',1,199000);
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'CROSS_STORE_ORDER_ITEM_FK_ALLOWED'; END IF;
END $test$;

INSERT INTO qa_p0.replay_inbox VALUES('00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','provider-mid-1');
INSERT INTO qa_p0.replay_inbox VALUES('00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','provider-mid-1') ON CONFLICT DO NOTHING;
DO $test$ BEGIN
 IF (SELECT count(*) FROM qa_p0.replay_inbox)<>1 THEN RAISE EXCEPTION 'DUPLICATE_REPLAY_ACCEPTED'; END IF;
END $test$;

-- Synthetic atomic Order + Outbox transactional contract.
-- These tables are private in this disposable test: zero authenticated grants.
CREATE TABLE qa_p0.owner_outbox(
  tenant_id uuid NOT NULL,store_id uuid NOT NULL,order_id uuid NOT NULL,
  provider_event_key text NOT NULL,status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','sent','failed')),
  PRIMARY KEY(tenant_id,store_id,provider_event_key),
  FOREIGN KEY(tenant_id,store_id,order_id) REFERENCES qa_p0.orders(tenant_id,store_id,id));
ALTER TABLE qa_p0.owner_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.owner_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.replay_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0.replay_inbox FORCE ROW LEVEL SECURITY;

-- In the disposable DB only, simulate one backend-authorized transaction.
-- It writes Order pending + Item + consumed event + Outbox pending together.
-- It does NOT send a provider message or decrement stock.
BEGIN;
INSERT INTO qa_p0.orders VALUES
 ('40000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',318000);
INSERT INTO qa_p0.order_items VALUES
 ('50000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000009',
  '30000000-0000-0000-0000-000000000001',2,159000);
INSERT INTO qa_p0.replay_inbox VALUES
 ('00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','messenger:page_A:mid_009');
INSERT INTO qa_p0.owner_outbox VALUES
 ('00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000009',
  'messenger:page_A:mid_009','pending');
COMMIT;
DO $tx$ BEGIN
 IF (SELECT count(*) FROM qa_p0.owner_outbox WHERE status='pending')<>1
 THEN RAISE EXCEPTION 'ATOMIC_OUTBOX_NOT_PREPARED'; END IF;
 IF (SELECT count(*) FROM qa_p0.orders WHERE id='40000000-0000-0000-0000-000000000009')<>1
 THEN RAISE EXCEPTION 'ATOMIC_ORDER_NOT_SAVED'; END IF;
 IF (SELECT count(*) FROM qa_p0.replay_inbox WHERE event_key='messenger:page_A:mid_009')<>1
 THEN RAISE EXCEPTION 'ATOMIC_REPLAY_MARKER_MISSING'; END IF;
 IF (SELECT stock FROM qa_p0.products WHERE id='30000000-0000-0000-0000-000000000001') IS NOT NULL
 THEN NULL; END IF;
END $tx$;
-- Repeated external event cannot add duplicate Outbox/Replay entry.
INSERT INTO qa_p0.owner_outbox VALUES
 ('00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000009',
  'messenger:page_A:mid_009','pending') ON CONFLICT DO NOTHING;
DO $tx$ BEGIN
 IF (SELECT count(*) FROM qa_p0.owner_outbox)<>1 THEN
  RAISE EXCEPTION 'DUPLICATE_OUTBOX_PER_EVENT'; END IF;
END $tx$;
-- A cross-store notification to the wrong order must fail composite FK;
-- the same failed nested transaction must not leave a partial Order behind.
DO $tx$ DECLARE rejected boolean:=false; BEGIN
 BEGIN
  INSERT INTO qa_p0.orders VALUES
   ('40000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',159000);
  INSERT INTO qa_p0.owner_outbox VALUES
   ('00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000010',
    'messenger:page_A:mid_010','pending');
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
 END;
 IF NOT rejected OR EXISTS(SELECT 1 FROM qa_p0.orders
     WHERE id='40000000-0000-0000-0000-000000000010')
 THEN RAISE EXCEPTION 'PARTIAL_ORDER_OR_WRONG_OWNER_OUTBOX_ALLOWED'; END IF;
END $tx$;
DO $tx$ BEGIN
 IF (SELECT stock FROM qa_p0.products
 WHERE id='30000000-0000-0000-0000-000000000001')<>5
 THEN RAISE EXCEPTION 'UNAPPROVED_STOCK_DEDUCTION'; END IF;
END $tx$;

SELECT 'PASS_DISPOSABLE_POSTGRES17_RLS_ISOLATION_NOT_HOSTED' AS result;
