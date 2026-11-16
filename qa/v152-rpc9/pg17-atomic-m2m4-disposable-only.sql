-- TIEN404 V15.2 ADV.6C RPC.9 — CANDIDATE ATOMIC M2 + M4
-- DISPOSABLE PG17 ONLY: NEVER RUN ON HOSTED SUPABASE.
-- CALL ONLY INSIDE EXPLICIT BEGIN/COMMIT OR BEGIN/ROLLBACK in CI.
-- This tests transactional RLS replacement + atomic synthetic row assignment.
-- NOT approved production migration; not a validated real Owner ledger.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'t404_rpc8_ci'
  OR current_user<>'postgres'
  OR current_setting('tien404.rpc8_ephemeral',true)<>'RPC8_DISPOSABLE'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'RPC9_REFUSES_HOSTED_MIGRATION';END IF;
 IF to_regclass('qa_rpc8.stores') IS NULL
 OR to_regclass('qa_rpc8.store_memberships') IS NULL
 THEN RAISE EXCEPTION 'RPC9_M1_NOT_APPLIED';END IF;
 IF (SELECT count(*) FROM qa_rpc8.products)<>3
  OR (SELECT count(*) FROM qa_rpc8.orders)<>3
  OR (SELECT count(*) FROM qa_rpc8.customers)<>0
  OR (SELECT count(*) FROM qa_rpc8.stores)<>3
  OR (SELECT count(*) FROM qa_rpc8.store_memberships)<>3
 THEN RAISE EXCEPTION 'RPC9_DATA_OR_MEMBERSHIP_DRIFT';END IF;
 IF (SELECT count(*) FROM qa_rpc8.products WHERE store_id IS NOT NULL)<>0
 OR (SELECT count(*) FROM qa_rpc8.orders WHERE store_id IS NOT NULL)<>0
 THEN RAISE EXCEPTION 'RPC9_UNEXPECTED_PARTIAL_BACKFILL';END IF;
 IF (SELECT count(*) FROM pg_policies
   WHERE schemaname='qa_rpc8' AND tablename IN ('products','orders','customers'))<>3
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
   AND ((tablename='products' AND policyname='products_member_read' AND cmd='SELECT' AND permissive='PERMISSIVE')
   OR (tablename='orders' AND policyname='orders_manager_read' AND cmd='SELECT' AND permissive='PERMISSIVE')
   OR (tablename='customers' AND policyname='customers_manager_read' AND cmd='SELECT' AND permissive='PERMISSIVE')))<>3
 THEN RAISE EXCEPTION 'RPC9_OLD_POLICY_INVENTORY_DRIFT';END IF;
 IF (SELECT count(*) FROM qa_rpc8.products
    WHERE (tenant_id='11111111-1111-4111-8111-111111111111' AND
      id IN('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'))
     OR (tenant_id='22222222-2222-4222-8222-222222222222'
      AND id='cccccccc-1111-4111-8111-cccccccccccc'))<>3
 OR (SELECT count(*) FROM qa_rpc8.orders
    WHERE (tenant_id='11111111-1111-4111-8111-111111111111' AND
      id IN('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'))
     OR (tenant_id='22222222-2222-4222-8222-222222222222'
      AND id='cccccccc-2222-4222-8222-cccccccccccc'))<>3
 THEN RAISE EXCEPTION 'RPC9_SYNTHETIC_OWNER_MAPPING_DRIFT';END IF;
END $guard$;

-- ACCESS EXCLUSIVE blocks new readers until commit. This is NOT a
-- zero-downtime certificate: lock wait and existing reader latency need
-- authorized hosted load tests. Keep lock/statement timeout fail-closed.
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
LOCK TABLE qa_rpc8.products,qa_rpc8.orders,qa_rpc8.customers
 IN ACCESS EXCLUSIVE MODE;
