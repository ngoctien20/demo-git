\set ON_ERROR_STOP on
-- TIEN404 V19.0-B7-S2 isolated CI rollback drill ONLY.
-- DO NOT run on Supabase or any user database; no actual customer RPC changes.
-- Rollback is transactionally rehearsed for the QA-namespaced versioned function.
SELECT 1/(CASE WHEN EXISTS(
 SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='b7s2' AND p.proname='save_product_store_v2'
) THEN 1 ELSE 0 END) AS qa_before_versioned_function_exists;

BEGIN;
DROP FUNCTION b7s2.save_product_store_v2(uuid,uuid,text,text,bigint,boolean,integer,timestamptz);
SELECT 1/(CASE WHEN NOT EXISTS(
 SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='b7s2' AND p.proname='save_product_store_v2'
) THEN 1 ELSE 0 END) AS qa_simulated_rollback_version_absent;
ROLLBACK;

SELECT 1/(CASE WHEN EXISTS(
 SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='b7s2' AND p.proname='save_product_store_v2'
) AND (SELECT count(*) FROM b7s2.products)=2
  AND (SELECT count(*) FROM b7s2.audit_log)=4
 THEN 1 ELSE 0 END) AS qa_transaction_rollback_preserved_data_and_function;

SELECT 'V19_B7_S2_VERSIONED_RPC_ROLLBACK_REHEARSAL_PASS' AS checkpoint;
