-- TIEN404 V19.8.3 -- Run only against the companion GitHub Actions ephemeral postgres:17.
-- All auth principals and JWT claims below are fake SQL fixture values.
\set ON_ERROR_STOP on
\echo === OWNER A MOCK CLAIM: store A visible, store B hidden ===
SET ROLE qa_authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
SELECT qa1983.assert_count('A: own product', (SELECT count(*) FROM qa1983.products WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1);
SELECT qa1983.assert_count('A: other product denied', (SELECT count(*) FROM qa1983.products WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0);
SELECT qa1983.assert_count('A: own order', (SELECT count(*) FROM qa1983.orders WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1);
SELECT qa1983.assert_count('A: other order denied', (SELECT count(*) FROM qa1983.orders WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0);
SELECT qa1983.assert_count('A: own order item', (SELECT count(*) FROM qa1983.order_items WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1);
SELECT qa1983.assert_count('A: other order item denied', (SELECT count(*) FROM qa1983.order_items WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0);
SELECT qa1983.assert_count('A: own conversation', (SELECT count(*) FROM qa1983.conversations WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1);
SELECT qa1983.assert_count('A: other conversation denied', (SELECT count(*) FROM qa1983.conversations WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0);
SELECT qa1983.assert_count('A: own message', (SELECT count(*) FROM qa1983.messages WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1);
SELECT qa1983.assert_count('A: other message denied', (SELECT count(*) FROM qa1983.messages WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0);
SELECT qa1983.assert_count('A: own exact SKU and price', (SELECT count(*) FROM qa1983.products WHERE sku='F01' AND price_vnd=159000), 1);
SELECT qa1983.assert_count('A: no Store B SKU pricing', (SELECT count(*) FROM qa1983.products WHERE sku='F01' AND price_vnd=189000), 0);

\echo === OWNER B MOCK CLAIM: reverse isolation ===
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
SELECT qa1983.assert_count('B: own product', (SELECT count(*) FROM qa1983.products WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 1);
SELECT qa1983.assert_count('B: other product denied', (SELECT count(*) FROM qa1983.products WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0);
SELECT qa1983.assert_count('B: own order', (SELECT count(*) FROM qa1983.orders WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 1);
SELECT qa1983.assert_count('B: other order denied', (SELECT count(*) FROM qa1983.orders WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0);
SELECT qa1983.assert_count('B: own order item', (SELECT count(*) FROM qa1983.order_items WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 1);
SELECT qa1983.assert_count('B: other order item denied', (SELECT count(*) FROM qa1983.order_items WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0);
SELECT qa1983.assert_count('B: own conversation', (SELECT count(*) FROM qa1983.conversations WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 1);
SELECT qa1983.assert_count('B: other conversation denied', (SELECT count(*) FROM qa1983.conversations WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0);
SELECT qa1983.assert_count('B: own message', (SELECT count(*) FROM qa1983.messages WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 1);
SELECT qa1983.assert_count('B: other message denied', (SELECT count(*) FROM qa1983.messages WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0);
SELECT qa1983.assert_count('B: exact SKU and price', (SELECT count(*) FROM qa1983.products WHERE sku='F01' AND price_vnd=189000), 1);
SELECT qa1983.assert_count('B: Store A price unavailable', (SELECT count(*) FROM qa1983.products WHERE sku='F01' AND price_vnd=159000), 0);

\echo === TENANT-ONLY MEMBER DENIED ALL STORE DATA ===
SELECT set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
SELECT qa1983.assert_count('member without Store: products', (SELECT count(*) FROM qa1983.products), 0);
SELECT qa1983.assert_count('member without Store: orders', (SELECT count(*) FROM qa1983.orders), 0);
SELECT qa1983.assert_count('member without Store: messages', (SELECT count(*) FROM qa1983.messages), 0);

\echo === REVOKED STORE MEMBERSHIP DENIED ===
SELECT set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
SELECT qa1983.assert_count('revoked Store role: products', (SELECT count(*) FROM qa1983.products), 0);
SELECT qa1983.assert_count('revoked Store role: orders', (SELECT count(*) FROM qa1983.orders), 0);

\echo === UNASSIGNED AND MISSING CLAIM DENIED ===
SELECT set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-000000000005',false);
SELECT qa1983.assert_count('unknown user: products', (SELECT count(*) FROM qa1983.products), 0);
SELECT set_config('request.jwt.claim.sub','',false);
SELECT qa1983.assert_count('missing mock JWT claim: products', (SELECT count(*) FROM qa1983.products), 0);

\echo === OWNER A INSERT ALLOWED; WRONG STORE INSERT/UPDATE BLOCKED ===
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
INSERT INTO qa1983.products(id,tenant_id,store_id,sku,name,price_vnd,stock) VALUES (
 'aaaaaaaa-6666-6666-6666-666666666666',
 '00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'F02','SYN_A_F02',99000,2
);
SELECT qa1983.assert_count('A: own insert works', (SELECT count(*) FROM qa1983.products), 2);
DO $$
BEGIN
 BEGIN
  INSERT INTO qa1983.products(id,tenant_id,store_id,sku,name,price_vnd,stock)
  VALUES ('aaaaaaaa-7777-7777-7777-777777777777','00000000-0000-0000-0000-000000000001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','F99','UNAUTHORIZED',99999,1);
  RAISE EXCEPTION 'FAIL: cross-Store INSERT unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: cross-Store INSERT denied by RLS'; END;
END $$;
DO $$
BEGIN
 BEGIN
  UPDATE qa1983.products SET store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  WHERE id='aaaaaaaa-6666-6666-6666-666666666666';
  RAISE EXCEPTION 'FAIL: cross-Store UPDATE unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: cross-Store UPDATE denied by RLS'; END;
END $$;
SELECT qa1983.assert_count('A: product remains in A', (SELECT count(*) FROM qa1983.products WHERE sku='F02' AND store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1);

\echo === NEGATIVE CONTROL: ADDING TENANT POLICY VIA OR LEAKS B ===
RESET ROLE;
CREATE POLICY intentionally_unsafe_tenant_policy ON qa1983.products
 FOR SELECT TO qa_authenticated
 USING (tenant_id='00000000-0000-0000-0000-000000000001');
SET ROLE qa_authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
SELECT qa1983.assert_count('unsafe OR policy exposes Store B (expected negative control)',
 (SELECT count(*) FROM qa1983.products WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),1);
RESET ROLE;
DROP POLICY intentionally_unsafe_tenant_policy ON qa1983.products;
SET ROLE qa_authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
SELECT qa1983.assert_count('unsafe tenant policy removed, Store B hidden',
 (SELECT count(*) FROM qa1983.products WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),0);

\echo === ANON HAS NO READ PERMISSION ===
RESET ROLE;
SET ROLE qa_anon;
DO $$
BEGIN
 BEGIN
   PERFORM 1 FROM qa1983.products LIMIT 1;
   RAISE EXCEPTION 'FAIL: anonymous SELECT unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: anonymous SELECT denied'; END;
END $$;

\echo === CROSS STORE FK DENY EVEN AS DATABASE OWNER ===
RESET ROLE;
DO $$
BEGIN
 BEGIN
  INSERT INTO qa1983.order_items VALUES (
    'aaaaaaaa-8888-8888-8888-888888888888',
    '00000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-2222-2222-2222-222222222222',
    'bbbbbbbb-1111-1111-1111-111111111111',1);
  RAISE EXCEPTION 'FAIL: cross-Store order/product FK unexpectedly allowed';
 EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS: order/product cross-Store FK denied'; END;
END $$;
DO $$
BEGIN
 BEGIN
  INSERT INTO qa1983.messages VALUES (
    'aaaaaaaa-9999-9999-9999-999999999999',
    '00000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-3333-3333-3333-333333333333','inbound');
  RAISE EXCEPTION 'FAIL: cross-Store message/conversation FK unexpectedly allowed';
 EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS: message/conversation cross-Store FK denied'; END;
END $$;
\echo TIEN404_V1983_POSTGRES_RLS_NEGATIVE_POSITIVE_SQL_COMPLETED
