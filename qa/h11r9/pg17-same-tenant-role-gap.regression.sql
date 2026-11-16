-- TIEN404 H11R.9: DISPOSABLE PG17 ONLY, NOT A HOSTED MIGRATION.
-- Inherit the existing V15 P0 same-Tenant Store A/B/C synthetic fixture.
\set ON_ERROR_STOP on
\ir ../v15-sales-lite-p0/pg17-store-rls-isolation.sql

BEGIN;
INSERT INTO qa_p0.tenant_memberships (tenant_id,user_id,role,active) VALUES
 ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','staff',true),
 ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','owner',false);
INSERT INTO qa_p0.store_memberships (tenant_id,store_id,user_id,role,active) VALUES
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004','staff',true),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','owner',true);

-- The inherited synthetic Order policy has no Owner/Manager check. Prove it
-- admits Store B Staff before installing a transactional candidate correction.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products) <> 1 THEN RAISE EXCEPTION 'H11R9_BASELINE_STAFF_PRODUCTS'; END IF;
 IF (SELECT count(*) FROM qa_p0.orders) <> 1 THEN RAISE EXCEPTION 'H11R9_BASELINE_OVERGRANT_NOT_OBSERVED'; END IF;
 RAISE NOTICE 'H11R9_SOURCE_ONLY_STAFF_ORDER_OVERGRANT_OBSERVED_NOT_HOSTED';
END $qa$;
RESET ROLE;

-- The inherited nested store_memberships SELECT policy already checks the
-- active Tenant status. Do not claim an inactive Tenant Store leak.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
SET LOCAL ROLE authenticated;
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_p0.stores) <> 0 THEN RAISE EXCEPTION 'H11R9_BASELINE_INACTIVE_TENANT_STORE_LEAK'; END IF;
 RAISE NOTICE 'H11R9_BASELINE_INACTIVE_TENANT_IS_BLOCKED';
END $qa$;
RESET ROLE;

-- Candidate fix: Store Owner/Manager required for Order visibility, active
-- membership at BOTH levels; Store status must be active.
DROP POLICY orders_store_restrict ON qa_p0.orders;
CREATE POLICY orders_store_restrict ON qa_p0.orders AS RESTRICTIVE FOR SELECT TO authenticated USING (
 store_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM qa_p0.store_memberships m
  JOIN qa_p0.tenant_memberships tm ON tm.tenant_id=m.tenant_id AND tm.user_id=m.user_id
  JOIN qa_p0.stores s ON s.id=m.store_id AND s.tenant_id=m.tenant_id
  WHERE m.tenant_id=orders.tenant_id AND m.store_id=orders.store_id
    AND m.user_id=(SELECT auth.uid()) AND m.active AND tm.active
    AND m.role IN ('owner','manager') AND s.status='active'
 ));
DROP POLICY stores_member_read ON qa_p0.stores;
CREATE POLICY stores_member_read ON qa_p0.stores FOR SELECT TO authenticated USING (
 status='active' AND EXISTS(
  SELECT 1 FROM qa_p0.store_memberships m
  JOIN qa_p0.tenant_memberships tm ON tm.tenant_id=m.tenant_id AND tm.user_id=m.user_id
  WHERE m.tenant_id=stores.tenant_id AND m.store_id=stores.id
    AND m.user_id=(SELECT auth.uid()) AND m.active AND tm.active
 ));

-- Staff B: one own product, one own Store, zero Orders, zero Shop A products.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products) <> 1 OR
    (SELECT count(*) FROM qa_p0.orders) <> 0 OR
    (SELECT count(*) FROM qa_p0.stores) <> 1 OR
    (SELECT count(*) FROM qa_p0.products WHERE store_id='10000000-0000-0000-0000-000000000001') <> 0
 THEN RAISE EXCEPTION 'H11R9_STAFF_AFTER_CANDIDATE_FAILED'; END IF;
 RAISE NOTICE 'H11R9_PASS_STAFF_CATALOG_ONLY';
END $qa$;
RESET ROLE;

-- Inactive Tenant Owner must see no rows.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
SET LOCAL ROLE authenticated;
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products) <> 0 OR
    (SELECT count(*) FROM qa_p0.orders) <> 0 OR
    (SELECT count(*) FROM qa_p0.stores) <> 0
 THEN RAISE EXCEPTION 'H11R9_INACTIVE_TENANT_LEAK'; END IF;
 RAISE NOTICE 'H11R9_PASS_INACTIVE_TENANT_BLOCKED';
END $qa$;
RESET ROLE;

-- Owners A and B still see exactly their own Shop in SAME Tenant.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products) <> 1 OR
    (SELECT count(*) FROM qa_p0.orders) <> 2 OR
    (SELECT count(*) FROM qa_p0.stores) <> 1
 THEN RAISE EXCEPTION 'H11R9_OWNER_A_REGRESSION'; END IF;
 RAISE NOTICE 'H11R9_PASS_OWNER_A';
END $qa$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_p0.products) <> 1 OR
    (SELECT count(*) FROM qa_p0.orders) <> 1 OR
    (SELECT count(*) FROM qa_p0.stores) <> 1
 THEN RAISE EXCEPTION 'H11R9_OWNER_B_REGRESSION'; END IF;
 RAISE NOTICE 'H11R9_PASS_OWNER_B';
END $qa$;
RESET ROLE;

-- Nothing from the candidate policy or the two QA users persists.
ROLLBACK;
SELECT 'H11R9_DISPOSABLE_PG17_POLICY_GAP_DETECTED_CANDIDATE_TESTED_NOT_HOSTED' AS result;
