\set ON_ERROR_STOP on
-- TIEN404 V18.0-P0D - STRICTLY DISPOSABLE PostgreSQL 17.
-- All IDs/fixtures below are fake. Do NOT run on Supabase staging or production.
-- This tests Store-scoped *candidate* authorization, NOT existing public Commerce.
DO $guard$
BEGIN
 IF current_database() <> 't404_v180_p0d_ci' OR current_user <> 'postgres'
 OR current_setting('server_version_num')::integer < 170000 THEN
  RAISE EXCEPTION 'V18_P0D_DISPOSABLE_PG17_ONLY' USING ERRCODE='42501';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'shop_qa') THEN
  RAISE EXCEPTION 'V18_P0D_SCHEMA_COLLISION' USING ERRCODE='42501';
 END IF;
END $guard$;

CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
CREATE ROLE anon NOLOGIN NOBYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA shop_qa;
REVOKE ALL ON SCHEMA shop_qa FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
REVOKE EXECUTE ON FUNCTION auth.uid() FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

-- Single canonical UUID contract. The membership FK enforces Store belongs to tenant.
CREATE TABLE shop_qa.stores (
 tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 authority_version integer NOT NULL DEFAULT 1 CHECK (authority_version > 0),
 PRIMARY KEY (tenant_id, store_id)
);
CREATE TABLE shop_qa.store_memberships (
 tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 user_id uuid NOT NULL, role text NOT NULL CHECK(role IN ('owner','manager','staff')),
 active boolean NOT NULL DEFAULT false,
 PRIMARY KEY (tenant_id,store_id,user_id),
 FOREIGN KEY (tenant_id,store_id) REFERENCES shop_qa.stores(tenant_id,store_id)
);
CREATE INDEX member_actor_idx ON shop_qa.store_memberships(user_id,tenant_id,store_id)
 WHERE active;
CREATE TABLE shop_qa.products (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 sku text NOT NULL, name text NOT NULL,
 price_vnd bigint NOT NULL CHECK(price_vnd BETWEEN 0 AND 1000000000000),
 stock_on_hand integer NOT NULL CHECK(stock_on_hand >= 0),
 active boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,store_id,id), UNIQUE(tenant_id,store_id,sku),
 FOREIGN KEY(tenant_id,store_id) REFERENCES shop_qa.stores(tenant_id,store_id)
);
CREATE TABLE shop_qa.customers (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 alias text NOT NULL,
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES shop_qa.stores(tenant_id,store_id)
);
CREATE TABLE shop_qa.orders (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 customer_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending',
 total_vnd bigint NOT NULL CHECK(total_vnd >= 0),
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id,customer_id) REFERENCES shop_qa.customers(tenant_id,store_id,id)
);
CREATE TABLE shop_qa.order_items (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 order_id uuid NOT NULL,product_id uuid NOT NULL,
 quantity integer NOT NULL CHECK(quantity > 0),
 unit_price_vnd bigint NOT NULL CHECK(unit_price_vnd >= 0),
 line_total_vnd bigint NOT NULL CHECK(line_total_vnd = quantity * unit_price_vnd),
 FOREIGN KEY(tenant_id,store_id,order_id) REFERENCES shop_qa.orders(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id,product_id) REFERENCES shop_qa.products(tenant_id,store_id,id)
);
CREATE TABLE shop_qa.conversations (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('messenger','zalo','website')),
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES shop_qa.stores(tenant_id,store_id)
);
CREATE TABLE shop_qa.messages (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 conversation_id uuid NOT NULL, body text NOT NULL,
 FOREIGN KEY(tenant_id,store_id,conversation_id) REFERENCES shop_qa.conversations(tenant_id,store_id,id)
);
CREATE TABLE shop_qa.channel_installations (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 provider text NOT NULL CHECK(provider IN ('messenger','zalo')),
 enabled boolean NOT NULL DEFAULT false,
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES shop_qa.stores(tenant_id,store_id)
);

-- RLS on all authorization and commerce surfaces; anonymous users get no access.
ALTER TABLE shop_qa.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.products FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.messages FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.channel_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.channel_installations FORCE ROW LEVEL SECURITY;

