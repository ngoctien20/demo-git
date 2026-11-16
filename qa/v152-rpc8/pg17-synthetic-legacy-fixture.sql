-- TIEN404 V15.2 ADV.6C-RPC.8: SYNTHETIC PG17 CI FIXTURE ONLY.
-- NEVER use against Supabase hosted or any actual merchant database.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 't404_rpc8_ci'
    OR current_user <> 'postgres'
    OR current_setting('tien404.rpc8_ephemeral',true) <> 'RPC8_DISPOSABLE'
    OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'RPC8_DISPOSABLE_PG17_ONLY'; END IF;
END $guard$;
CREATE SCHEMA qa_rpc8;
REVOKE ALL ON SCHEMA qa_rpc8 FROM PUBLIC;
CREATE ROLE qa_rpc8_user NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOINHERIT;
GRANT USAGE ON SCHEMA qa_rpc8 TO qa_rpc8_user;
CREATE FUNCTION qa_rpc8.actor_id() RETURNS uuid
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
 AS $fn$SELECT nullif(current_setting('tien404.synthetic_actor',true),'')::uuid$fn$;
REVOKE ALL ON FUNCTION qa_rpc8.actor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_rpc8.actor_id() TO qa_rpc8_user;

CREATE TABLE qa_rpc8.tenants (
 id uuid PRIMARY KEY, code text NOT NULL UNIQUE
);
CREATE TABLE qa_rpc8.tenant_memberships (
 tenant_id uuid NOT NULL REFERENCES qa_rpc8.tenants(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','staff')),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE qa_rpc8.products (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES qa_rpc8.tenants(id) ON DELETE RESTRICT,
 sku text NOT NULL,
 price_vnd bigint NOT NULL CHECK(price_vnd >= 0),
 stock_on_hand integer NOT NULL CHECK(stock_on_hand >= 0),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,sku)
);
CREATE TABLE qa_rpc8.customers (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES qa_rpc8.tenants(id) ON DELETE RESTRICT,
 display_name text NOT NULL,
 UNIQUE(tenant_id,id)
);
CREATE TABLE qa_rpc8.orders (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES qa_rpc8.tenants(id) ON DELETE RESTRICT,
 customer_id uuid NULL,
 status text NOT NULL CHECK(status IN ('pending','confirmed','paid','cancelled','refunded')),
 total_vnd bigint NOT NULL CHECK(total_vnd >= 0),
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,customer_id) REFERENCES qa_rpc8.customers(tenant_id,id) ON DELETE RESTRICT
);
-- All fixture rows are fake and must never be mistaken for Supabase customer data.
INSERT INTO qa_rpc8.tenants VALUES
 ('11111111-1111-4111-8111-111111111111','qa-tenant-a'),
 ('22222222-2222-4222-8222-222222222222','qa-tenant-b');
INSERT INTO qa_rpc8.tenant_memberships VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001','owner',true),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-0000-4000-8000-000000000002','staff',true),
 ('22222222-2222-4222-8222-222222222222','cccccccc-0000-4000-8000-000000000003','owner',true);
INSERT INTO qa_rpc8.products VALUES
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','QA-TENANT-ONLY',159000,5),
 ('cccccccc-1111-4111-8111-cccccccccccc','22222222-2222-4222-8222-222222222222','QA-TENANT-ONLY',99000,2);
INSERT INTO qa_rpc8.orders VALUES
 ('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',NULL,'pending',159000),
 ('cccccccc-2222-4222-8222-cccccccccccc','22222222-2222-4222-8222-222222222222',NULL,'pending',99000);

ALTER TABLE qa_rpc8.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.products FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.customers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA qa_rpc8 FROM PUBLIC;
GRANT SELECT ON qa_rpc8.tenants,qa_rpc8.tenant_memberships,qa_rpc8.products,
 qa_rpc8.orders,qa_rpc8.customers TO qa_rpc8_user;
CREATE POLICY memberships_self_read ON qa_rpc8.tenant_memberships
 FOR SELECT TO qa_rpc8_user
 USING (user_id=qa_rpc8.actor_id() AND active);
CREATE POLICY tenants_member_read ON qa_rpc8.tenants
 FOR SELECT TO qa_rpc8_user USING(EXISTS(
  SELECT 1 FROM qa_rpc8.tenant_memberships m
  WHERE m.tenant_id=tenants.id AND m.user_id=qa_rpc8.actor_id() AND m.active
 ));
CREATE POLICY products_member_read ON qa_rpc8.products
 FOR SELECT TO qa_rpc8_user USING(EXISTS(
  SELECT 1 FROM qa_rpc8.tenant_memberships m
  WHERE m.tenant_id=products.tenant_id AND m.user_id=qa_rpc8.actor_id() AND m.active
 ));
CREATE POLICY orders_manager_read ON qa_rpc8.orders
 FOR SELECT TO qa_rpc8_user USING(EXISTS(
  SELECT 1 FROM qa_rpc8.tenant_memberships m
  WHERE m.tenant_id=orders.tenant_id AND m.user_id=qa_rpc8.actor_id() AND m.active
    AND m.role IN('owner','manager')
 ));
CREATE POLICY customers_manager_read ON qa_rpc8.customers
 FOR SELECT TO qa_rpc8_user USING(EXISTS(
  SELECT 1 FROM qa_rpc8.tenant_memberships m
  WHERE m.tenant_id=customers.tenant_id AND m.user_id=qa_rpc8.actor_id() AND m.active
    AND m.role IN('owner','manager')
 ));
