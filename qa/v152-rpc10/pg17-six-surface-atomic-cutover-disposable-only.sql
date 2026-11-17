-- RPC10: executable ONLY in t404_rpc8_ci ephemeral PG17 (synthetic identities).
-- Requires caller BEGIN; never use hosted Supabase. Not approved production migration.
\set ON_ERROR_STOP on
DO $pre$
BEGIN
 IF current_database()<>'t404_rpc8_ci' OR current_user<>'postgres'
 OR current_setting('tien404.rpc8_ephemeral',true)<>'RPC8_DISPOSABLE'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'RPC10_REFUSES_HOSTED'; END IF;
 IF (SELECT count(*) FROM qa_rpc8.order_items)<>3
 OR (SELECT count(*) FROM qa_rpc8.conversations)<>3
 OR (SELECT count(*) FROM qa_rpc8.messages)<>3
 OR (SELECT count(*) FROM qa_rpc8.customers)<>0
 OR EXISTS(SELECT 1 FROM qa_rpc8.order_items WHERE store_id IS NOT NULL)
 OR EXISTS(SELECT 1 FROM qa_rpc8.conversations WHERE store_id IS NOT NULL)
 OR EXISTS(SELECT 1 FROM qa_rpc8.messages WHERE store_id IS NOT NULL)
 THEN RAISE EXCEPTION 'RPC10_SIX_SURFACE_DATA_DRIFT'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8' AND
  (tablename,policyname) IN (('order_items','order_items_manager_read'),
   ('conversations','conversations_manager_read'),('messages','messages_manager_read'))
  AND permissive='PERMISSIVE' AND cmd='SELECT')<>3
 THEN RAISE EXCEPTION 'RPC10_LEGACY_RLS_DRIFT';END IF;
END $pre$;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
LOCK TABLE qa_rpc8.order_items,qa_rpc8.conversations,qa_rpc8.messages IN ACCESS EXCLUSIVE MODE;
-- Inherited RPC9 locks and attributes Products/Orders and swaps their policies
-- in the SAME caller-controlled transaction. It is never a hosted migration.
\i qa/v152-rpc9/pg17-atomic-m2m4-disposable-only.sql
UPDATE qa_rpc8.order_items i SET store_id=o.store_id FROM qa_rpc8.orders o
 WHERE i.tenant_id=o.tenant_id AND i.order_id=o.id AND i.store_id IS NULL;
DO $item$
BEGIN
 IF (SELECT count(*) FROM qa_rpc8.order_items WHERE store_id IS NOT NULL)<>3
 OR EXISTS(SELECT 1 FROM qa_rpc8.order_items i JOIN qa_rpc8.products p
 ON p.tenant_id=i.tenant_id AND p.id=i.product_id WHERE p.store_id<>i.store_id)
 THEN RAISE EXCEPTION 'RPC10_ITEM_PARENT_STORE_MISMATCH';END IF;
