-- V18.0-P0 / RPC17.8C — exact PostgreSQL 17 role/RLS acceptance.
-- Synthetic users, memberships and "request.jwt.claim.sub" ONLY. Not real
-- Supabase JWT issuer verification, not hosted migration and not production QA.
\set ON_ERROR_STOP on

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_class c
  JOIN pg_namespace s ON s.oid=c.relnamespace
  WHERE s.nspname='rpc178c_ci' AND c.relkind='r'
    AND c.relrowsecurity AND c.relforcerowsecurity;
  IF n <> 5 THEN RAISE EXCEPTION 'FAIL: 5/5 RLS+FORCE RLS expected, got %',n; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname='rpc178c_ci';
  IF n <> 7 THEN RAISE EXCEPTION 'FAIL: RLS policy count %, expected 7',n; END IF;
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname='rpc178c_ci' AND (
      roles<>ARRAY['authenticated']::name[]
      OR qual LIKE '%request.jwt.claim.store_id%'
      OR with_check LIKE '%request.jwt.claim.store_id%'
      OR EXISTS (SELECT 1 FROM unnest(roles) r WHERE r IN ('anon','public','service_role'))
    );
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: risky role or user-supplied store_id claim in policy'; END IF;
  IF has_schema_privilege('anon','rpc178c_ci','USAGE')
    OR has_schema_privilege('service_role','rpc178c_ci','USAGE')
    OR has_schema_privilege('authenticated','rpc178_qa','USAGE')
    OR has_schema_privilege('anon','rpc178_qa','USAGE')
    OR has_schema_privilege('service_role','rpc178_qa','USAGE') THEN
    RAISE EXCEPTION 'FAIL: an inappropriate schema grant exists';
  END IF;
  IF has_table_privilege('authenticated','rpc178c_ci.store_memberships','INSERT')
    OR has_table_privilege('authenticated','rpc178c_ci.store_memberships','UPDATE')
    OR has_table_privilege('authenticated','rpc178c_ci.stores','UPDATE')
    OR has_table_privilege('authenticated','rpc178c_ci.products','UPDATE')
    OR has_table_privilege('authenticated','rpc178_qa.products','SELECT') THEN
    RAISE EXCEPTION 'FAIL: roles can edit authority or read inherited private schema';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='rpc178c_ci' AND p.prosecdef) THEN
    RAISE EXCEPTION 'FAIL: security-definer helper forbidden in JWT-simulated fixture';
  END IF;
  RAISE NOTICE 'PASS: schema grants, 5/5 FORCE RLS, 7 role-bound policies, zero SECURITY DEFINER';
END $$;

