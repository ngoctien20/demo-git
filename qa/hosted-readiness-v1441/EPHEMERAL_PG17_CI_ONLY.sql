-- TIEN404 V14.4.1 — DISPOSABLE POSTGRES 17 CI ONLY, never a Supabase migration.
-- This deliberately demonstrates PostgreSQL RLS predicate semantics using
-- synthetic GUC actor identities; it DOES NOT verify a real JWT/Auth service.
-- Hard fail before ANY CREATE, ALTER, GRANT or data write outside exact CI DB.
\set ON_ERROR_STOP on
DO $qa_only$
BEGIN
 IF current_database()<>'tien404_v1441_ci'
    OR current_user<>'postgres'
    OR current_setting('tien404.qa_ephemeral',true)<>'V1441_DISPOSABLE'
 THEN
  RAISE EXCEPTION 'V1441_DISPOSABLE_POSTGRES_17_ONLY_NO_HOSTED_MIGRATION';
 END IF;
END
$qa_only$;

CREATE SCHEMA qa_v1441;
REVOKE ALL ON SCHEMA qa_v1441 FROM PUBLIC;
CREATE ROLE qa_v1441_user NOLOGIN NOSUPERUSER NOBYPASSRLS
 NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT USAGE ON SCHEMA qa_v1441 TO qa_v1441_user;

-- This claims GUC is NOT trusted in a real host. A real user JWT MUST be
-- cryptographically authenticated by Supabase Auth before its auth.uid()
-- identity is used by production RLS.
CREATE FUNCTION qa_v1441.actor_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER
AS $fn$
 SELECT nullif(current_setting('tien404.synthetic_actor',true),'')::uuid
$fn$;
REVOKE ALL ON FUNCTION qa_v1441.actor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_v1441.actor_id() TO qa_v1441_user;

CREATE TABLE qa_v1441.tenant_memberships (
 tenant_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,actor_id)
);
CREATE TABLE qa_v1441.store_memberships (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,store_id,actor_id),
 FOREIGN KEY (tenant_id,actor_id) REFERENCES qa_v1441.tenant_memberships(tenant_id,actor_id)
);
CREATE TABLE qa_v1441.products (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 id uuid PRIMARY KEY,
 sku text NOT NULL,
 price_vnd bigint NOT NULL CHECK(price_vnd>=0),
 stock integer NOT NULL CHECK(stock>=0),
 UNIQUE (tenant_id,store_id,id),
 UNIQUE (tenant_id,store_id,sku)
);
CREATE TABLE qa_v1441.orders (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 id uuid PRIMARY KEY,
 status text NOT NULL CHECK(status IN('pending','confirmed')),
 UNIQUE (tenant_id,store_id,id)
);
CREATE TABLE qa_v1441.order_items (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 order_id uuid NOT NULL,
 product_id uuid NOT NULL,
 qty integer NOT NULL CHECK(qty>0),
 FOREIGN KEY(tenant_id,store_id,order_id)
 REFERENCES qa_v1441.orders(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id,product_id)
 REFERENCES qa_v1441.products(tenant_id,store_id,id)
);

-- FIRST insert synthetic fixtures as DB owner, then apply RLS.
INSERT INTO qa_v1441.tenant_memberships VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001',true),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-0000-4000-8000-000000000002',true),
 ('22222222-2222-4222-8222-222222222222','cccccccc-0000-4000-8000-000000000003',true);
INSERT INTO qa_v1441.store_memberships VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001',true),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-0000-4000-8000-000000000002',true),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cccccccc-0000-4000-8000-000000000003',true);
INSERT INTO qa_v1441.products VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','SKU-SAME',159000,5),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','SKU-SAME',189000,9),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cccccccc-1111-4111-8111-cccccccccccc','SKU-SAME',99000,2);
INSERT INTO qa_v1441.orders VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','pending'),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','pending');
INSERT INTO qa_v1441.order_items VALUES
 ('aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',2);

-- Privileged owner creates explicit RLS, staff role NEVER has BYPASSRLS.
ALTER TABLE qa_v1441.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v1441.tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_v1441.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v1441.store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_v1441.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v1441.products FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_v1441.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v1441.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_v1441.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v1441.order_items FORCE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA qa_v1441 FROM PUBLIC;
GRANT SELECT ON qa_v1441.tenant_memberships,qa_v1441.store_memberships TO qa_v1441_user;
GRANT SELECT,INSERT,UPDATE ON qa_v1441.products TO qa_v1441_user;
GRANT SELECT ON qa_v1441.orders,qa_v1441.order_items TO qa_v1441_user;

CREATE POLICY tenant_self_read ON qa_v1441.tenant_memberships
 FOR SELECT TO qa_v1441_user
 USING(actor_id=qa_v1441.actor_id() AND active);
CREATE POLICY assigned_store_self_read ON qa_v1441.store_memberships
 FOR SELECT TO qa_v1441_user
 USING(actor_id=qa_v1441.actor_id() AND active);

CREATE FUNCTION qa_v1441.store_access(p_tenant uuid,p_store uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY INVOKER
 AS $fn$
  SELECT EXISTS(
    SELECT 1
    FROM qa_v1441.store_memberships sm
    JOIN qa_v1441.tenant_memberships tm
      ON tm.tenant_id=sm.tenant_id AND tm.actor_id=sm.actor_id
    WHERE sm.tenant_id=p_tenant AND sm.store_id=p_store
      AND sm.actor_id=qa_v1441.actor_id()
      AND sm.active AND tm.active
  )
 $fn$;
REVOKE ALL ON FUNCTION qa_v1441.store_access(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_v1441.store_access(uuid,uuid) TO qa_v1441_user;
CREATE POLICY scoped_product_select ON qa_v1441.products
 FOR SELECT TO qa_v1441_user
 USING(qa_v1441.store_access(tenant_id,store_id));
CREATE POLICY scoped_product_insert ON qa_v1441.products
 FOR INSERT TO qa_v1441_user
 WITH CHECK(qa_v1441.store_access(tenant_id,store_id));
CREATE POLICY scoped_product_update ON qa_v1441.products
 FOR UPDATE TO qa_v1441_user
 USING(qa_v1441.store_access(tenant_id,store_id))
 WITH CHECK(qa_v1441.store_access(tenant_id,store_id));
CREATE POLICY scoped_order_read ON qa_v1441.orders
 FOR SELECT TO qa_v1441_user
 USING(qa_v1441.store_access(tenant_id,store_id));
CREATE POLICY scoped_order_items_read ON qa_v1441.order_items
 FOR SELECT TO qa_v1441_user
 USING(qa_v1441.store_access(tenant_id,store_id));

-- Cross-store FK violation must be blocked by composite keys regardless
-- of application or RLS predicates.
DO $fk$
BEGIN
 BEGIN
  INSERT INTO qa_v1441.order_items VALUES(
   'ffffffff-3333-4333-8333-ffffffffffff',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
   'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',1);
  RAISE EXCEPTION 'V1441_CROSS_STORE_FK_BYPASS';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END
$fk$;

-- CI fixtures only; never transplant these fixtures into Supabase staging.
