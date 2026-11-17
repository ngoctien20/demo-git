
-- APPENDED INTO THE PROPOSAL TRANSACTION BEFORE ITS ROLLBACK.
-- All inserts are fake and discarded with this transaction.
INSERT INTO public.tenants(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO auth.users(id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner');
INSERT INTO tien404_v171z_qa.qa_tenants(tenant_id,change_receipt_sha256)
 VALUES('11111111-1111-4111-8111-111111111111',repeat('f',64));
INSERT INTO tien404_v171z_qa.qa_stores(tenant_id,store_key) VALUES
 ('11111111-1111-4111-8111-111111111111','QA_STORE_A'),
 ('11111111-1111-4111-8111-111111111111','QA_STORE_B');
INSERT INTO tien404_v171z_qa.qa_store_memberships(tenant_id,store_key,user_id,role) VALUES
 ('11111111-1111-4111-8111-111111111111','QA_STORE_A','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),
 ('11111111-1111-4111-8111-111111111111','QA_STORE_B','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner');
INSERT INTO tien404_v171z_qa.qa_products(tenant_id,store_key,sku,label,price_vnd) VALUES
 ('11111111-1111-4111-8111-111111111111','QA_STORE_A','QA-A001','Fixture A',1000),
 ('11111111-1111-4111-8111-111111111111','QA_STORE_B','QA-B001','Fixture B',2000);
GRANT USAGE ON SCHEMA tien404_v171z_qa TO authenticated;
GRANT SELECT ON tien404_v171z_qa.qa_store_memberships,tien404_v171z_qa.qa_products TO authenticated;

-- Simulated request.jwt.claim.sub is NOT a real cryptographically verified JWT.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $a$
BEGIN
 IF (SELECT count(*) FROM tien404_v171z_qa.qa_products)<>1 THEN
  RAISE EXCEPTION 'QA_OWNER_A unexpected catalog row count';
 END IF;
 IF (SELECT count(*) FROM tien404_v171z_qa.qa_products WHERE store_key='QA_STORE_B')<>0 THEN
  RAISE EXCEPTION 'QA_OWNER_A cross-Store B access';
 END IF;
END
$a$;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $b$
BEGIN
 IF (SELECT count(*) FROM tien404_v171z_qa.qa_products)<>1 THEN
  RAISE EXCEPTION 'QA_OWNER_B unexpected catalog row count';
 END IF;
 IF (SELECT count(*) FROM tien404_v171z_qa.qa_products WHERE store_key='QA_STORE_A')<>0 THEN
  RAISE EXCEPTION 'QA_OWNER_B cross-Store A access';
 END IF;
END
$b$;
RESET ROLE;

-- Revoke A and verify the next self-scoped mechanical RLS SELECT is blocked.
UPDATE tien404_v171z_qa.qa_store_memberships
 SET active=false WHERE store_key='QA_STORE_A';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $rev$
BEGIN
 IF (SELECT count(*) FROM tien404_v171z_qa.qa_products)<>0 THEN
  RAISE EXCEPTION 'revoked QA_OWNER_A still sees QA catalog';
 END IF;
END
$rev$;
RESET ROLE;
DO $anon$
BEGIN
 IF has_schema_privilege('anon','tien404_v171z_qa','USAGE') THEN
  RAISE EXCEPTION 'anonymous schema access unexpectedly enabled';
 END IF;
END
$anon$;
SELECT 'V171Z_DISPOSABLE_QA_STORE_A_B_MECHANICAL_RLS_PASS_NOT_REAL_JWT' AS verdict;
ROLLBACK;