END $item$;
-- Store attribution below is a fixture-only deliberate mapping; NOT a real source resolver.
UPDATE qa_rpc8.conversations c SET store_id=x.store_id FROM (VALUES
 ('aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa'::uuid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
 ('bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb'::uuid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid),
 ('cccccccc-4444-4444-8444-cccccccccccc'::uuid,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid)
)x(id,store_id) WHERE c.id=x.id AND c.store_id IS NULL;
UPDATE qa_rpc8.messages m SET store_id=c.store_id FROM qa_rpc8.conversations c
 WHERE m.tenant_id=c.tenant_id AND m.conversation_id=c.id AND m.store_id IS NULL;
DO $extra$
BEGIN
 IF (SELECT count(*) FROM qa_rpc8.conversations WHERE store_id IS NOT NULL)<>3
 OR (SELECT count(*) FROM qa_rpc8.messages WHERE store_id IS NOT NULL)<>3
 THEN RAISE EXCEPTION 'RPC10_CONVERSATION_OR_MESSAGE_MAPPING_INCOMPLETE';END IF;
END $extra$;

ALTER TABLE qa_rpc8.products ADD CONSTRAINT rpc10_products_store_row_unique UNIQUE(tenant_id,store_id,id);
ALTER TABLE qa_rpc8.orders ADD CONSTRAINT rpc10_orders_store_row_unique UNIQUE(tenant_id,store_id,id);
ALTER TABLE qa_rpc8.customers ADD CONSTRAINT rpc10_customers_store_row_unique UNIQUE(tenant_id,store_id,id);
ALTER TABLE qa_rpc8.conversations ADD CONSTRAINT rpc10_conversations_store_row_unique UNIQUE(tenant_id,store_id,id);
ALTER TABLE qa_rpc8.order_items ADD CONSTRAINT rpc10_item_order_same_store_fk FOREIGN KEY(tenant_id,store_id,order_id) REFERENCES qa_rpc8.orders(tenant_id,store_id,id);
ALTER TABLE qa_rpc8.order_items ADD CONSTRAINT rpc10_item_product_same_store_fk FOREIGN KEY(tenant_id,store_id,product_id) REFERENCES qa_rpc8.products(tenant_id,store_id,id);
ALTER TABLE qa_rpc8.orders ADD CONSTRAINT rpc10_order_customer_same_store_fk FOREIGN KEY(tenant_id,store_id,customer_id) REFERENCES qa_rpc8.customers(tenant_id,store_id,id);
ALTER TABLE qa_rpc8.messages ADD CONSTRAINT rpc10_message_conversation_same_store_fk FOREIGN KEY(tenant_id,store_id,conversation_id) REFERENCES qa_rpc8.conversations(tenant_id,store_id,id);
ALTER TABLE qa_rpc8.products ADD CONSTRAINT rpc10_products_store_tenant_fk FOREIGN KEY(tenant_id,store_id) REFERENCES qa_rpc8.stores(tenant_id,id);
ALTER TABLE qa_rpc8.orders ADD CONSTRAINT rpc10_orders_store_tenant_fk FOREIGN KEY(tenant_id,store_id) REFERENCES qa_rpc8.stores(tenant_id,id);
ALTER TABLE qa_rpc8.customers ADD CONSTRAINT rpc10_customers_store_tenant_fk FOREIGN KEY(tenant_id,store_id) REFERENCES qa_rpc8.stores(tenant_id,id);
ALTER TABLE qa_rpc8.order_items ADD CONSTRAINT rpc10_order_items_store_tenant_fk FOREIGN KEY(tenant_id,store_id) REFERENCES qa_rpc8.stores(tenant_id,id);
ALTER TABLE qa_rpc8.conversations ADD CONSTRAINT rpc10_conversations_store_tenant_fk FOREIGN KEY(tenant_id,store_id) REFERENCES qa_rpc8.stores(tenant_id,id);
ALTER TABLE qa_rpc8.messages ADD CONSTRAINT rpc10_messages_store_tenant_fk FOREIGN KEY(tenant_id,store_id) REFERENCES qa_rpc8.stores(tenant_id,id);
ALTER TABLE qa_rpc8.products ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE qa_rpc8.orders ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE qa_rpc8.customers ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE qa_rpc8.order_items ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE qa_rpc8.conversations ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE qa_rpc8.messages ALTER COLUMN store_id SET NOT NULL;
-- The legacy UNIQUE(tenant_id,sku) prevents same SKU in different Stores.
ALTER TABLE qa_rpc8.products DROP CONSTRAINT products_tenant_id_sku_key;
ALTER TABLE qa_rpc8.products ADD CONSTRAINT rpc10_tenant_store_sku_unique UNIQUE(tenant_id,store_id,sku);

DROP POLICY order_items_manager_read ON qa_rpc8.order_items;
CREATE POLICY rpc10_item_store_read ON qa_rpc8.order_items FOR SELECT TO qa_rpc8_user USING (
 store_id IS NOT NULL AND EXISTS(SELECT 1 FROM qa_rpc8.store_memberships sm
 WHERE sm.tenant_id=order_items.tenant_id AND sm.store_id=order_items.store_id
 AND sm.user_id=qa_rpc8.actor_id() AND sm.active AND sm.role IN('owner','manager')
 AND EXISTS(SELECT 1 FROM qa_rpc8.tenant_memberships tm WHERE tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active))
);
DROP POLICY conversations_manager_read ON qa_rpc8.conversations;
CREATE POLICY rpc10_conversation_store_read ON qa_rpc8.conversations FOR SELECT TO qa_rpc8_user USING (
 store_id IS NOT NULL AND EXISTS(SELECT 1 FROM qa_rpc8.store_memberships sm
 WHERE sm.tenant_id=conversations.tenant_id AND sm.store_id=conversations.store_id
 AND sm.user_id=qa_rpc8.actor_id() AND sm.active AND sm.role IN('owner','manager')
 AND EXISTS(SELECT 1 FROM qa_rpc8.tenant_memberships tm WHERE tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active))
);
DROP POLICY messages_manager_read ON qa_rpc8.messages;
CREATE POLICY rpc10_message_store_read ON qa_rpc8.messages FOR SELECT TO qa_rpc8_user USING (
 store_id IS NOT NULL AND EXISTS(SELECT 1 FROM qa_rpc8.store_memberships sm
 WHERE sm.tenant_id=messages.tenant_id AND sm.store_id=messages.store_id
 AND sm.user_id=qa_rpc8.actor_id() AND sm.active AND sm.role IN('owner','manager')
 AND EXISTS(SELECT 1 FROM qa_rpc8.tenant_memberships tm WHERE tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active))
);

DO $post$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
 AND tablename IN('products','orders','customers','order_items','conversations','messages'))<>6
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
 AND policyname IN('products_member_read','orders_manager_read','customers_manager_read',
 'order_items_manager_read','conversations_manager_read','messages_manager_read'))<>0
 OR (SELECT count(*) FROM pg_constraint WHERE connamespace='qa_rpc8'::regnamespace
 AND conname LIKE 'rpc10_%' AND contype='f')<>10
 THEN RAISE EXCEPTION 'RPC10_POLICY_OR_FK_CUTOVER_INCOMPLETE';END IF;
END $post$;
