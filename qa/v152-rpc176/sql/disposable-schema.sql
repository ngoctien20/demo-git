-- RPC17.6 disposable LOCAL PostgreSQL test fixture only. NEVER execute on Supabase.
-- Requires a fresh ephemeral postgres:17 GitHub Actions service.
-- Uses synthetic claims through a test-only auth.uid stub; DOES NOT authenticate JWTs.
\set ON_ERROR_STOP on

CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA rpc176_qa;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE FUNCTION rpc176_qa.assert_count(actual bigint,expected bigint,scenario text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'RPC176 QA FAILED %: got %, expected %',scenario,actual,expected;
  END IF;
  RAISE NOTICE 'RPC176 QA PASS: %',scenario;
END $$;

CREATE TABLE rpc176_qa.tenants (
  id uuid PRIMARY KEY
);
CREATE TABLE rpc176_qa.tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES rpc176_qa.tenants(id),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN ('owner','manager','staff')),
  active boolean NOT NULL,
  PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE rpc176_qa.stores (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES rpc176_qa.tenants(id),
  active boolean NOT NULL DEFAULT true,
  authority_version integer NOT NULL CHECK(authority_version>0),
  PRIMARY KEY(id),
  UNIQUE(tenant_id,id)
);
CREATE TABLE rpc176_qa.store_memberships (
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN ('owner','manager','staff')),
  active boolean NOT NULL,
  authority_version integer NOT NULL CHECK(authority_version>0),
  PRIMARY KEY(tenant_id,store_id,user_id),
  FOREIGN KEY(tenant_id,store_id) REFERENCES rpc176_qa.stores(tenant_id,id),
  FOREIGN KEY(tenant_id,user_id) REFERENCES rpc176_qa.tenant_memberships(tenant_id,user_id)
);
CREATE TABLE rpc176_qa.products (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  sku text NOT NULL,
  FOREIGN KEY(tenant_id,store_id) REFERENCES rpc176_qa.stores(tenant_id,id),
  UNIQUE(tenant_id,store_id,sku)
);
CREATE TABLE rpc176_qa.orders (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  FOREIGN KEY(tenant_id,store_id) REFERENCES rpc176_qa.stores(tenant_id,id)
);

CREATE INDEX store_membership_lookup ON rpc176_qa.store_memberships(user_id,tenant_id,store_id) WHERE active;
CREATE INDEX product_tenant_store ON rpc176_qa.products(tenant_id,store_id);
CREATE INDEX order_tenant_store ON rpc176_qa.orders(tenant_id,store_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','tenant_memberships','stores','store_memberships','products','orders']
  LOOP
    EXECUTE format('ALTER TABLE rpc176_qa.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE rpc176_qa.%I FORCE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA auth,rpc176_qa TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION rpc176_qa.assert_count(bigint,bigint,text) TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA rpc176_qa TO authenticated;
GRANT INSERT ON rpc176_qa.products TO authenticated;

CREATE POLICY tenant_self ON rpc176_qa.tenant_memberships FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) AND active);
CREATE POLICY store_self ON rpc176_qa.store_memberships FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) AND active);
CREATE POLICY tenant_read ON rpc176_qa.tenants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rpc176_qa.tenant_memberships tm
    WHERE tm.tenant_id=tenants.id AND tm.user_id=(SELECT auth.uid()) AND tm.active));
CREATE POLICY store_read ON rpc176_qa.stores FOR SELECT TO authenticated
  USING (active AND EXISTS (SELECT 1 FROM rpc176_qa.tenant_memberships tm
    WHERE tm.tenant_id=stores.tenant_id AND tm.user_id=(SELECT auth.uid()) AND tm.active)
    AND EXISTS (SELECT 1 FROM rpc176_qa.store_memberships sm
    WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.id
      AND sm.user_id=(SELECT auth.uid()) AND sm.active
      AND sm.authority_version=stores.authority_version));
CREATE POLICY products_read ON rpc176_qa.products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rpc176_qa.stores s
    WHERE s.tenant_id=products.tenant_id AND s.id=products.store_id AND s.active)
    AND EXISTS (SELECT 1 FROM rpc176_qa.tenant_memberships tm
    WHERE tm.tenant_id=products.tenant_id AND tm.user_id=(SELECT auth.uid()) AND tm.active)
    AND EXISTS (SELECT 1 FROM rpc176_qa.store_memberships sm
    JOIN rpc176_qa.stores s ON s.id=sm.store_id AND s.tenant_id=sm.tenant_id
    WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active
    AND sm.authority_version=s.authority_version));
CREATE POLICY products_insert ON rpc176_qa.products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rpc176_qa.tenant_memberships tm
    WHERE tm.tenant_id=products.tenant_id AND tm.user_id=(SELECT auth.uid())
    AND tm.active AND tm.role IN ('owner','manager'))
    AND EXISTS (SELECT 1 FROM rpc176_qa.store_memberships sm
    JOIN rpc176_qa.stores s ON s.id=sm.store_id AND s.tenant_id=sm.tenant_id
    WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
      AND sm.user_id=(SELECT auth.uid()) AND sm.active AND sm.role IN ('owner','manager')
      AND s.active AND sm.authority_version=s.authority_version));
CREATE POLICY orders_read ON rpc176_qa.orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rpc176_qa.tenant_memberships tm
    WHERE tm.tenant_id=orders.tenant_id AND tm.user_id=(SELECT auth.uid())
      AND tm.active AND tm.role IN ('owner','manager'))
    AND EXISTS (SELECT 1 FROM rpc176_qa.store_memberships sm
    JOIN rpc176_qa.stores s ON s.id=sm.store_id AND s.tenant_id=sm.tenant_id
    WHERE sm.tenant_id=orders.tenant_id AND sm.store_id=orders.store_id
      AND sm.user_id=(SELECT auth.uid()) AND sm.active
      AND sm.role IN ('owner','manager') AND s.active
      AND sm.authority_version=s.authority_version));

-- Synthetic tenant A has Store A and Store B; tenant C is independent.
INSERT INTO rpc176_qa.tenants(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO rpc176_qa.tenant_memberships(tenant_id,user_id,role,active) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','owner',true),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','owner',true),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','manager',true),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','staff',true),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','owner',true),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6','owner',true);
INSERT INTO rpc176_qa.stores(id,tenant_id,active,authority_version) VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-8111-111111111111',true,2),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','11111111-1111-4111-8111-111111111111',true,2),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','22222222-2222-4222-8222-222222222222',true,1);
INSERT INTO rpc176_qa.store_memberships(tenant_id,store_id,user_id,role,active,authority_version) VALUES
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','owner',true,2),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','owner',true,2),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','staff',true,2),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','owner',false,2),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6','owner',true,1);
INSERT INTO rpc176_qa.products(id,tenant_id,store_id,sku) VALUES
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','SKU-A'),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','SKU-B'),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','SKU-C');
INSERT INTO rpc176_qa.orders(id,tenant_id,store_id) VALUES
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),
 ('dddddddd-dddd-4ddd-8ddd-ddddddddddd3','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3');
