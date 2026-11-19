\set ON_ERROR_STOP on
-- TIEN404 V19.0-B7-S3 ADVERSARIAL NEGATIVE: disposable Postgres17 CI ONLY.
-- Intentionally demonstrates that a GUC-based synthetic Auth shim is FORGEABLE.
-- DO NOT DEPLOY OR REINTERPRET THIS AS AUTHENTICATED OWNER A/B PROOF.
-- Run after b7-s2/tests/pg17_versioned_store_writer_qa.sql.
SELECT 1/(CASE WHEN EXISTS(
 SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='b7s2' AND p.proname='synthetic_auth_uid'
) THEN 1 ELSE 0 END) AS qa_synthetic_auth_shim_present;

SET ROLE b7s2_client;
-- An arbitrary SQL client can SET a PostgreSQL custom claim.
-- No actual Supabase JWT, verified session or cryptographic proof is supplied.
SET request.jwt.claim.sub='30000000-0000-0000-0000-000000000001';
-- Attempt to update a real synthetic Store A SKU with a stale timestamp.
-- Returning PT409 instead of 42501 proves execution got PAST the simulated
-- membership check when using the untrusted GUC. This is a documented
-- vulnerability of the TEST SHIM, not a vulnerability claim about real auth.uid().
SELECT b7s2.qa_expect_error('PT409',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-A','DO NOT UPDATE',179000,true,NULL,
 '1999-01-01T00:00:00Z'::timestamptz)
$q$) AS qa_guc_spoof_reaches_optimistic_lock_without_verified_jwt;
RESET request.jwt.claim.sub;
RESET ROLE;
-- Confirm no write, no extra audit and price invariant remained.
SELECT 1/(CASE WHEN
 (SELECT count(*) FROM b7s2.products)=2
 AND (SELECT count(*) FROM b7s2.audit_log)=4
 AND (SELECT price_vnd FROM b7s2.products WHERE sku='SKU-A')=179000
 THEN 1 ELSE 0 END) AS qa_spoof_negative_has_zero_data_changes;
SELECT 'B7_S3_FORGEABLE_GUC_CANDIDATE_NO_GO_VERIFIED' AS checkpoint;
