-- TIEN404 AI V15.2-ADV.6
-- DO NOT APPLY / DO NOT RUN ON HOSTED DATABASE.
-- DESIGN REVIEW ONLY. Separate private approval + OWNER PROOF + real backup
-- evidence + dedicated least-privilege server role + transactional PG QA required.
-- This is intentionally NOT in Supabase migrations/ or exposed public schema.
--
-- PG 17 target observed on current staging. Schema/table names are proposed;
-- confirm no collision and ownership/privilege plan before any hosted change.
BEGIN;
CREATE SCHEMA IF NOT EXISTS tien404_action_private;
REVOKE ALL ON SCHEMA tien404_action_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS tien404_action_private.action_nonce_claims (
  nonce_key_hash bytea PRIMARY KEY,
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  retain_until timestamptz NOT NULL,
  CONSTRAINT t404_nonce_is_sha256 CHECK (octet_length(nonce_key_hash) = 32),
  CONSTRAINT t404_nonce_retention CHECK (retain_until > claimed_at)
);

ALTER TABLE tien404_action_private.action_nonce_claims ENABLE ROW LEVEL SECURITY;

-- No public/authenticated/service_role grant is provisioned in this draft.
-- A separate APPROVED migration must create a narrowly-scoped internal
-- database role/connection and document actual role ownership and RLS tests.
REVOKE ALL ON TABLE tien404_action_private.action_nonce_claims
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE tien404_action_private.action_nonce_claims IS
  'TIEN404 ACTION V1: internal single-use nonce SHA256 digests; no customer PII; never expose Data API';

COMMIT;

-- Claim SQL belongs in pg-nonce-store.cjs and is parameterized:
--   INSERT ... SELECT decode($1::text, 'hex'), to_timestamp($2 / 1000.0)
--   WHERE retain_until > clock_timestamp()
--   ON CONFLICT (nonce_key_hash) DO NOTHING RETURNING nonce_key_hash;
--
-- No SECURITY DEFINER function, no RPC, no GRANT to public/anon/authenticated.
-- No TTL cleanup yet. Review retention, durability, PITR/free-tier export,
-- crash recovery, rate limiting, DB roles, replication and idempotent business
-- transaction semantics before an authorized migration.
