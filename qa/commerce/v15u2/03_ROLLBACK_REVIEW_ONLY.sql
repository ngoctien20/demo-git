-- V15.0-10U.1 ROLLBACK CANDIDATE. REVIEW ONLY. NEVER APPLY DIRECTLY TO HOSTED.
-- Operator must first stop new reads, inspect dependencies/callers, export signed
-- evidence, verify approved migration ledger and independently restorable M0 backup.
BEGIN;
DO $$ BEGIN RAISE EXCEPTION 'REVIEW_ONLY_ROLLBACK_NOT_APPROVED'; END $$;
-- Only new v2 objects are candidates for reversal; v1 is preserved.
DROP POLICY IF EXISTS v2_catalog_reader_select ON tien404_r1_qa.catalog;
DROP POLICY IF EXISTS v2_bot_active_member_select ON tien404_r1_qa.store_bot_identity_map_v2;
DROP POLICY IF EXISTS v2_membership_own_select ON tien404_r1_qa.store_reader_memberships_v2;
REVOKE SELECT ON tien404_r1_qa.catalog, tien404_r1_qa.shop_bots,
  tien404_r1_qa.store_bot_identity_map_v2, tien404_r1_qa.store_reader_memberships_v2
  FROM tien404_customer_catalog_reader;
REVOKE USAGE ON SCHEMA tien404_r1_qa FROM tien404_customer_catalog_reader;
DROP ROLE IF EXISTS tien404_customer_catalog_reader;
DROP TABLE tien404_r1_qa.store_reader_memberships_v2;
DROP TABLE tien404_r1_qa.store_bot_identity_map_v2;
DROP TABLE tien404_r1_qa.stores_v2;
DROP TABLE tien404_r1_qa.tenant_authorities_v2;
-- NO DROP tenant_identity_map, products, orders, owner_bindings or existing RPC.
COMMIT;