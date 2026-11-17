\echo 'TIEN404_V15_0_10U2_DISPOSABLE_PG17_ASSERTIONS_BEGIN'
-- All table/role/membership data here is SYNTHETIC. NO Supabase Auth bearer tokens.
DO $$ DECLARE n integer; BEGIN
 SELECT COUNT(*) INTO n FROM tien404_r1_qa.tenant_identity_map; IF n<>2 THEN RAISE EXCEPTION 'V1_ROW_COUNT_DRIFT'; END IF;
 SELECT COUNT(*) INTO n FROM (SELECT tenant_key FROM tien404_r1_qa.stores_v2 GROUP BY tenant_key HAVING COUNT(*)=2) x;
 IF n<>1 THEN RAISE EXCEPTION 'SAME_TENANT_STORE_CARDINALITY_FAILED'; END IF;
 IF (public.qa_owner_pairing('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','verify','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'ok') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'SYNTHETIC_OWNER_RPC_A_FAILED'; END IF;
 IF NOT tien404_r1_qa.owner_authorized_qa('qa-tenant-b','qa-store-b','qa-bot-b') THEN RAISE EXCEPTION 'SYNTHETIC_OWNER_RPC_B_FAILED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tien404_customer_catalog_reader' AND (rolcanlogin OR rolbypassrls)) THEN RAISE EXCEPTION 'READER_ROLE_UNSAFE'; END IF;
 IF has_table_privilege('anon','tien404_r1_qa.catalog','SELECT') OR has_table_privilege('authenticated','tien404_r1_qa.catalog','SELECT') THEN RAISE EXCEPTION 'PUBLIC_CATALOG_ACCESS'; END IF;
 IF has_table_privilege('tien404_customer_catalog_reader','tien404_r1_qa.catalog','INSERT') OR has_table_privilege('tien404_customer_catalog_reader','tien404_r1_qa.catalog','UPDATE') THEN RAISE EXCEPTION 'READER_WRITE_GRANT'; END IF;
 SELECT COUNT(*) INTO n FROM pg_policies WHERE schemaname='tien404_r1_qa' AND tablename='catalog' AND policyname='v2_catalog_reader_select';
 IF n<>1 THEN RAISE EXCEPTION 'CATALOG_READER_POLICY_NOT_CREATED'; END IF;
END $$;
-- Simulate per-request DB subject for RLS mechanics ONLY, not real JWT.
BEGIN;
SET LOCAL ROLE tien404_customer_catalog_reader;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ DECLARE n integer; p bigint; BEGIN
 SELECT COUNT(*),min(price_vnd) INTO n,p FROM tien404_r1_qa.catalog;
 IF n<>1 OR p<>159000 THEN RAISE EXCEPTION 'READER_A_SCOPE_FAILED: % %',n,p; END IF;
 IF (SELECT COUNT(*) FROM tien404_r1_qa.catalog WHERE store_key='qa-store-a2')<>0 THEN RAISE EXCEPTION 'READER_A_CROSS_STORE_VISIBLE'; END IF;
 IF (SELECT COUNT(*) FROM tien404_r1_qa.catalog WHERE tenant_key='qa-tenant-b')<>0 THEN RAISE EXCEPTION 'READER_A_CROSS_TENANT_VISIBLE'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE tien404_customer_catalog_reader;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ DECLARE n integer; p bigint; BEGIN
 SELECT COUNT(*),min(price_vnd) INTO n,p FROM tien404_r1_qa.catalog;
 IF n<>1 OR p<>179000 THEN RAISE EXCEPTION 'READER_A2_SCOPE_FAILED: % %',n,p; END IF;
 IF (SELECT COUNT(*) FROM tien404_r1_qa.catalog WHERE store_key='qa-store-a')<>0 THEN RAISE EXCEPTION 'READER_A2_CROSS_STORE_VISIBLE'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE tien404_customer_catalog_reader;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
DO $$ DECLARE n integer; p bigint; BEGIN
 SELECT COUNT(*),min(price_vnd) INTO n,p FROM tien404_r1_qa.catalog;
 IF n<>1 OR p<>199000 THEN RAISE EXCEPTION 'READER_B_SCOPE_FAILED: % %',n,p; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE tien404_customer_catalog_reader;
SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
DO $$ BEGIN IF (SELECT COUNT(*) FROM tien404_r1_qa.catalog)<>0 THEN RAISE EXCEPTION 'UNKNOWN_READER_VISIBLE'; END IF; END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE tien404_customer_catalog_reader;
DO $$ BEGIN IF (SELECT COUNT(*) FROM tien404_r1_qa.catalog)<>0 THEN RAISE EXCEPTION 'NO_SUBJECT_VISIBLE'; END IF; END $$;
ROLLBACK;
-- Revoke membership; reader loses access immediately; restore disposable fixture after check.
BEGIN;
UPDATE tien404_r1_qa.store_reader_memberships_v2 SET status='revoked',revoked_at=now()
 WHERE subject_id='11111111-1111-4111-8111-111111111111';
SET LOCAL ROLE tien404_customer_catalog_reader;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN IF (SELECT COUNT(*) FROM tien404_r1_qa.catalog)<>0 THEN RAISE EXCEPTION 'REVOKED_MEMBERSHIP_VISIBLE'; END IF; END $$;
ROLLBACK;
-- Expiry membership, test that reader no longer sees row.
BEGIN;
UPDATE tien404_r1_qa.store_reader_memberships_v2 SET expires_at=now()-interval '1 hour'
 WHERE subject_id='22222222-2222-4222-8222-222222222222';
SET LOCAL ROLE tien404_customer_catalog_reader;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN IF (SELECT COUNT(*) FROM tien404_r1_qa.catalog)<>0 THEN RAISE EXCEPTION 'EXPIRED_MEMBERSHIP_VISIBLE'; END IF; END $$;
ROLLBACK;
-- Expire bot and check fail closed.
BEGIN;
UPDATE tien404_r1_qa.store_bot_identity_map_v2 SET expires_at=now()-interval '1 hour'
 WHERE bot_key='qa-bot-a';
SET LOCAL ROLE tien404_customer_catalog_reader;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN IF (SELECT COUNT(*) FROM tien404_r1_qa.catalog)<>0 THEN RAISE EXCEPTION 'EXPIRED_BOT_VISIBLE'; END IF; END $$;
ROLLBACK;
\echo 'TIEN404_V15_0_10U2_DISPOSABLE_PG17_ASSERTIONS_PASS'