-- Actor A: same tenant as Store B, but is ONLY Owner of Store A.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',true);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM rpc178c_ci.stores;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL A stores visible %',n; END IF;
  SELECT count(*) INTO n FROM rpc178c_ci.products;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL A products visible %',n; END IF;
  SELECT count(*) INTO n FROM rpc178c_ci.orders;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL A orders visible %',n; END IF;
  SELECT count(*) INTO n FROM rpc178c_ci.orders
    WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  IF n<>0 THEN RAISE EXCEPTION 'FAIL A read B'; END IF;

  INSERT INTO rpc178c_ci.orders(order_id,tenant_id,store_id,product_id,total_vnd)
  VALUES('dddddddd-dddd-4ddd-8ddd-ddddddddddd4','11111111-1111-4111-8111-111111111111',
         'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','cccccccc-cccc-4ccc-8ccc-ccccccccccc1',200000);
  SELECT count(*) INTO n FROM rpc178c_ci.orders;
  IF n<>2 THEN RAISE EXCEPTION 'FAIL A valid owner write %',n; END IF;

  BEGIN
    INSERT INTO rpc178c_ci.orders(order_id,tenant_id,store_id,product_id,total_vnd)
    VALUES('dddddddd-dddd-4ddd-8ddd-ddddddddddd5','11111111-1111-4111-8111-111111111111',
           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','cccccccc-cccc-4ccc-8ccc-ccccccccccc2',200000);
    RAISE EXCEPTION 'FAIL: A inserted Store B order';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    INSERT INTO rpc178c_ci.orders(order_id,tenant_id,store_id,product_id,total_vnd)
    VALUES('dddddddd-dddd-4ddd-8ddd-ddddddddddd6','11111111-1111-4111-8111-111111111111',
           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','cccccccc-cccc-4ccc-8ccc-ccccccccccc2',200000);
    RAISE EXCEPTION 'FAIL: mismatched Store A order with Store B product';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  BEGIN
    UPDATE rpc178c_ci.orders
      SET store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
          product_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
      WHERE order_id='dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
    RAISE EXCEPTION 'FAIL: A moved an order to Store B';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  UPDATE rpc178c_ci.orders SET total_vnd=1
    WHERE order_id='dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL: A updated B order %',n; END IF;
  DELETE FROM rpc178c_ci.orders WHERE order_id='dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL: A deleted B order %',n; END IF;
  RAISE NOTICE 'PASS: A reads/writes A only, no B read/write/move, FK prevents cross-Store product';
END $$;
ROLLBACK;

-- Claims for Store and Tenant are untrusted and intentionally ignored.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',true);
SELECT set_config('request.jwt.claim.store_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true);
SELECT set_config('request.jwt.claim.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM rpc178c_ci.orders
    WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  IF n<>0 THEN RAISE EXCEPTION 'FAIL: forged store claim gave B access'; END IF;
  RAISE NOTICE 'PASS: forged JWT Store/Tenant metadata does not grant B access';
END $$;
ROLLBACK;

-- Independent synthetic identity B must see Store B, never Store A.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',true);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM rpc178c_ci.stores;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL B stores visible %',n; END IF;
  SELECT count(*) INTO n FROM rpc178c_ci.orders;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL B orders visible %',n; END IF;
  SELECT count(*) INTO n FROM rpc178c_ci.orders
    WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  IF n<>0 THEN RAISE EXCEPTION 'FAIL B read A'; END IF;
  INSERT INTO rpc178c_ci.orders(order_id,tenant_id,store_id,product_id,total_vnd)
  VALUES('dddddddd-dddd-4ddd-8ddd-ddddddddddd7','11111111-1111-4111-8111-111111111111',
         'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','cccccccc-cccc-4ccc-8ccc-ccccccccccc2',5000);
  BEGIN
    INSERT INTO rpc178c_ci.orders(order_id,tenant_id,store_id,product_id,total_vnd)
    VALUES('dddddddd-dddd-4ddd-8ddd-ddddddddddd8','11111111-1111-4111-8111-111111111111',
           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','cccccccc-cccc-4ccc-8ccc-ccccccccccc1',5000);
    RAISE EXCEPTION 'FAIL: B inserted A order';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS: B manager can write B but never A';
END $$;
ROLLBACK;

-- Cross-tenant identity C sees only Tenant 2 Store C.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',true);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM rpc178c_ci.orders;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL C order count %',n; END IF;
  SELECT count(*) INTO n FROM rpc178c_ci.orders
    WHERE tenant_id='11111111-1111-4111-8111-111111111111';
  IF n<>0 THEN RAISE EXCEPTION 'FAIL C cross-tenant read'; END IF;
  RAISE NOTICE 'PASS: cross-tenant read denied';
END $$;
ROLLBACK;

-- Staff can read Store A but cannot write orders (role boundary).
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',true);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM rpc178c_ci.orders;
  IF n<>1 THEN RAISE EXCEPTION 'FAIL staff read %',n; END IF;
  BEGIN
    INSERT INTO rpc178c_ci.orders(order_id,tenant_id,store_id,product_id,total_vnd)
    VALUES('dddddddd-dddd-4ddd-8ddd-ddddddddddd9','11111111-1111-4111-8111-111111111111',
           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','cccccccc-cccc-4ccc-8ccc-ccccccccccc1',1000);
    RAISE EXCEPTION 'FAIL: staff inserted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS: staff read-only';
END $$;
ROLLBACK;

-- No/invalid simulated JWT subject: no visibility or a hard parse error.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM rpc178c_ci.orders;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL no subject can see orders'; END IF;
  RAISE NOTICE 'PASS: missing subject denies all';
END $$;
SELECT set_config('request.jwt.claim.sub','not-a-uuid',true);
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM rpc178c_ci.orders;
    RAISE EXCEPTION 'FAIL: invalid UUID claim was accepted';
  EXCEPTION WHEN invalid_text_representation THEN NULL; END;
  RAISE NOTICE 'PASS: malformed subject fails closed';
END $$;
ROLLBACK;

-- Inactive membership should immediately lose all access, no JWT refresh magic.
BEGIN;
UPDATE rpc178c_ci.store_memberships SET is_active=false
  WHERE user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',true);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM rpc178c_ci.orders;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL inactive membership still sees order'; END IF;
  RAISE NOTICE 'PASS: inactive membership denies';
END $$;
ROLLBACK;

-- Store authority_version mismatch invalidates stale membership.
BEGIN;
UPDATE rpc178c_ci.stores SET authority_version=2
  WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',true);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM rpc178c_ci.orders;
  IF n<>0 THEN RAISE EXCEPTION 'FAIL stale authority version still sees orders'; END IF;
  RAISE NOTICE 'PASS: stale authority version denied';
END $$;
ROLLBACK;

-- Both synthetic QA grants and fixture rows disappear with disposable CI DB.
-- Verify inherited private candidate retains zero published privileges.
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='rpc178_qa')<>0
    OR has_schema_privilege('authenticated','rpc178_qa','USAGE') THEN
    RAISE EXCEPTION 'FAIL: inherited zero-grant candidate mutated';
  END IF;
  IF (SELECT count(*) FROM rpc178c_ci.orders)<>3 THEN
    RAISE EXCEPTION 'FAIL: negative tests leaked persistent writes';
  END IF;
  RAISE NOTICE 'RPC178C ALL SYNTHETIC PG17 NEGATIVE TESTS PASSED; HOSTED/JWT NO-GO';
END $$;
