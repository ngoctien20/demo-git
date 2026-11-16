-- V16.10 DISPOSABLE PG17 test, *not* hosted JWT tests.
-- All assertions run through SET LOCAL ROLE t404_authenticated (no BYPASSRLS),
-- with a synthetic current_setting claim. This does NOT verify JWT signatures.
DO $guard$
BEGIN IF current_database() NOT IN ('t404_v1610_disposable','t404_v1610_restored')
 OR inet_server_addr() IS DISTINCT FROM inet '127.0.0.1'
 THEN RAISE EXCEPTION 'LOCAL_DISPOSABLE_ONLY'; END IF; END $guard$;
-- Positive checks: admin verifies synthetic fixtures/constraints prior to role testing.
DO $admin$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM qa.stores;
 IF n<>3 THEN RAISE EXCEPTION 'FAIL: fixture store count %',n; END IF;
 SELECT count(*) INTO n FROM qa.products WHERE sku='SAME01';
 IF n<>3 THEN RAISE EXCEPTION 'FAIL: tenant+Store SKU unique requirement';END IF;
 SELECT count(DISTINCT price_vnd) INTO n FROM qa.products WHERE sku='SAME01';
 IF n<>3 THEN RAISE EXCEPTION 'FAIL: independent Shop pricing'; END IF;
 SELECT count(*) INTO n FROM qa.products WHERE tenant_id='00000000-0000-4000-8000-000000000011';
 IF n<>2 THEN RAISE EXCEPTION 'FAIL: SAME Tenant A/B'; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='qa' AND c.relname IN ('products','orders','customers','store_memberships')
 AND c.relrowsecurity;
 IF n<>4 THEN RAISE EXCEPTION 'FAIL: RLS not enabled';END IF;
END $admin$;
-- Owner A (Tenant1 Store A) can only see A and cannot write B or relabel A=>B.
BEGIN;
SET LOCAL ROLE t404_authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-0000000000a1',true);
DO $owner_a$
DECLARE n int; blocked boolean:=false;
BEGIN
 IF current_user<>'t404_authenticated' THEN RAISE EXCEPTION 'FAIL: privileged identity not dropped';END IF;
 SELECT count(*) INTO n FROM qa.store_memberships;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: member scope A';END IF;
 SELECT count(*) INTO n FROM qa.products;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: A sees cross Store products';END IF;
 SELECT price_vnd INTO n FROM qa.products WHERE sku='SAME01';
 IF n<>159000 THEN RAISE EXCEPTION 'FAIL: A price wrong %',n;END IF;
 SELECT count(*) INTO n FROM qa.customers;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: A sees cross Store customer'; END IF;
 SELECT count(*) INTO n FROM qa.orders;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: A sees cross Store order';END IF;
 UPDATE qa.products SET stock=11 WHERE id='20000000-0000-4000-8000-0000000000b1';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: A updated Shop B';END IF;
 UPDATE qa.products SET stock=10 WHERE id='20000000-0000-4000-8000-0000000000a1';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: A cannot update own product';END IF;
 BEGIN
  UPDATE qa.products SET store_id='00000000-0000-4000-8000-0000000000b1'
  WHERE id='20000000-0000-4000-8000-0000000000a1';
 EXCEPTION WHEN insufficient_privilege THEN blocked=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: A rekeyed product to Store B'; END IF;
 blocked=false;
 BEGIN
  INSERT INTO qa.products VALUES
  ('20000000-0000-4000-8000-000000000099',
   '00000000-0000-4000-8000-000000000011',
   '00000000-0000-4000-8000-0000000000b1','HACK',1,1);
 EXCEPTION WHEN insufficient_privilege THEN blocked=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: A inserted B product';END IF;
 blocked=false;
 BEGIN
  INSERT INTO qa.orders VALUES
  ('40000000-0000-4000-8000-000000000099',
   '00000000-0000-4000-8000-000000000011',
   '00000000-0000-4000-8000-0000000000b1',
   '30000000-0000-4000-8000-0000000000b1',1);
 EXCEPTION WHEN insufficient_privilege THEN blocked=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: A inserted B order';END IF;
END $owner_a$;
ROLLBACK;
-- Owner B same Tenant, B-only 209000.
BEGIN;
SET LOCAL ROLE t404_authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-0000000000b1',true);
DO $owner_b$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM qa.products;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: B cross Store products';END IF;
 SELECT price_vnd INTO n FROM qa.products WHERE sku='SAME01';
 IF n<>209000 THEN RAISE EXCEPTION 'FAIL: B price wrong %',n;END IF;
 SELECT count(*) INTO n FROM qa.orders;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: B cross Store order';END IF;
 SELECT count(*) INTO n FROM qa.customers;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: B cross Store customer';END IF;
 UPDATE qa.products SET price_vnd=1 WHERE id='20000000-0000-4000-8000-0000000000a1';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: B modified A price';END IF;
END $owner_b$;
ROLLBACK;
-- Owner C different Tenant can never see A/B.
BEGIN;
SET LOCAL ROLE t404_authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-0000000000c1',true);
DO $owner_c$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM qa.products;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: cross tenant product';END IF;
 SELECT price_vnd INTO n FROM qa.products WHERE sku='SAME01';
 IF n<>259000 THEN RAISE EXCEPTION 'FAIL: Shop C product price %',n;END IF;
 SELECT count(*) INTO n FROM qa.orders;
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: cross tenant orders';END IF;
END $owner_c$;
ROLLBACK;
-- Missing/malformed JWT-claim (while role is authenticated) must see zero.
BEGIN;
SET LOCAL ROLE t404_authenticated;
DO $no_claim$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM qa.products;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: anonymous claim exposed product';END IF;
 SELECT count(*) INTO n FROM qa.orders;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: anonymous claim exposed order';END IF;
END $no_claim$;
ROLLBACK;
-- Role revocation tested while admin transaction changes only ephemeral fixture.
BEGIN;
UPDATE qa.store_memberships SET active=false
 WHERE store_id='00000000-0000-4000-8000-0000000000b1';
SET LOCAL ROLE t404_authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-0000000000b1',true);
DO $revoked$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM qa.products;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: revoked B still sees products';END IF;
 SELECT count(*) INTO n FROM qa.orders;
 IF n<>0 THEN RAISE EXCEPTION 'FAIL: revoked B still sees orders';END IF;
END $revoked$;
ROLLBACK;
-- Even privileged server-side business INSERT must use composite Store customer FK.
DO $fk$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  INSERT INTO qa.orders VALUES
  ('40000000-0000-4000-8000-000000000098',
   '00000000-0000-4000-8000-000000000011',
   '00000000-0000-4000-8000-0000000000a1',
   '30000000-0000-4000-8000-0000000000b1',1);
 EXCEPTION WHEN foreign_key_violation THEN blocked=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: cross-store Customer FK accepted';END IF;
END $fk$;
SELECT 'DISPOSABLE_PG_STORE_RLS_ASSERTIONS_PASS' AS qa_result;
