-- TIEN404 CBOT-MSG-CANARY-03B — SOURCE-ONLY DDL REVIEW. DO NOT APPLY.
-- Scope: one-use test grant, never customer orders. Requires PRIVATE
-- operator approval, real transaction role design, secure schema grants,
-- independently proven owner/recipient and Pg backup/restore beforehand.
-- No runtime variables, no real Meta Page ID or PSID here.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private_canary;
CREATE TABLE IF NOT EXISTS private_canary.one_shot_claims (
  grant_id uuid PRIMARY KEY,
  event_digest bytea NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'CLAIMED'
    CHECK (state IN ('CLAIMED','SEND_ACCEPTED','SEND_UNCERTAIN','CANCELLED')),
  CONSTRAINT one_shot_grant_unique UNIQUE (grant_id),
  CONSTRAINT one_shot_expiry_check CHECK (expires_at > claimed_at)
);
ALTER TABLE private_canary.one_shot_claims ENABLE ROW LEVEL SECURITY;
-- Intentionally NO public policies and NO generic grants.
REVOKE ALL ON SCHEMA private_canary FROM PUBLIC;
REVOKE ALL ON TABLE private_canary.one_shot_claims FROM PUBLIC;
-- Requires a separate scoped, least-privilege RLS policy + role grant,
-- which must be independently reviewed; without those, calls are DENIED.
-- Invoker-based RPC cannot elevate arbitrary Messenger webhook callers.
CREATE OR REPLACE FUNCTION private_canary.claim_one_shot(
  p_grant_id uuid, p_event_digest bytea, p_expires_at timestamptz
) RETURNS TABLE (grant_id uuid, state text)
LANGUAGE sql SECURITY INVOKER
SET search_path = pg_catalog, private_canary
AS $sql$
  INSERT INTO private_canary.one_shot_claims(grant_id,event_digest,expires_at)
  SELECT p_grant_id,p_event_digest,p_expires_at
  WHERE p_expires_at > transaction_timestamp()
  ON CONFLICT (grant_id) DO NOTHING
  RETURNING one_shot_claims.grant_id, one_shot_claims.state;
$sql$;
REVOKE ALL ON FUNCTION private_canary.claim_one_shot(uuid,bytea,timestamptz) FROM PUBLIC;
COMMIT;
-- Critical: insert before any potential provider send -> AT MOST ONE
-- attempt when fully durable and every sender honors it; uncertain send
-- or lost provider response must NOT be auto-retried. NOT exactly-once.
