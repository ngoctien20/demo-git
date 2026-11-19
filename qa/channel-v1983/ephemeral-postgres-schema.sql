-- TIEN404 V19.8.3 -- EPHEMERAL POSTGRES ONLY. Not a Supabase migration.
-- This script is executed solely in the GitHub Actions disposable postgres:17 service.
-- No external DB URL, Supabase project, real users, bot tokens or customer rows.
BEGIN;
CREATE SCHEMA qa1983;
CREATE SCHEMA auth;
CREATE ROLE qa_authenticated NOLOGIN;
CREATE ROLE qa_anon NOLOGIN;
-- Mocks PostgREST claim context; DOES NOT verify a signed Supabase JWT.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA qa1983, auth TO qa_authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO qa_authenticated;

CREATE TABLE qa1983.tenants (
 id uuid PRIMARY KEY, code text NOT NULL UNIQUE
);
CREATE TABLE qa1983.stores (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES qa1983.tenants(id),
 code text NOT NULL, active boolean NOT NULL DEFAULT false,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,code)
);
CREATE TABLE qa1983.tenant_memberships (
 tenant_id uuid NOT NULL REFERENCES qa1983.tenants(id),
 user_id uuid NOT NULL,
 active boolean NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','member')),
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE qa1983.store_memberships (
 tenant_id uuid NOT NULL, store_id uuid NOT NULL, user_id uuid NOT NULL,
 active boolean NOT NULL, role text NOT NULL CHECK(role IN ('owner','manager','staff')),
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa1983.stores(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES qa1983.tenant_memberships(tenant_id,user_id)
);
CREATE TABLE qa1983.products (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 sku text NOT NULL, name text NOT NULL, price_vnd bigint NOT NULL CHECK(price_vnd>0),
 stock integer NOT NULL CHECK(stock>=0),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa1983.stores(tenant_id,id),
 UNIQUE(tenant_id,store_id,id), UNIQUE(tenant_id,store_id,sku)
);
CREATE TABLE qa1983.orders (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa1983.stores(tenant_id,id),
 UNIQUE(tenant_id,store_id,id)
);
CREATE TABLE qa1983.order_items (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 order_id uuid NOT NULL, product_id uuid NOT NULL, qty integer NOT NULL CHECK(qty>0),
 FOREIGN KEY(tenant_id,store_id,order_id) REFERENCES qa1983.orders(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id,product_id) REFERENCES qa1983.products(tenant_id,store_id,id)
);
CREATE TABLE qa1983.conversations (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 channel text NOT NULL,
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa1983.stores(tenant_id,id),
 UNIQUE(tenant_id,store_id,id)
);
CREATE TABLE qa1983.messages (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 conversation_id uuid NOT NULL, message_type text NOT NULL,
 FOREIGN KEY(tenant_id,store_id,conversation_id) REFERENCES qa1983.conversations(tenant_id,store_id,id)
);

INSERT INTO qa1983.tenants VALUES ('00000000-0000-0000-0000-000000000001','QA_TENANT_SHARED');
INSERT INTO qa1983.stores VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000001','STORE_A',true),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000001','STORE_B',true);
INSERT INTO qa1983.tenant_memberships VALUES
 ('00000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',true,'owner'),
 ('00000000-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002',true,'owner'),
 ('00000000-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003',true,'member'),
 ('00000000-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000004',true,'owner');
INSERT INTO qa1983.store_memberships VALUES
 ('00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-0000-0000-0000-000000000001',true,'owner'),
 ('00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-0000-0000-0000-000000000002',true,'owner'),
 ('00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','dddddddd-0000-0000-0000-000000000004',false,'owner');
INSERT INTO qa1983.products VALUES
 ('aaaaaaaa-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01','SYN_STORE_A',159000,5),
 ('bbbbbbbb-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','F01','SYN_STORE_B',189000,9);
INSERT INTO qa1983.orders VALUES
 ('aaaaaaaa-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',159000),
 ('bbbbbbbb-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',189000);
INSERT INTO qa1983.order_items VALUES
 ('aaaaaaaa-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-2222-2222-2222-222222222222','aaaaaaaa-1111-1111-1111-111111111111',1),
 ('bbbbbbbb-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-2222-2222-2222-222222222222','bbbbbbbb-1111-1111-1111-111111111111',1);
INSERT INTO qa1983.conversations VALUES
 ('aaaaaaaa-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','zalo_bot'),
 ('bbbbbbbb-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','zalo_bot');
INSERT INTO qa1983.messages VALUES
 ('aaaaaaaa-5555-5555-5555-555555555555','00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-3333-3333-3333-333333333333','inbound'),
 ('bbbbbbbb-5555-5555-5555-555555555555','00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-3333-3333-3333-333333333333','inbound');

ALTER TABLE qa1983.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa1983.store_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY only_self_tenant ON qa1983.tenant_memberships
 FOR SELECT TO qa_authenticated USING(user_id=auth.uid());
CREATE POLICY only_self_store ON qa1983.store_memberships
 FOR SELECT TO qa_authenticated USING(user_id=auth.uid());
GRANT SELECT ON qa1983.tenant_memberships, qa1983.store_memberships TO qa_authenticated;
CREATE FUNCTION qa1983.can_read_store(p_tenant uuid,p_store uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog
AS $$
 SELECT EXISTS (
 SELECT 1 FROM qa1983.store_memberships sm
 JOIN qa1983.tenant_memberships tm
 ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
 WHERE sm.tenant_id=p_tenant AND sm.store_id=p_store
 AND sm.user_id=auth.uid() AND sm.active=true AND tm.active=true
 )
$$;
GRANT EXECUTE ON FUNCTION qa1983.can_read_store(uuid,uuid) TO qa_authenticated;

ALTER TABLE qa1983.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa1983.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa1983.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa1983.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa1983.messages ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['products','orders','order_items','conversations','messages'] LOOP
  EXECUTE format(
   'CREATE POLICY %I ON qa1983.%I FOR SELECT TO qa_authenticated USING (qa1983.can_read_store(tenant_id,store_id))',
   t || '_scoped_read',t
  );
 END LOOP;
END $$;
CREATE POLICY products_own_insert ON qa1983.products
 FOR INSERT TO qa_authenticated WITH CHECK (qa1983.can_read_store(tenant_id,store_id));
CREATE POLICY products_own_update ON qa1983.products
 FOR UPDATE TO qa_authenticated
 USING(qa1983.can_read_store(tenant_id,store_id))
 WITH CHECK(qa1983.can_read_store(tenant_id,store_id));
GRANT SELECT ON qa1983.products,qa1983.orders,qa1983.order_items,qa1983.conversations,qa1983.messages TO qa_authenticated;
GRANT INSERT,UPDATE ON qa1983.products TO qa_authenticated;

CREATE FUNCTION qa1983.assert_count(label text,actual bigint,expected bigint)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FAIL %: got %, expected %',label,actual,expected; END IF;
 RAISE NOTICE 'PASS %',label;
END $$;
GRANT EXECUTE ON FUNCTION qa1983.assert_count(text,bigint,bigint) TO qa_authenticated;
COMMIT;
