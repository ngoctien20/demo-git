-- T404 RPC10 PG17 disposable six-surface fixture; synthetic identities only.
-- Requires RPC8 synthetic legacy fixture + M1 + RPC9 synthetic Store setup.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'t404_rpc8_ci' OR current_user<>'postgres'
 OR current_setting('tien404.rpc8_ephemeral',true)<>'RPC8_DISPOSABLE'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'RPC10_DISPOSABLE_ONLY'; END IF;
 IF to_regclass('qa_rpc8.order_items') IS NOT NULL
 OR to_regclass('qa_rpc8.stores') IS NULL
 OR (SELECT count(*) FROM qa_rpc8.products)<>3
 OR (SELECT count(*) FROM qa_rpc8.orders)<>3
 OR (SELECT count(*) FROM qa_rpc8.stores)<>3
 THEN RAISE EXCEPTION 'RPC10_PARENT_FIXTURE_DRIFT';END IF;
END $guard$;
CREATE TABLE qa_rpc8.order_items (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, store_id uuid NULL,
 order_id uuid NOT NULL,product_id uuid NOT NULL,quantity integer NOT NULL CHECK(quantity>0),
 FOREIGN KEY(tenant_id,order_id) REFERENCES qa_rpc8.orders(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES qa_rpc8.products(tenant_id,id)
);
CREATE TABLE qa_rpc8.conversations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES qa_rpc8.tenants(id),
 store_id uuid NULL,channel text NOT NULL,UNIQUE(tenant_id,id)
);
CREATE TABLE qa_rpc8.messages(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NULL,
 conversation_id uuid NOT NULL,body text NOT NULL,
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES qa_rpc8.conversations(tenant_id,id)
);
INSERT INTO qa_rpc8.order_items(id,tenant_id,order_id,product_id,quantity) VALUES
('aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',1),
('bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb','bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',1),
('cccccccc-3333-4333-8333-cccccccccccc','22222222-2222-4222-8222-222222222222','cccccccc-2222-4222-8222-cccccccccccc','cccccccc-1111-4111-8111-cccccccccccc',1);
INSERT INTO qa_rpc8.conversations(id,tenant_id,channel) VALUES
('aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','website'),
('bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','messenger'),
('cccccccc-4444-4444-8444-cccccccccccc','22222222-2222-4222-8222-222222222222','zalo');
INSERT INTO qa_rpc8.messages(id,tenant_id,conversation_id,body) VALUES
('aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa','QA A'),
('bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb','QA B'),
('cccccccc-5555-4555-8555-cccccccccccc','22222222-2222-4222-8222-222222222222','cccccccc-4444-4444-8444-cccccccccccc','QA C');
ALTER TABLE qa_rpc8.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.messages FORCE ROW LEVEL SECURITY;
REVOKE ALL ON qa_rpc8.order_items,qa_rpc8.conversations,qa_rpc8.messages FROM PUBLIC;
GRANT SELECT ON qa_rpc8.order_items,qa_rpc8.conversations,qa_rpc8.messages TO qa_rpc8_user;
-- Intentionally reproduces legacy same-Tenant A/B leak before atomic cutover.
CREATE POLICY order_items_manager_read ON qa_rpc8.order_items
 FOR SELECT TO qa_rpc8_user USING(EXISTS(SELECT 1 FROM qa_rpc8.tenant_memberships tm
 WHERE tm.tenant_id=order_items.tenant_id AND tm.user_id=qa_rpc8.actor_id()
 AND tm.active AND tm.role IN('owner','manager')));
CREATE POLICY conversations_manager_read ON qa_rpc8.conversations
 FOR SELECT TO qa_rpc8_user USING(EXISTS(SELECT 1 FROM qa_rpc8.tenant_memberships tm
 WHERE tm.tenant_id=conversations.tenant_id AND tm.user_id=qa_rpc8.actor_id()
 AND tm.active AND tm.role IN('owner','manager')));
CREATE POLICY messages_manager_read ON qa_rpc8.messages
 FOR SELECT TO qa_rpc8_user USING(EXISTS(SELECT 1 FROM qa_rpc8.tenant_memberships tm
 WHERE tm.tenant_id=messages.tenant_id AND tm.user_id=qa_rpc8.actor_id()
 AND tm.active AND tm.role IN('owner','manager')));
