-- TEST ONLY, disposable PostgreSQL17 instance in CI, NEVER live Supabase.
-- APPEND to migration-candidate transaction BEFORE final ROLLBACK.
-- Created fake Auth users are NOT genuine Supabase-issued JWT subjects.
INSERT INTO public.tenants(id) VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO auth.users(id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner');
INSERT INTO tien404_v172a_qa.qa_tenants(tenant_id,receipt_sha256)
 VALUES ('11111111-1111-4111-8111-111111111111',repeat('e',64));
INSERT INTO tien404_v172a_qa.qa_stores(tenant_id,store_key) VALUES
 ('11111111-1111-4111-8111-111111111111','QA_STORE_A'),
 ('11111111-1111-4111-8111-111111111111','QA_STORE_B');
INSERT INTO tien404_v172a_qa.qa_store_memberships(tenant_id,store_key,user_id,role,active) VALUES
 ('11111111-1111-4111-8111-111111111111','QA_STORE_A','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner',true),
 ('11111111-1111-4111-8111-111111111111','QA_STORE_B','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner',true);
INSERT INTO tien404_v172a_qa.qa_catalog(tenant_id,store_key,sku,name,price_vnd) VALUES
 ('11111111-1111-4111-8111-111111111111','QA_STORE_A','QA-A-001','Synthetic A',1000),
 ('11111111-1111-4111-8111-111111111111','QA_STORE_B','QA-B-001','Synthetic B',2000);

DO $invoker$
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='tien404_v172a_qa_catalog'
     AND c.relkind='v' AND 'security_invoker=true'=ANY(c.reloptions)
 ) THEN
   RAISE EXCEPTION 'POSTGREST_VIEW_NOT_SECURITY_INVOKER';
 END IF;
 IF has_table_privilege('anon','public.tien404_v172a_qa_catalog','SELECT')
   THEN RAISE EXCEPTION 'ANON_HAS_QA_READER_PERMISSION';
 END IF;
 IF has_table_privilege('authenticated','tien404_v172a_qa.qa_catalog','INSERT')
   THEN RAISE EXCEPTION 'CLIENT_CAN_MUTATE_QA_CATALOG';
 END IF;
END
$invoker$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $storea$
BEGIN
 IF (SELECT COUNT(*) FROM public.tien404_v172a_qa_catalog)<>1
  THEN RAISE EXCEPTION 'OWNER_A_NOT_EXACTLY_ONE_PRODUCT'; END IF;
 IF (SELECT COUNT(*) FROM public.tien404_v172a_qa_catalog
   WHERE store_key='QA_STORE_A' AND sku='QA-A-001')<>1
  THEN RAISE EXCEPTION 'OWNER_A_OWN_STORE_DENIED'; END IF;
 IF (SELECT COUNT(*) FROM public.tien404_v172a_qa_catalog
   WHERE store_key='QA_STORE_B')<>0
  THEN RAISE EXCEPTION 'OWNER_A_CAN_READ_B'; END IF;
END
$storea$;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $storeb$
BEGIN
 IF (SELECT COUNT(*) FROM public.tien404_v172a_qa_catalog)<>1
  THEN RAISE EXCEPTION 'OWNER_B_NOT_EXACTLY_ONE_PRODUCT'; END IF;
 IF (SELECT COUNT(*) FROM public.tien404_v172a_qa_catalog
   WHERE store_key='QA_STORE_B' AND sku='QA-B-001')<>1
  THEN RAISE EXCEPTION 'OWNER_B_OWN_STORE_DENIED'; END IF;
 IF (SELECT COUNT(*) FROM public.tien404_v172a_qa_catalog
   WHERE store_key='QA_STORE_A')<>0
  THEN RAISE EXCEPTION 'OWNER_B_CAN_READ_A'; END IF;
END
$storeb$;
RESET ROLE;

UPDATE tien404_v172a_qa.qa_store_memberships
 SET active=false WHERE store_key='QA_STORE_A';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $revoked$
BEGIN
 IF (SELECT COUNT(*) FROM public.tien404_v172a_qa_catalog)<>0
  THEN RAISE EXCEPTION 'REVOKED_OWNER_A_CAN_READ'; END IF;
END
$revoked$;
RESET ROLE;
UPDATE tien404_v172a_qa.qa_store_memberships
 SET active=true WHERE store_key='QA_STORE_A';
UPDATE public.tenant_memberships
 SET active=false WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $revokedtenant$
BEGIN
 IF (SELECT COUNT(*) FROM public.tien404_v172a_qa_catalog)<>0
  THEN RAISE EXCEPTION 'REVOKED_TENANT_MEMBER_CAN_READ'; END IF;
END
$revokedtenant$;
RESET ROLE;
SELECT 'V172A_POSTGREST_SECURITY_INVOKER_STORE_A_B_NEGATIVE_RLS_PASS_FAKE_JWT' AS verdict;
ROLLBACK;
