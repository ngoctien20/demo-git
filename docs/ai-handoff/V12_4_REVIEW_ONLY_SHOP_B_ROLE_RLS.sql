-- TIEN404 V12.4 LEAST PRIVILEGE ROLE — REVIEW ONLY, DO NOT RUN ON SUPABASE UNTIL VERIFIED BACKUP/RESTORE.
-- No secret, no LOGIN. Role is limited to Shop B QA sessions and SELECT of Shop B owner/catalog readback.
-- No existing permissions revoked, no Orders writes, no Zalo/HTTP effects.
DO $$
BEGIN
 IF to_regnamespace('tien404_dialogue_private') IS NULL OR
    to_regnamespace('tien404_r1_qa') IS NULL THEN
   RAISE EXCEPTION 'QA_SCHEMAS_MISSING';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='tien404_shop_b_qa_backend') THEN
   RAISE EXCEPTION 'ROLE_ALREADY_EXISTS_REVIEW_FIRST';
 END IF;
END $$;
CREATE ROLE tien404_shop_b_qa_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA tien404_dialogue_private TO tien404_shop_b_qa_backend;
GRANT USAGE ON SCHEMA tien404_r1_qa TO tien404_shop_b_qa_backend;
GRANT SELECT, INSERT, UPDATE ON tien404_dialogue_private.shop_b_sessions TO tien404_shop_b_qa_backend;
GRANT SELECT, INSERT ON tien404_dialogue_private.shop_b_receipts TO tien404_shop_b_qa_backend;
GRANT SELECT ON tien404_r1_qa.catalog, tien404_r1_qa.owner_bindings,
    tien404_r1_qa.owner_pairing_claims_v3, tien404_r1_qa.shop_bots TO tien404_shop_b_qa_backend;

CREATE POLICY qa_b_sessions_select ON tien404_dialogue_private.shop_b_sessions
  FOR SELECT TO tien404_shop_b_qa_backend
  USING (tenant_key='qa-tenant-b' AND store_key='qa-store-b' AND bot_key='qa-bot-b');
CREATE POLICY qa_b_sessions_insert ON tien404_dialogue_private.shop_b_sessions
  FOR INSERT TO tien404_shop_b_qa_backend
  WITH CHECK (tenant_key='qa-tenant-b' AND store_key='qa-store-b' AND bot_key='qa-bot-b');
CREATE POLICY qa_b_sessions_update ON tien404_dialogue_private.shop_b_sessions
  FOR UPDATE TO tien404_shop_b_qa_backend
  USING (tenant_key='qa-tenant-b' AND store_key='qa-store-b' AND bot_key='qa-bot-b')
  WITH CHECK (tenant_key='qa-tenant-b' AND store_key='qa-store-b' AND bot_key='qa-bot-b');

CREATE POLICY qa_b_receipts_select ON tien404_dialogue_private.shop_b_receipts
  FOR SELECT TO tien404_shop_b_qa_backend
  USING (EXISTS (
    SELECT 1 FROM tien404_dialogue_private.shop_b_sessions s
    WHERE s.scope_key=shop_b_receipts.scope_key
    AND s.tenant_key='qa-tenant-b' AND s.store_key='qa-store-b' AND s.bot_key='qa-bot-b'));
CREATE POLICY qa_b_receipts_insert ON tien404_dialogue_private.shop_b_receipts
  FOR INSERT TO tien404_shop_b_qa_backend
  WITH CHECK (EXISTS (
    SELECT 1 FROM tien404_dialogue_private.shop_b_sessions s
    WHERE s.scope_key=shop_b_receipts.scope_key
    AND s.tenant_key='qa-tenant-b' AND s.store_key='qa-store-b' AND s.bot_key='qa-bot-b'));

CREATE POLICY qa_b_catalog_select ON tien404_r1_qa.catalog
  FOR SELECT TO tien404_shop_b_qa_backend
  USING (tenant_key='qa-tenant-b' AND store_key='qa-store-b' AND bot_key='qa-bot-b' AND sku='F01');
CREATE POLICY qa_b_owner_bindings_select ON tien404_r1_qa.owner_bindings
  FOR SELECT TO tien404_shop_b_qa_backend
  USING (tenant_key='qa-tenant-b' AND store_key='qa-store-b' AND bot_key='qa-bot-b' AND status='paired' AND expires_at>now());
CREATE POLICY qa_b_owner_claims_select ON tien404_r1_qa.owner_pairing_claims_v3
  FOR SELECT TO tien404_shop_b_qa_backend
  USING (tenant_key='qa-tenant-b' AND store_key='qa-store-b' AND bot_key='qa-bot-b' AND status='CONFIRMED');
CREATE POLICY qa_b_shop_bots_select ON tien404_r1_qa.shop_bots
  FOR SELECT TO tien404_shop_b_qa_backend
  USING (tenant_key='qa-tenant-b' AND store_key='qa-store-b' AND bot_key='qa-bot-b' AND enabled_mode='dry_run' AND identity_status='synthetic_qa');

-- BACKEND LOGIN CREATION IS A SEPARATE STEP, ONLY AFTER VERIFIED BACKUP.
-- Keep the intended server login password exclusively in an approved Secret Manager.
-- No GRANT TO anon / authenticated / service_role / PUBLIC.
