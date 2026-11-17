-- V18.0-P0 / RPC17.8C: DISPOSABLE PG17 CI FIXTURE ONLY — NEVER APPLY TO SUPABASE.
-- THIS IS NOT A REAL JWT SIGNATURE VERIFIER. set_config() is attacker-settable
-- in a direct PG session; here it simulates the *result* of a verified issuer.
-- Do not reuse test grants, policy SQL, or mock_jwt_sub() on a hosted database.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='rpc178c_ci') THEN
    RAISE EXCEPTION 'RPC178C CI schema already exists — fail closed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='rpc178_qa'
             AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='rpc178_qa' AND c.relname='stores')) THEN
    RAISE EXCEPTION 'RPC178A candidate baseline unexpected';
  END IF;
END $$;
CREATE SCHEMA rpc178c_ci;
REVOKE ALL ON SCHEMA rpc178c_ci FROM PUBLIC;
CREATE FUNCTION rpc178c_ci.mock_jwt_sub()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $$ SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true),'')::uuid $$;
REVOKE ALL ON FUNCTION rpc178c_ci.mock_jwt_sub() FROM PUBLIC;
CREATE TABLE rpc178c_ci.tenants(
  tenant_id uuid PRIMARY KEY
);
CREATE TABLE rpc178c_ci.stores(
  tenant_id uuid NOT NULL REFERENCES rpc178c_ci.tenants(tenant_id),
  store_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  authority_version integer NOT NULL CHECK (authority_version > 0),
  PRIMARY KEY(tenant_id,store_id)
);
CREATE TABLE rpc178c_ci.store_memberships(
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','manager','staff')),
  is_active boolean NOT NULL DEFAULT false,
  authority_version integer NOT NULL CHECK(authority_version > 0),
  PRIMARY KEY(tenant_id,store_id,user_id),
  FOREIGN KEY (tenant_id,store_id) REFERENCES rpc178c_ci.stores(tenant_id,store_id)
);
CREATE TABLE rpc178c_ci.products(
  product_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  sku text NOT NULL,
  FOREIGN KEY (tenant_id,store_id) REFERENCES rpc178c_ci.stores(tenant_id,store_id),
  UNIQUE (tenant_id,store_id,product_id),
  UNIQUE (tenant_id,store_id,sku)
);
CREATE TABLE rpc178c_ci.orders(
  order_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  total_vnd bigint NOT NULL CHECK (total_vnd >= 0),
  FOREIGN KEY (tenant_id,store_id) REFERENCES rpc178c_ci.stores(tenant_id,store_id),
  FOREIGN KEY (tenant_id,store_id,product_id)
    REFERENCES rpc178c_ci.products(tenant_id,store_id,product_id)
);
CREATE INDEX rpc178c_member_by_actor ON rpc178c_ci.store_memberships
  (user_id,tenant_id,store_id) WHERE is_active;
CREATE INDEX rpc178c_products_by_store ON rpc178c_ci.products(tenant_id,store_id);
CREATE INDEX rpc178c_orders_by_store ON rpc178c_ci.orders(tenant_id,store_id);
ALTER TABLE rpc178c_ci.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc178c_ci.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE rpc178c_ci.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc178c_ci.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE rpc178c_ci.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc178c_ci.store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE rpc178c_ci.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc178c_ci.products FORCE ROW LEVEL SECURITY;
ALTER TABLE rpc178c_ci.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc178c_ci.orders FORCE ROW LEVEL SECURITY;
-- Real authorization source for *this CI fixture* is a membership row in PG,
-- never a client-supplied Store ID or mutable user_metadata claim.
CREATE POLICY membership_self ON rpc178c_ci.store_memberships FOR SELECT TO authenticated
  USING (user_id = (SELECT rpc178c_ci.mock_jwt_sub()));
CREATE POLICY store_read_active_member ON rpc178c_ci.stores FOR SELECT TO authenticated
  USING (is_active AND EXISTS (
    SELECT 1 FROM rpc178c_ci.store_memberships AS m
    WHERE m.tenant_id=stores.tenant_id AND m.store_id=stores.store_id
      AND m.user_id=(SELECT rpc178c_ci.mock_jwt_sub())
      AND m.is_active AND m.authority_version=stores.authority_version
  ));