CREATE POLICY membership_own_read ON shop_qa.store_memberships
 FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY store_active_member_read ON shop_qa.stores
 FOR SELECT TO authenticated USING (
 is_active AND EXISTS(SELECT 1 FROM shop_qa.store_memberships m
  WHERE m.tenant_id=stores.tenant_id AND m.store_id=stores.store_id
   AND m.user_id=(SELECT auth.uid()) AND m.active)
);

-- SECURITY INVOKER means membership + stores RLS still apply; never use editable user_metadata.
CREATE FUNCTION shop_qa.can_access(t uuid,s uuid,permitted_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $body$
 SELECT EXISTS(
  SELECT 1 FROM shop_qa.store_memberships m
  JOIN shop_qa.stores st ON (st.tenant_id,st.store_id)=(m.tenant_id,m.store_id)
  WHERE m.tenant_id=t AND m.store_id=s
   AND m.user_id=(SELECT auth.uid()) AND m.active AND st.is_active
   AND m.role=ANY(permitted_roles)
 )
$body$;
REVOKE EXECUTE ON FUNCTION shop_qa.can_access(uuid,uuid,text[]) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA shop_qa TO authenticated;
GRANT EXECUTE ON FUNCTION shop_qa.can_access(uuid,uuid,text[]) TO authenticated;
GRANT SELECT ON shop_qa.stores,shop_qa.store_memberships,
 shop_qa.products,shop_qa.customers,shop_qa.orders,shop_qa.order_items,
 shop_qa.conversations,shop_qa.messages,shop_qa.channel_installations
 TO authenticated;
GRANT INSERT,UPDATE ON shop_qa.products TO authenticated;

CREATE POLICY product_read ON shop_qa.products FOR SELECT TO authenticated
 USING (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager','staff']));
CREATE POLICY product_insert ON shop_qa.products FOR INSERT TO authenticated
 WITH CHECK (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager']));
CREATE POLICY product_update ON shop_qa.products FOR UPDATE TO authenticated
 USING (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager']))
 WITH CHECK (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager']));
CREATE POLICY customer_read ON shop_qa.customers FOR SELECT TO authenticated
 USING (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager']));
CREATE POLICY orders_read ON shop_qa.orders FOR SELECT TO authenticated
 USING (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager']));
CREATE POLICY order_items_read ON shop_qa.order_items FOR SELECT TO authenticated
 USING (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager']));
CREATE POLICY conversations_read ON shop_qa.conversations FOR SELECT TO authenticated
 USING (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager']));
CREATE POLICY messages_read ON shop_qa.messages FOR SELECT TO authenticated
 USING (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager']));
CREATE POLICY install_read ON shop_qa.channel_installations FOR SELECT TO authenticated
 USING (shop_qa.can_access(tenant_id,store_id,ARRAY['owner','manager']));

-- Policy USING+WITH CHECK cannot compare OLD and NEW when an actor owns both stores.
-- Prevent same-tenant Store transfer even for dual-store owners.
CREATE FUNCTION shop_qa.immutable_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
BEGIN
 IF (NEW.tenant_id,NEW.store_id) IS DISTINCT FROM (OLD.tenant_id,OLD.store_id)
 THEN RAISE insufficient_privilege; END IF;
 RETURN NEW;
END $body$;
CREATE TRIGGER products_no_scope_move BEFORE UPDATE ON shop_qa.products
 FOR EACH ROW EXECUTE FUNCTION shop_qa.immutable_scope();

-- Store-scoped candidate replaces legacy tenant-only RPC semantics IN THIS QA DATABASE.
-- Explicit idempotency and order owner controls remain separate future components.
CREATE FUNCTION shop_qa.save_product_scoped(
 p_tenant uuid,p_store uuid,p_sku text,p_name text,
 p_price bigint,p_initial_stock integer,p_expected_updated_at timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
DECLARE changed timestamptz;
BEGIN
 IF (SELECT auth.uid()) IS NULL
 OR NOT shop_qa.can_access(p_tenant,p_store,ARRAY['owner','manager'])
 THEN RAISE insufficient_privilege; END IF;
 IF p_sku IS NULL OR length(btrim(p_sku)) NOT BETWEEN 1 AND 80
 OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 250
 OR p_price IS NULL OR p_price NOT BETWEEN 0 AND 1000000000000
 THEN RAISE EXCEPTION 'invalid product' USING ERRCODE='22023'; END IF;
 IF p_expected_updated_at IS NULL THEN
  IF p_initial_stock IS NULL OR p_initial_stock < 0
  THEN RAISE EXCEPTION 'invalid initial stock' USING ERRCODE='22023'; END IF;
  INSERT INTO shop_qa.products(id,tenant_id,store_id,sku,name,price_vnd,stock_on_hand)
  VALUES(gen_random_uuid(),p_tenant,p_store,p_sku,p_name,p_price,p_initial_stock)
  RETURNING updated_at INTO changed;
 ELSE
  IF p_initial_stock IS NOT NULL
  THEN RAISE EXCEPTION 'stock immutable in edit' USING ERRCODE='22023'; END IF;
  UPDATE shop_qa.products
  SET name=p_name,price_vnd=p_price,
      updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond')
  WHERE tenant_id=p_tenant AND store_id=p_store AND sku=p_sku
    AND updated_at=p_expected_updated_at
  RETURNING updated_at INTO changed;
  IF NOT FOUND THEN
    RAISE SQLSTATE 'PT409' USING MESSAGE='product_missing_or_conflict';
  END IF;
 END IF;
 RETURN changed;
END $body$;
REVOKE ALL ON FUNCTION shop_qa.save_product_scoped(uuid,uuid,text,text,bigint,integer,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION shop_qa.save_product_scoped(uuid,uuid,text,text,bigint,integer,timestamptz) TO authenticated;

-- All fixture identities and data below are synthetic.
-- Tenant1 owns two different stores A/B. Tenant2 owns store C.
INSERT INTO shop_qa.stores VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,1),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true,1),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true,1);
INSERT INTO shop_qa.store_memberships VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000001','owner',true),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','10000000-0000-4000-8000-000000000002','owner',true),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000003','owner',true),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','10000000-0000-4000-8000-000000000003','manager',true),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000004','staff',true),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','10000000-0000-4000-8000-000000000006','owner',true);
INSERT INTO shop_qa.products(id,tenant_id,store_id,sku,name,price_vnd,stock_on_hand)
 VALUES
 ('20000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','QA-SKU-1','Synthetic A',159000,5),
 ('20000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','QA-SKU-1','Synthetic B',259000,5),
 ('20000000-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','QA-SKU-1','Synthetic C',359000,5);
INSERT INTO shop_qa.customers VALUES
 ('30000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','QA-A'),
 ('30000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','QA-B'),
 ('30000000-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','QA-C');
INSERT INTO shop_qa.orders VALUES
 ('40000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','30000000-0000-4000-8000-000000000001','pending',159000),
 ('40000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','30000000-0000-4000-8000-000000000002','pending',259000),
 ('40000000-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','30000000-0000-4000-8000-000000000003','pending',359000);
INSERT INTO shop_qa.order_items VALUES
 ('50000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,159000,159000),
 ('50000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',1,259000,259000);
INSERT INTO shop_qa.conversations VALUES
 ('60000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','messenger'),
 ('60000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','zalo');
INSERT INTO shop_qa.messages VALUES
 ('70000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','60000000-0000-4000-8000-000000000001','Synthetic A only'),
 ('70000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','60000000-0000-4000-8000-000000000002','Synthetic B only');
INSERT INTO shop_qa.channel_installations VALUES
 ('80000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','messenger',true),
 ('80000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','zalo',true);

-- Read-only verification helper executes with invoker privileges, NOT SECURITY DEFINER.
CREATE FUNCTION shop_qa.assert_count(command text,expected bigint,case_id text)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
DECLARE got bigint;
BEGIN
 EXECUTE command INTO got;
 IF got IS DISTINCT FROM expected
 THEN RAISE EXCEPTION 'FAILED_%_EXPECTED_%_GOT_%',case_id,expected,got; END IF;
 RAISE NOTICE 'PASS_%',case_id;
END $body$;
CREATE FUNCTION shop_qa.assert_rows(command text,expected bigint,case_id text)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
DECLARE got bigint;
BEGIN
 EXECUTE command;
 GET DIAGNOSTICS got=ROW_COUNT;
 IF got IS DISTINCT FROM expected
 THEN RAISE EXCEPTION 'FAILED_%_EXPECTED_%_GOT_%',case_id,expected,got; END IF;
 RAISE NOTICE 'PASS_%',case_id;
END $body$;
CREATE FUNCTION shop_qa.assert_sqlstate(command text,expected text,case_id text)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
DECLARE got text:='00000';
BEGIN
 BEGIN EXECUTE command;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS got=RETURNED_SQLSTATE;
 END;
 IF got<>expected THEN RAISE EXCEPTION 'FAILED_%_EXPECTED_SQLSTATE_%_GOT_%',case_id,expected,got; END IF;
 RAISE NOTICE 'PASS_%',case_id;
END $body$;
GRANT EXECUTE ON FUNCTION shop_qa.assert_count(text,bigint,text),
 shop_qa.assert_rows(text,bigint,text),shop_qa.assert_sqlstate(text,text,text)
 TO authenticated;

-- Verify fail-closed policies, no anon rights and schema FK enforcement.
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
  WHERE s.nspname='shop_qa' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity;
 IF n<>9 THEN RAISE EXCEPTION 'FAIL_9_TABLES_FORCE_RLS_ACTUAL_%',n; END IF;
 SELECT count(*) INTO n FROM information_schema.role_table_grants
  WHERE table_schema='shop_qa' AND grantee='anon';
 IF n<>0 THEN RAISE EXCEPTION 'FAIL_ANON_NO_GRANTS'; END IF;
 RAISE NOTICE 'PASS_P0D_9_TABLES_FORCE_RLS_AND_ANON_DENIED';
END $check$;

-- A owner: 1 row per surface. Same Tenant Store B and different Tenant C must be invisible.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.stores',1,'A_STORE');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',1,'A_PRODUCTS');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.customers',1,'A_CUSTOMERS');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'A_ORDERS');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.order_items',1,'A_ORDER_ITEMS');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.conversations',1,'A_CONVERSATIONS');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.messages',1,'A_MESSAGES');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.channel_installations',1,'A_INSTALLATIONS');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',0,'A_DENY_STORE_B_ORDER');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.products WHERE tenant_id=''22222222-2222-4222-8222-222222222222''',0,'A_DENY_OTHER_TENANT');
SELECT shop_qa.assert_rows(
 'UPDATE shop_qa.products SET price_vnd=999999 WHERE store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',0,'A_DENY_STORE_B_UPDATE');
SELECT shop_qa.assert_sqlstate(
 'SELECT shop_qa.save_product_scoped(''11111111-1111-4111-8111-111111111111'',''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'',''QA-SKU-1'',''spoof'',999000,NULL,NULL)',
 '42501','A_RPC_B_BLOCKED');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.products(id,tenant_id,store_id,sku,name,price_vnd,stock_on_hand) VALUES(''20000000-0000-4000-8000-000000000010'',''11111111-1111-4111-8111-111111111111'',''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'',''QA-SKU-FAKE'',''spoof'',1,1)',
 '42501','A_INSERT_B_BLOCKED');
SELECT shop_qa.save_product_scoped(
 '11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'QA-SKU-1','Authorized QA A',165000,NULL,
 (SELECT updated_at FROM shop_qa.products WHERE sku='QA-SKU-1'));
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.products WHERE price_vnd=165000 AND sku=''QA-SKU-1''',1,'A_AUTHORIZED_UPDATE');
SELECT shop_qa.assert_sqlstate(
 'SELECT shop_qa.save_product_scoped(''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''QA-SKU-1'',''STALE'',100000,NULL,''2020-01-01T00:00:00Z''::timestamptz)',
 'PT409','A_STALE_CONFLICT_DENIED');
RESET ROLE;
DO $check$
BEGIN
 IF (SELECT price_vnd FROM shop_qa.products WHERE id='20000000-0000-4000-8000-000000000002')<>259000
 THEN RAISE EXCEPTION 'FAIL_STORE_B_PRICE_CHANGED_BY_A'; END IF;
 RAISE NOTICE 'PASS_STORE_B_UNMODIFIED_AFTER_A_ACTIONS';
END $check$;

-- B owner: same tenant, opposite scope.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',1,'B_PRODUCTS');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'B_ORDERS');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.messages WHERE store_id=''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''',0,'B_DENY_STORE_A_MESSAGES');
SELECT shop_qa.assert_sqlstate(
 'SELECT shop_qa.save_product_scoped(''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''QA-SKU-1'',''spoof'',199000,NULL,NULL)',
 '42501','B_RPC_A_BLOCKED');
RESET ROLE;

-- Staff reads catalog but cannot see orders, customers or write products.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',1,'STAFF_CATALOG_READ');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',0,'STAFF_ORDERS_DENIED');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.customers',0,'STAFF_CUSTOMER_DENIED');
SELECT shop_qa.assert_sqlstate(
 'SELECT shop_qa.save_product_scoped(''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''QA-STAFF-NEW'',''spoof'',1,1,NULL)',
 '42501','STAFF_WRITE_DENIED');
