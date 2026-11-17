\echo 'TIEN404_V15_0_10U2_DISPOSABLE_ROLLBACK_BEGIN'
DO $$ DECLARE n integer;BEGIN
 SELECT COUNT(*) INTO n FROM tien404_r1_qa.tenant_identity_map;
 IF n<>2 THEN RAISE EXCEPTION 'LEGACY_V1_NOT_PRESERVED'; END IF;
 IF to_regclass('tien404_r1_qa.tenant_authorities_v2') IS NOT NULL OR
    to_regclass('tien404_r1_qa.stores_v2') IS NOT NULL OR
    to_regclass('tien404_r1_qa.store_bot_identity_map_v2') IS NOT NULL OR
    to_regclass('tien404_r1_qa.store_reader_memberships_v2') IS NOT NULL THEN
   RAISE EXCEPTION 'V2_OBJECTS_REMAIN_AFTER_ROLLBACK'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tien404_customer_catalog_reader') THEN RAISE EXCEPTION 'READER_ROLE_REMAINED_AFTER_ROLLBACK'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='tien404_r1_qa' AND tablename='catalog' AND policyname='v2_catalog_reader_select') THEN RAISE EXCEPTION 'READER_POLICY_REMAINED_AFTER_ROLLBACK'; END IF;
 IF (public.qa_owner_pairing('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','verify','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'ok') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'SYNTHETIC_OWNER_RPC_CHANGED'; END IF;
 IF NOT tien404_r1_qa.owner_authorized_qa('qa-tenant-b','qa-store-b','qa-bot-b') THEN RAISE EXCEPTION 'SYNTHETIC_OWNER_AUTH_CHANGED'; END IF;
END $$;
\echo 'TIEN404_V15_0_10U2_DISPOSABLE_ROLLBACK_PASS'