DO $cutover$
DECLARE n_products integer; n_orders integer;
BEGIN
 UPDATE qa_rpc8.products p
 SET store_id=x.store_id
 FROM (VALUES
 ('11111111-1111-4111-8111-111111111111'::uuid,'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'::uuid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
 ('11111111-1111-4111-8111-111111111111'::uuid,'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'::uuid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid),
 ('22222222-2222-4222-8222-222222222222'::uuid,'cccccccc-1111-4111-8111-cccccccccccc'::uuid,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid)
 ) x(tenant_id,id,store_id)
 WHERE p.tenant_id=x.tenant_id AND p.id=x.id AND p.store_id IS NULL;
 GET DIAGNOSTICS n_products=ROW_COUNT;
 IF n_products<>3 THEN RAISE EXCEPTION 'RPC9_PRODUCTS_OWNER_BACKFILL_NOT_EXACT';END IF;
 UPDATE qa_rpc8.orders o
 SET store_id=x.store_id
 FROM (VALUES
 ('11111111-1111-4111-8111-111111111111'::uuid,'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'::uuid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
 ('11111111-1111-4111-8111-111111111111'::uuid,'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'::uuid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid),
 ('22222222-2222-4222-8222-222222222222'::uuid,'cccccccc-2222-4222-8222-cccccccccccc'::uuid,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid)
 ) x(tenant_id,id,store_id)
 WHERE o.tenant_id=x.tenant_id AND o.id=x.id AND o.store_id IS NULL;
 GET DIAGNOSTICS n_orders=ROW_COUNT;
 IF n_orders<>3 THEN RAISE EXCEPTION 'RPC9_ORDERS_OWNER_BACKFILL_NOT_EXACT';END IF;
 IF EXISTS(SELECT 1 FROM qa_rpc8.products p
    LEFT JOIN qa_rpc8.stores s ON s.tenant_id=p.tenant_id AND s.id=p.store_id
    WHERE s.id IS NULL)
 OR EXISTS(SELECT 1 FROM qa_rpc8.orders o
    LEFT JOIN qa_rpc8.stores s ON s.tenant_id=o.tenant_id AND s.id=o.store_id
    WHERE s.id IS NULL)
 THEN RAISE EXCEPTION 'RPC9_ORPHAN_STORE_SCOPE';END IF;
END $cutover$;

-- Must replace (DROP + CREATE) *all* Tenant-only permissive policies
-- in the same transaction before external readers can acquire locks.
DROP POLICY products_member_read ON qa_rpc8.products;
DROP POLICY orders_manager_read ON qa_rpc8.orders;
DROP POLICY customers_manager_read ON qa_rpc8.customers;
CREATE POLICY products_store_scoped_read ON qa_rpc8.products
 FOR SELECT TO qa_rpc8_user
 USING(store_id IS NOT NULL AND EXISTS (
 SELECT 1 FROM qa_rpc8.store_memberships sm
 WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
  AND sm.user_id=qa_rpc8.actor_id() AND sm.active
  AND EXISTS (SELECT 1 FROM qa_rpc8.tenant_memberships tm
   WHERE tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active)
 ));
CREATE POLICY orders_store_manager_read ON qa_rpc8.orders
 FOR SELECT TO qa_rpc8_user
 USING(store_id IS NOT NULL AND EXISTS (
 SELECT 1 FROM qa_rpc8.store_memberships sm
 WHERE sm.tenant_id=orders.tenant_id AND sm.store_id=orders.store_id
  AND sm.user_id=qa_rpc8.actor_id() AND sm.active AND sm.role IN ('owner','manager')
  AND EXISTS (SELECT 1 FROM qa_rpc8.tenant_memberships tm
   WHERE tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active)
 ));
CREATE POLICY customers_store_manager_read ON qa_rpc8.customers
 FOR SELECT TO qa_rpc8_user
 USING(store_id IS NOT NULL AND EXISTS (
 SELECT 1 FROM qa_rpc8.store_memberships sm
 WHERE sm.tenant_id=customers.tenant_id AND sm.store_id=customers.store_id
  AND sm.user_id=qa_rpc8.actor_id() AND sm.active AND sm.role IN ('owner','manager')
  AND EXISTS (SELECT 1 FROM qa_rpc8.tenant_memberships tm
   WHERE tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active)
 ));
DO $after$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
   AND tablename IN ('products','orders','customers'))<>3
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
   AND policyname IN ('products_store_scoped_read','orders_store_manager_read','customers_store_manager_read'))<>3
 THEN RAISE EXCEPTION 'RPC9_NEW_POLICY_SET_INCOMPLETE';END IF;
END $after$;