RESET ROLE;

-- Unrelated actor cannot gain privileges via editable metadata.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
SELECT set_config('request.jwt.claim.user_metadata','{"role":"owner","store_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',0,'OUTSIDER_DENIED');
SELECT shop_qa.assert_sqlstate(
 'SELECT shop_qa.save_product_scoped(''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''QA-FAKE'',''spoof'',1,1,NULL)',
 '42501','FAKE_USER_METADATA_DENIED');
RESET ROLE;

-- Legitimately dual-store actor must STILL NOT move existing rows from A to B.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',2,'DUAL_OWNER_READS_TWO');
SELECT shop_qa.assert_sqlstate(
 'UPDATE shop_qa.products SET store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'' WHERE id=''20000000-0000-4000-8000-000000000001''',
 '42501','DUAL_OWNER_CANNOT_MOVE_PRODUCT');
RESET ROLE;

-- Tenant C owner can see only C.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',1,'OTHER_TENANT_C_ONLY');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'OTHER_TENANT_C_ORDER');
RESET ROLE;

-- Test same-store referential integrity independently of RLS with synthetic db owner.
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.order_items(id,tenant_id,store_id,order_id,product_id,quantity,unit_price_vnd,line_total_vnd) VALUES(''50000000-0000-4000-8000-000000000010'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''40000000-0000-4000-8000-000000000001'',''20000000-0000-4000-8000-000000000002'',1,259000,259000)',
 '23503','CROSS_STORE_ORDER_PRODUCT_FK_DENIED');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.orders(id,tenant_id,store_id,customer_id,total_vnd) VALUES(''40000000-0000-4000-8000-000000000010'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''30000000-0000-4000-8000-000000000002'',259000)',
 '23503','CROSS_STORE_ORDER_CUSTOMER_FK_DENIED');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.messages(id,tenant_id,store_id,conversation_id,body) VALUES(''70000000-0000-4000-8000-000000000010'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''60000000-0000-4000-8000-000000000002'',''spoof'')',
 '23503','CROSS_STORE_MESSAGE_CONVERSATION_FK_DENIED');

-- Revocation and store suspension take effect without requiring JWT refresh in this simulated model.
UPDATE shop_qa.store_memberships SET active=false
 WHERE user_id='10000000-0000-4000-8000-000000000002';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',0,'B_REVOKED_MEMBERSHIP_DENIED');
RESET ROLE;
UPDATE shop_qa.stores SET is_active=false
 WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',0,'A_SUSPENDED_STORE_DENIED');
RESET ROLE;
DO $done$
BEGIN
 RAISE NOTICE 'PASS_V18_P0D_DISPOSABLE_STORE_A_B_AUTHORIZATION_AND_FK_MATRIX';
 RAISE NOTICE 'BOUNDARY_SYNTHETIC_AUTH_UID_NOT_REAL_SUPABASE_JWT';
 RAISE NOTICE 'BOUNDARY_NO_HOSTED_MIGRATION_NO_REAL_PROVIDER_NO_CUSTOMER_ROWS';
END $done$;
