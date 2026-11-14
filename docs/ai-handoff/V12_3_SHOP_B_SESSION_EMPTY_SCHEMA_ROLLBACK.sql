-- TIEN404 V12.3 scoped rollback: only new empty private QA schema.
-- Execute only after DB owner confirms scope and rows==0. No CASCADE.
BEGIN;
DO $$
DECLARE bad_count integer;
BEGIN
 IF to_regnamespace('tien404_dialogue_private') IS NULL THEN
   RAISE NOTICE 'Private QA schema already absent; no rollback needed';
   RETURN;
 END IF;
 IF (SELECT count(*) FROM tien404_dialogue_private.shop_b_sessions) <> 0
    OR (SELECT count(*) FROM tien404_dialogue_private.shop_b_receipts) <> 0 THEN
   RAISE EXCEPTION 'BLOCKED: session/receipt rows exist; refuse destructive rollback';
 END IF;
 SELECT count(*) INTO bad_count FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='tien404_dialogue_private'
 AND c.relname NOT IN
 ('shop_b_sessions','shop_b_receipts','shop_b_sessions_pkey',
 'shop_b_receipts_pkey','shop_b_sessions_expiry_idx','shop_b_receipts_expiry_idx',
 'shop_b_sessions_scope_key_check','shop_b_receipts_event_hash_check');
 IF bad_count > 0 THEN
   RAISE EXCEPTION 'BLOCKED: unexpected schema relations or indexes';
 END IF;
END $$;
DROP TABLE IF EXISTS tien404_dialogue_private.shop_b_receipts;
DROP TABLE IF EXISTS tien404_dialogue_private.shop_b_sessions;
DROP SCHEMA IF EXISTS tien404_dialogue_private;
COMMIT;