-- RLS on stores additionally checks membership active/version; policies below
-- intentionally rely on a server-side matching Store row, not a JWT store_id.
CREATE POLICY products_store_read ON rpc178c_ci.products FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rpc178c_ci.stores AS s
    WHERE s.tenant_id=products.tenant_id AND s.store_id=products.store_id
  ));
CREATE POLICY orders_store_read ON rpc178c_ci.orders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rpc178c_ci.stores AS s
    WHERE s.tenant_id=orders.tenant_id AND s.store_id=orders.store_id
  ));
CREATE POLICY orders_owner_manager_insert ON rpc178c_ci.orders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM rpc178c_ci.stores AS s
    JOIN rpc178c_ci.store_memberships AS m
      ON m.tenant_id=s.tenant_id AND m.store_id=s.store_id
    WHERE s.tenant_id=orders.tenant_id AND s.store_id=orders.store_id
      AND m.user_id=(SELECT rpc178c_ci.mock_jwt_sub())
      AND m.is_active AND m.authority_version=s.authority_version
      AND m.role IN ('owner','manager')
  ));
CREATE POLICY orders_owner_manager_update ON rpc178c_ci.orders FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rpc178c_ci.stores AS s
    JOIN rpc178c_ci.store_memberships AS m
      ON m.tenant_id=s.tenant_id AND m.store_id=s.store_id
    WHERE s.tenant_id=orders.tenant_id AND s.store_id=orders.store_id
      AND m.user_id=(SELECT rpc178c_ci.mock_jwt_sub())
      AND m.is_active AND m.authority_version=s.authority_version
      AND m.role IN ('owner','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rpc178c_ci.stores AS s
    JOIN rpc178c_ci.store_memberships AS m
      ON m.tenant_id=s.tenant_id AND m.store_id=s.store_id
    WHERE s.tenant_id=orders.tenant_id AND s.store_id=orders.store_id
      AND m.user_id=(SELECT rpc178c_ci.mock_jwt_sub())
      AND m.is_active AND m.authority_version=s.authority_version
      AND m.role IN ('owner','manager')
  ));
CREATE POLICY orders_owner_manager_delete ON rpc178c_ci.orders FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rpc178c_ci.stores AS s
    JOIN rpc178c_ci.store_memberships AS m
      ON m.tenant_id=s.tenant_id AND m.store_id=s.store_id
    WHERE s.tenant_id=orders.tenant_id AND s.store_id=orders.store_id
      AND m.user_id=(SELECT rpc178c_ci.mock_jwt_sub())
      AND m.is_active AND m.authority_version=s.authority_version
      AND m.role IN ('owner','manager')
  ));
-- These are simulated role grants ONLY on rpc178c_ci in ephemeral CI.
-- Crucially, NEVER grant anything on inherited private rpc178_qa candidate.
GRANT USAGE ON SCHEMA rpc178c_ci TO authenticated;
GRANT EXECUTE ON FUNCTION rpc178c_ci.mock_jwt_sub() TO authenticated;
GRANT SELECT ON rpc178c_ci.stores,rpc178c_ci.store_memberships,
  rpc178c_ci.products,rpc178c_ci.orders TO authenticated;
GRANT INSERT,UPDATE,DELETE ON rpc178c_ci.orders TO authenticated;
COMMIT;
-- Seed synthetic fixtures using CI database owner, not an authenticated user.
INSERT INTO rpc178c_ci.tenants VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO rpc178c_ci.stores(tenant_id,store_id,is_active,authority_version) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',true,1),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true,1),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',true,1);
INSERT INTO rpc178c_ci.store_memberships
  (tenant_id,store_id,user_id,role,is_active,authority_version) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','owner',true,1),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','manager',true,1),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','owner',true,1),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4','staff',true,1);
INSERT INTO rpc178c_ci.products(product_id,tenant_id,store_id,sku) VALUES
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','STORE-A-SKU'),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','STORE-B-SKU'),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','STORE-C-SKU');
INSERT INTO rpc178c_ci.orders(order_id,tenant_id,store_id,product_id,total_vnd) VALUES
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','cccccccc-cccc-4ccc-8ccc-ccccccccccc1',159000),
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','cccccccc-cccc-4ccc-8ccc-ccccccccccc2',299000),
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd3','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','cccccccc-cccc-4ccc-8ccc-ccccccccccc3',70000);
