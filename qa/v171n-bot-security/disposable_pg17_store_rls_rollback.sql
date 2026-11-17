-- TIEN404 V17.1N — DISPOSABLE PostgreSQL 17 RLS QA ONLY
-- This is a design-fixture transaction, NOT a test of real signed JWTs,
-- real Store Ownership or Commerce public.orders/products RLS.
-- All rows and policies are created in a temporary table and rolled back.
-- Run only in an approved staging or disposable PostgreSQL instance.
BEGIN;
CREATE TEMP TABLE t404_v171n_disposable_store_rls (
  tenant_id text NOT NULL,
  store_id text NOT NULL,
  sku text NOT NULL
) ON COMMIT DROP;
INSERT INTO t404_v171n_disposable_store_rls(tenant_id,store_id,sku)
  VALUES ('TENANT_QA','STORE_A','SKU_A'),
         ('TENANT_QA','STORE_B','SKU_B'),
         ('FOREIGN_TENANT','STORE_X','SKU_X');
ALTER TABLE t404_v171n_disposable_store_rls ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_v171n_disposable_store_rls FORCE ROW LEVEL SECURITY;
CREATE POLICY v171n_disposable_store_scope
  ON t404_v171n_disposable_store_rls
  FOR SELECT TO authenticated
  USING (tenant_id = current_setting('t404.v171n_tenant_qa',true)
    AND store_id = current_setting('t404.v171n_store_qa',true));
GRANT SELECT ON t404_v171n_disposable_store_rls TO authenticated;
SET LOCAL ROLE authenticated;
DO $V171N$
DECLARE total_count integer; foreign_count integer;
BEGIN
 PERFORM set_config('t404.v171n_tenant_qa','TENANT_QA',true);
 PERFORM set_config('t404.v171n_store_qa','STORE_A',true);
 SELECT count(*) INTO total_count FROM pg_temp.t404_v171n_disposable_store_rls;
 SELECT count(*) INTO foreign_count FROM pg_temp.t404_v171n_disposable_store_rls WHERE store_id='STORE_B';
 IF total_count<>1 OR foreign_count<>0 THEN
  RAISE EXCEPTION 'V171N_STORE_A_RLS_FAIL';
 END IF;
 PERFORM set_config('t404.v171n_store_qa','STORE_B',true);
 SELECT count(*) INTO total_count FROM pg_temp.t404_v171n_disposable_store_rls;
 SELECT count(*) INTO foreign_count FROM pg_temp.t404_v171n_disposable_store_rls WHERE store_id='STORE_A';
 IF total_count<>1 OR foreign_count<>0 THEN
  RAISE EXCEPTION 'V171N_STORE_B_RLS_FAIL';
 END IF;
 PERFORM set_config('t404.v171n_store_qa','STORE_X',true);
 SELECT count(*) INTO total_count FROM pg_temp.t404_v171n_disposable_store_rls;
 IF total_count<>0 THEN RAISE EXCEPTION 'V171N_FOREIGN_TENANT_RLS_FAIL'; END IF;
 PERFORM set_config('t404.v171n_store_qa','',true);
 SELECT count(*) INTO total_count FROM pg_temp.t404_v171n_disposable_store_rls;
 IF total_count<>0 THEN RAISE EXCEPTION 'V171N_MISSING_STORE_DENY_FAIL'; END IF;
END
$V171N$;
SELECT current_user='authenticated' AS tested_authenticated_role,
 'DISPOSABLE_SAME_TENANT_STORE_A_B_RLS_PASS' AS admission,
 'NO_REAL_JWT_NO_COMMERCE_TABLES' AS proof_scope;
ROLLBACK;
