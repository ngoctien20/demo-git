-- TIEN404 V16.10: DISPOSABLE POSTGRES 17 QA ONLY.
-- THIS IS AN EXECUTABLE TEST FIXTURE, *NOT* A HOSTED MIGRATION.
-- MUST ONLY BE RUN BY run-disposable.sh AGAINST LOCAL EPHEMERAL DATABASE.
DO $guard$
BEGIN
 IF current_database() <> 't404_v1610_disposable'
    OR inet_server_addr() IS DISTINCT FROM inet '127.0.0.1' THEN
   RAISE EXCEPTION 'V1610_DISPOSABLE_LOCAL_DATABASE_ONLY';
 END IF;
END $guard$;
DO $roles$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='t404_authenticated') THEN
  CREATE ROLE t404_authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='t404_anon') THEN
  CREATE ROLE t404_anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
END $roles$;
CREATE SCHEMA qa_auth;
CREATE FUNCTION qa_auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $uid$
 SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$uid$;
GRANT USAGE ON SCHEMA qa_auth TO t404_authenticated;
GRANT EXECUTE ON FUNCTION qa_auth.uid() TO t404_authenticated;
CREATE SCHEMA qa;
GRANT USAGE ON SCHEMA qa TO t404_authenticated;
CREATE TABLE qa.tenants(id uuid PRIMARY KEY,name text NOT NULL);
CREATE TABLE qa.stores(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES qa.tenants(id),
 name text NOT NULL, UNIQUE(tenant_id,id));
CREATE TABLE qa.store_memberships(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 user_id uuid NOT NULL,role text NOT NULL,active boolean NOT NULL,
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY (tenant_id,store_id) REFERENCES qa.stores(tenant_id,id));
CREATE TABLE qa.products(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 sku text NOT NULL,price_vnd bigint NOT NULL CHECK(price_vnd>=0),
 stock integer NOT NULL CHECK(stock>=0),
 UNIQUE(tenant_id,store_id,sku),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa.stores(tenant_id,id));
CREATE TABLE qa.customers(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 label text NOT NULL, UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa.stores(tenant_id,id));
CREATE TABLE qa.orders(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 customer_id uuid NOT NULL,total bigint NOT NULL CHECK(total>=0),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa.stores(tenant_id,id),
 FOREIGN KEY(tenant_id,store_id,customer_id) REFERENCES qa.customers(tenant_id,store_id,id));
ALTER TABLE qa.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY membership_owner_self ON qa.store_memberships
 FOR SELECT TO t404_authenticated USING (user_id = (SELECT qa_auth.uid()));
CREATE POLICY products_view_store ON qa.products FOR SELECT TO t404_authenticated
 USING (EXISTS (
 SELECT 1 FROM qa.store_memberships sm
 WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
 AND sm.user_id=(SELECT qa_auth.uid()) AND sm.active AND sm.role IN ('owner','manager')));
CREATE POLICY products_add_store ON qa.products FOR INSERT TO t404_authenticated
 WITH CHECK (EXISTS (
 SELECT 1 FROM qa.store_memberships sm
 WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
 AND sm.user_id=(SELECT qa_auth.uid()) AND sm.active AND sm.role IN ('owner','manager')));
CREATE POLICY products_update_store ON qa.products FOR UPDATE TO t404_authenticated
 USING (EXISTS (
 SELECT 1 FROM qa.store_memberships sm
 WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
 AND sm.user_id=(SELECT qa_auth.uid()) AND sm.active AND sm.role IN ('owner','manager')))
 WITH CHECK (EXISTS (
 SELECT 1 FROM qa.store_memberships sm
 WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
 AND sm.user_id=(SELECT qa_auth.uid()) AND sm.active AND sm.role IN ('owner','manager')));
CREATE POLICY customers_view_store ON qa.customers FOR SELECT TO t404_authenticated
 USING (EXISTS (
 SELECT 1 FROM qa.store_memberships sm
 WHERE sm.tenant_id=customers.tenant_id AND sm.store_id=customers.store_id
 AND sm.user_id=(SELECT qa_auth.uid()) AND sm.active));
CREATE POLICY orders_view_store ON qa.orders FOR SELECT TO t404_authenticated
 USING (EXISTS (
 SELECT 1 FROM qa.store_memberships sm
 WHERE sm.tenant_id=orders.tenant_id AND sm.store_id=orders.store_id
 AND sm.user_id=(SELECT qa_auth.uid()) AND sm.active));
CREATE POLICY orders_add_store ON qa.orders FOR INSERT TO t404_authenticated
 WITH CHECK (EXISTS (
 SELECT 1 FROM qa.store_memberships sm
 WHERE sm.tenant_id=orders.tenant_id AND sm.store_id=orders.store_id
 AND sm.user_id=(SELECT qa_auth.uid()) AND sm.active AND sm.role='owner'));
GRANT SELECT ON qa.store_memberships TO t404_authenticated;
GRANT SELECT,INSERT,UPDATE ON qa.products TO t404_authenticated;
GRANT SELECT ON qa.customers TO t404_authenticated;
GRANT SELECT,INSERT ON qa.orders TO t404_authenticated;
-- Synthetic fixture IDs only: SAME TENANT A/B; DIFFERENT TENANT C.
INSERT INTO qa.tenants VALUES
 ('00000000-0000-4000-8000-000000000011','QA TENANT 1'),
 ('00000000-0000-4000-8000-000000000022','QA TENANT 2');
INSERT INTO qa.stores VALUES
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000011','QA SHOP A'),
 ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-000000000011','QA SHOP B'),
 ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-000000000022','QA SHOP C');
INSERT INTO qa.store_memberships VALUES
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','10000000-0000-4000-8000-0000000000a1','owner',true),
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000b1','10000000-0000-4000-8000-0000000000b1','owner',true),
 ('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-0000000000c1','10000000-0000-4000-8000-0000000000c1','owner',true);
INSERT INTO qa.products VALUES
 ('20000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','SAME01',159000,12),
 ('20000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000b1','SAME01',209000,7),
 ('20000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-0000000000c1','SAME01',259000,3);
INSERT INTO qa.customers VALUES
 ('30000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','QA CUSTOMER A'),
 ('30000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000b1','QA CUSTOMER B'),
 ('30000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-0000000000c1','QA CUSTOMER C');
INSERT INTO qa.orders VALUES
 ('40000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000a1','30000000-0000-4000-8000-0000000000a1',159000),
 ('40000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-0000000000b1','30000000-0000-4000-8000-0000000000b1',209000),
 ('40000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-0000000000c1','30000000-0000-4000-8000-0000000000c1',259000);
