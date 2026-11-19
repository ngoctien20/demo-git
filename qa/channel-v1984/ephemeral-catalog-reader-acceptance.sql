-- TIEN404 V19.8.4 -- SQL integration acceptance on EPHEMERAL PostgreSQL ONLY.
\set ON_ERROR_STOP on
\echo '== qa1984 A/B read-only reader: mock principal and real PostgreSQL RLS =='
SET ROLE qa_authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
SELECT qa1983.assert_count('Owner A exact Store A SKU price',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01') WHERE price_vnd=159000 AND stock_on_hand=5 AND currency='VND'),1);
SELECT qa1983.assert_count('Owner A cannot read Store B through reader',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','F01')),0);
SELECT qa1983.assert_count('Owner A cannot read Store B direct snapshot',
 (SELECT count(*) FROM qa1984.catalog_snapshots WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),0);
SELECT qa1983.assert_count('Owner A exact sku missing',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F99')),0);
SELECT qa1983.assert_count('Owner A SQL-like sku text denied',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01'' OR 1=1 --')),0);
SELECT qa1983.assert_count('Owner A wrong tenant denied',
 (SELECT count(*) FROM qa1984.read_catalog('ffffffff-ffff-ffff-ffff-ffffffffffff',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01')),0);

SELECT set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
SELECT qa1983.assert_count('Owner B exact Store B SKU price',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','F01') WHERE price_vnd=189000 AND stock_on_hand=9 AND currency='VND'),1);
SELECT qa1983.assert_count('Owner B cannot read Store A through reader',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01')),0);
SELECT qa1983.assert_count('Owner B cannot read Store A direct snapshot',
 (SELECT count(*) FROM qa1984.catalog_snapshots WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),0);

SELECT set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
SELECT qa1983.assert_count('Tenant member without Store membership denied',
 (SELECT count(*) FROM qa1984.catalog_snapshots),0);
SELECT qa1983.assert_count('Tenant member reader denied',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01')),0);

SELECT set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
SELECT qa1983.assert_count('Revoked Store owner reader denied',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01')),0);

SELECT set_config('request.jwt.claim.sub','',false);
SELECT qa1983.assert_count('No mock claim reader denied',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01')),0);
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);

\echo '== negative fixtures: stale/future/invalid/inconsistent source all blocked =='
RESET ROLE;
UPDATE qa1984.catalog_snapshots SET verified_at=statement_timestamp()-interval '31 minutes'
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE qa_authenticated;
SELECT qa1983.assert_count('stale snapshot denied reader',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01')),0);
SELECT qa1983.assert_count('stale snapshot denied direct SELECT',
 (SELECT count(*) FROM qa1984.catalog_snapshots WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),0);

RESET ROLE;
UPDATE qa1984.catalog_snapshots SET verified_at=statement_timestamp()+interval '10 minutes'
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE qa_authenticated;
SELECT qa1983.assert_count('future snapshot denied',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01')),0);

RESET ROLE;
UPDATE qa1984.catalog_snapshots SET verified_at=statement_timestamp()-interval '10 seconds',price_vnd=0
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE qa_authenticated;
SELECT qa1983.assert_count('zero price denied',
 (SELECT count(*) FROM qa1984.catalog_snapshots WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),0);

RESET ROLE;
UPDATE qa1984.catalog_snapshots SET price_vnd=159000,stock_on_hand=-1
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE qa_authenticated;
SELECT qa1983.assert_count('negative stock denied',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01')),0);

RESET ROLE;
UPDATE qa1984.catalog_snapshots SET stock_on_hand=4
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE qa_authenticated;
SELECT qa1983.assert_count('catalog stock mismatch denied',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01')),0);

RESET ROLE;
UPDATE qa1984.catalog_snapshots SET stock_on_hand=5,price_vnd=169000
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE qa_authenticated;
SELECT qa1983.assert_count('catalog price mismatch denied',
 (SELECT count(*) FROM qa1984.catalog_snapshots WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),0);

RESET ROLE;
UPDATE qa1984.catalog_snapshots SET price_vnd=159000,source_kind='UNVERIFIED'
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE qa_authenticated;
SELECT qa1983.assert_count('unverified catalog origin denied',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01')),0);

RESET ROLE;
UPDATE qa1984.catalog_snapshots SET source_kind='QA_CATALOG_VERIFIED',source_revision='ATTACK_REV'
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE qa_authenticated;
SELECT qa1983.assert_count('invalid catalog revision denied',
 (SELECT count(*) FROM qa1984.catalog_snapshots WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),0);

RESET ROLE;
UPDATE qa1984.catalog_snapshots SET source_revision='V1984_A_001',verified_at=NULL
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE qa_authenticated;
SELECT qa1983.assert_count('missing verification timestamp denied',
 (SELECT count(*) FROM qa1984.catalog_snapshots WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),0);

RESET ROLE;
UPDATE qa1984.catalog_snapshots SET verified_at=statement_timestamp()-interval '10 seconds',stock_on_hand=0
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
UPDATE qa1983.products SET stock=0
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND sku='F01';
SET ROLE qa_authenticated;
SELECT qa1983.assert_count('zero stock is valid read but not purchasable',
 (SELECT count(*) FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01') WHERE stock_on_hand=0),1);

\echo '== read-only: no grants to modify catalog snapshot =='
DO $$
BEGIN
 BEGIN
  UPDATE qa1984.catalog_snapshots SET price_vnd=1 WHERE sku='F01';
  RAISE EXCEPTION 'FAIL: authenticated snapshot price UPDATE unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: snapshot write denied'; END;
END $$;

\echo '== unauthenticated may not call function =='
RESET ROLE;
SET ROLE qa_anon;
DO $$
BEGIN
 BEGIN
  PERFORM 1 FROM qa1984.read_catalog('00000000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','F01');
  RAISE EXCEPTION 'FAIL: anonymous access unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: anonymous reader denied'; END;
END $$;
RESET ROLE;
\echo TIEN404_V1984_POSTGRES_CATALOG_READER_TESTS_COMPLETE
