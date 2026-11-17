-- TIEN404 V15.0-10U.1 — AUTHZ POLICY CANDIDATE. NOT AN APPROVED MIGRATION.
-- AUTH GAP: NOLOGIN role cannot accept a Supabase Auth JWT by itself. A signed JWT
-- and authenticated actor binding must be established by independently reviewed transport.
-- DO NOT trust caller-provided store_id or unverified request.jwt.claim.* settings.
BEGIN;
DO $$ BEGIN RAISE EXCEPTION 'REVIEW_ONLY_NO_APPROVED_JWT_ROLE_BRIDGE'; END $$;
-- Unreachable while guarded. This section must be security-reviewed as a whole.
CREATE ROLE tien404_customer_catalog_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA tien404_r1_qa TO tien404_customer_catalog_reader;
GRANT SELECT ON tien404_r1_qa.catalog, tien404_r1_qa.shop_bots,
  tien404_r1_qa.store_bot_identity_map_v2,
  tien404_r1_qa.store_reader_memberships_v2
  TO tien404_customer_catalog_reader;

-- SQL role is not equivalent to a verified Supabase JWT; auth.uid() must be shown
-- to originate from a cryptographically authenticated *real* bearer session.
CREATE POLICY v2_membership_own_select ON tien404_r1_qa.store_reader_memberships_v2
  FOR SELECT TO tien404_customer_catalog_reader
  USING (subject_id = (SELECT auth.uid()) AND status='active'
         AND revoked_at IS NULL AND expires_at>now());
CREATE POLICY v2_bot_active_member_select ON tien404_r1_qa.store_bot_identity_map_v2
  FOR SELECT TO tien404_customer_catalog_reader
  USING (status='active' AND valid_from<=now() AND expires_at>now()
    AND EXISTS (SELECT 1 FROM tien404_r1_qa.store_reader_memberships_v2 m
      WHERE m.tenant_key=store_bot_identity_map_v2.tenant_key
        AND m.store_key=store_bot_identity_map_v2.store_key
        AND m.subject_id=(SELECT auth.uid())
        AND m.status='active' AND m.revoked_at IS NULL AND m.expires_at>now()));
CREATE POLICY v2_catalog_reader_select ON tien404_r1_qa.catalog
  FOR SELECT TO tien404_customer_catalog_reader
  USING (EXISTS (SELECT 1 FROM tien404_r1_qa.store_bot_identity_map_v2 m
      WHERE m.tenant_key=catalog.tenant_key AND m.store_key=catalog.store_key
        AND m.bot_key=catalog.bot_key AND m.status='active'
        AND m.valid_from<=now() AND m.expires_at>now()));
-- IMPORTANT: Policy above is a CANDIDATE. It grants a store member access to
-- any active bot in that same store; the verified page/bot intersection MUST
-- also be enforced by server resolver / parameterized SQL and independently UATed.
-- No grants to anon/authenticated/PUBLIC/service_role, no SECURITY DEFINER,
-- no owner privilege revocation, no outbound API, no Orders writes.
COMMIT;