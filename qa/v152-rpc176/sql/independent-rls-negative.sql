-- RPC17.6 independent PostgreSQL 17 negative RLS QA in disposable CI ONLY.
-- Synthetic claim GUC in SET LOCAL is NOT a genuine Supabase JWT.
\set ON_ERROR_STOP on

-- Owner A: sees only Store A in same Tenant and none of B/C.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),1,'A product visibility exactly one');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders),1,'A order visibility exactly one');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.stores),1,'A store authority exactly one');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products WHERE sku='SKU-B'),0,'A cannot read B product');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders WHERE store_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),0,'A cannot read B order');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products WHERE sku='SKU-C'),0,'A cannot read Tenant C product');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.store_memberships WHERE store_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),0,'A cannot inspect B membership');
INSERT INTO rpc176_qa.products(id,tenant_id,store_id,sku)
 VALUES('cccccccc-cccc-4ccc-8ccc-ccccccccccc4','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','SKU-A-NEW');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),2,'A owner can insert own scoped product in disposable transaction');
DO $$
BEGIN
  BEGIN
    INSERT INTO rpc176_qa.products(id,tenant_id,store_id,sku)
    VALUES('cccccccc-cccc-4ccc-8ccc-ccccccccccc5','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','ILLEGAL-FROM-A');
    RAISE EXCEPTION 'RPC176 QA FAILED: Store A inserted Store B product';
  EXCEPTION WHEN SQLSTATE '42501' THEN RAISE NOTICE 'RPC176 QA PASS: cross-store write denied by WITH CHECK'; END;
END $$;
ROLLBACK;

-- Owner B: sees B only, even though shares Tenant with A.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),1,'B product visibility exactly one');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders),1,'B order visibility exactly one');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products WHERE sku='SKU-A'),0,'B cannot read A product');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders WHERE store_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),0,'B cannot read A order');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products WHERE sku='SKU-C'),0,'B cannot read Tenant C');
ROLLBACK;

-- Tenant manager without Store membership: no Store access.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.tenant_memberships),1,'tenant manager has Tenant membership');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.stores),0,'tenant manager lacks Store authority');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),0,'tenant manager lacks products without Store');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders),0,'tenant manager lacks orders without Store');
ROLLBACK;

-- Staff can read assigned Store product but cannot read orders or insert products.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),1,'Store A staff sees only A product');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders),0,'staff cannot read manager/owner orders');
DO $$
BEGIN
  BEGIN
    INSERT INTO rpc176_qa.products(id,tenant_id,store_id,sku)
    VALUES('cccccccc-cccc-4ccc-8ccc-ccccccccccc6','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','ILLEGAL-STAFF-WRITE');
    RAISE EXCEPTION 'RPC176 QA FAILED: staff inserted product';
  EXCEPTION WHEN SQLSTATE '42501' THEN RAISE NOTICE 'RPC176 QA PASS: staff write denied'; END;
END $$;
ROLLBACK;

-- Revoked membership cannot read despite remaining Tenant member.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),0,'revoked Store member cannot read product');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders),0,'revoked Store member cannot read order');
ROLLBACK;

-- Tenant C isolated from A and B.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),1,'Tenant C sees only its own product');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders),1,'Tenant C sees only its own order');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products WHERE sku IN ('SKU-A','SKU-B')),0,'Tenant C cannot read A/B');
ROLLBACK;

-- Missing JWT claim and spoofable user_metadata are not authorization.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),0,'missing auth UID denies');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders),0,'missing auth UID denies orders');
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
SET LOCAL request.jwt.claim.user_metadata = '{"role":"owner","store_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"}';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),0,'forged user metadata cannot elevate tenant-only manager');
ROLLBACK;

-- Revoke Store B membership live within disposable DB then confirm failclosed.
BEGIN;
UPDATE rpc176_qa.store_memberships SET active=false
WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),0,'membership revoked while session remains');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders),0,'revocation denies orders');
ROLLBACK;

-- Rotating Store authority version invalidates stale memberships.
BEGIN;
UPDATE rpc176_qa.stores SET authority_version=3
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),0,'stale authority version cannot read');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders),0,'stale authority version cannot read orders');
ROLLBACK;

-- Disabled Store cannot be read.
BEGIN;
UPDATE rpc176_qa.stores SET active=false WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.products),0,'disabled Store hides products');
SELECT rpc176_qa.assert_count((SELECT COUNT(*) FROM rpc176_qa.orders),0,'disabled Store hides orders');
ROLLBACK;

-- Final explicit schema hardening assertions (postgres QA superuser examines metadata ONLY).
SELECT rpc176_qa.assert_count(
 (SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='rpc176_qa' AND c.relname IN
 ('tenants','tenant_memberships','stores','store_memberships','products','orders')
  AND c.relrowsecurity AND c.relforcerowsecurity),6,
 'all six disposable tables have RLS and FORCE RLS');
SELECT 'RPC176_DISPOSABLE_RLS_NEGATIVE_QA_SUCCESS_NO_REAL_JWT' AS status;
