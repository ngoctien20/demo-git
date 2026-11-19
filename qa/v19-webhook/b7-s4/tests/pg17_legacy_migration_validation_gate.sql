\set ON_ERROR_STOP on
-- TIEN404 V19.0-B7-S4 — disposable PG17 CI QA ONLY.
-- Run AFTER b7-s1/tests/pg17_six_table_store_compat.sql.
-- This test NEVER backfills a real Store ID, never disables a policy/trigger,
-- never migrates production schema and never accesses Supabase.
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM pg_constraint
 WHERE connamespace='b7s'::regnamespace
   AND conname LIKE 'b7s_%_new_store_required'
   AND convalidated=false;
 IF n<>6 THEN
  RAISE EXCEPTION 'NOT_VALID_BASELINE_CHANGED expected 6, found %',n;
 END IF;

 -- Unreviewed legacy NULL Store rows must PREVENT constraint validation.
 BEGIN
  EXECUTE 'ALTER TABLE b7s.products VALIDATE CONSTRAINT b7s_products_new_store_required';
  RAISE EXCEPTION 'UNEXPECTED_PRODUCTS_CONSTRAINT_VALIDATION_WITH_NULL_LEGACY';
 EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'QA PRODUCTS LEGACY STORE: VALIDATE correctly denied';
 END;

 BEGIN
  EXECUTE 'ALTER TABLE b7s.orders VALIDATE CONSTRAINT b7s_orders_new_store_required';
  RAISE EXCEPTION 'UNEXPECTED_ORDERS_CONSTRAINT_VALIDATION_WITH_NULL_LEGACY';
 EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'QA ORDERS LEGACY STORE: VALIDATE correctly denied';
 END;
END $$;

-- An ordinary UPDATE that tries to relabel an old row is blocked even
-- when executed as the fixture's privileged setup role; the intentional
-- BEFORE UPDATE scope guard requires separately approved migration custody.
DO $$
BEGIN
 BEGIN
  UPDATE b7s.products SET store_id='qa-store-a'
    WHERE tenant_id='qa-tenant-1' AND id='product-legacy' AND store_id IS NULL;
  RAISE EXCEPTION 'SCOPE_GUARD_BYPASSED_FOR_LEGACY_PRODUCT';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'QA PRODUCTS AUTO-MAPPING: trigger correctly denied';
 END;

 BEGIN
  UPDATE b7s.orders SET store_id='qa-store-a'
    WHERE tenant_id='qa-tenant-1' AND id='order-legacy' AND store_id IS NULL;
  RAISE EXCEPTION 'SCOPE_GUARD_BYPASSED_FOR_LEGACY_ORDER';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'QA ORDERS AUTO-MAPPING: trigger correctly denied';
 END;
END $$;

SELECT 1/(CASE WHEN
 (SELECT count(*) FROM b7s.products WHERE store_id IS NULL)=1 AND
 (SELECT count(*) FROM b7s.orders WHERE store_id IS NULL)=1 AND
 (SELECT count(*) FROM b7s.products WHERE id='product-legacy' AND store_id IS NULL)=1
 THEN 1 ELSE 0 END) AS qa_legacy_quarantine_preserved;

SELECT 'B7_S4_DISPOSABLE_MIGRATION_VALIDATION_BLOCKED_AS_DESIGNED' AS checkpoint;
