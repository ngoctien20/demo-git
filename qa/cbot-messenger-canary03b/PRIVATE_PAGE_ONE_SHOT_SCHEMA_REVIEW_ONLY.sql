-- TIEN404 AI — CBOT-MSG-CANARY-03B
-- PRIVATE PAGE-ONLY QA ONE-SHOT SEND CLAIM — REVIEW-ONLY POSTGRES DDL.
-- NOT EXECUTED ON SUPABASE OR N8N. Requires private encrypted backup,
-- formal database authorization, exact operator role/RLS policy and QA.
-- Not an RPC / not callable by anon/authenticated / not Commerce Orders.
--
-- Use HMAC-SHA256 *inside a trusted server* to derive all 64-hex digests.
-- Never store raw Meta Page ID, PSID, Page Access Token, original message,
-- customer data, reusable bearer token or user-submitted approval flags.

CREATE SCHEMA IF NOT EXISTS t404_canary_private;
REVOKE ALL ON SCHEMA t404_canary_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS t404_canary_private.page_only_authorizations (
  canary_id uuid PRIMARY KEY,
  page_binding_hmac text NOT NULL
    CHECK (page_binding_hmac ~ '^[0-9a-f]{64}$'),
  recipient_binding_hmac text NOT NULL
    CHECK (recipient_binding_hmac ~ '^[0-9a-f]{64}$'),
  approved_profile_sha256 text NOT NULL
    CHECK (approved_profile_sha256 ~ '^[0-9a-f]{64}$'),
  owner_consent_ticket_hmac text NOT NULL
    CHECK (owner_consent_ticket_hmac ~ '^[0-9a-f]{64}$'),
  reviewer_ticket_hmac text NOT NULL
    CHECK (reviewer_ticket_hmac ~ '^[0-9a-f]{64}$'),
  marker text NOT NULL CHECK (marker = 'TIEN404-CANARY-LIVE02'),
  state text NOT NULL CHECK (state IN ('APPROVED', 'REVOKED', 'EXPIRED')),
  valid_from timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT t404_canary_one_use_max_ttl
    CHECK (expires_at > valid_from AND
           expires_at <= valid_from + interval '10 minutes')
);

CREATE TABLE IF NOT EXISTS t404_canary_private.one_shot_send_attempt_claims (
  canary_id uuid PRIMARY KEY
    REFERENCES t404_canary_private.page_only_authorizations(canary_id),
  event_hmac text NOT NULL UNIQUE
    CHECK (event_hmac ~ '^[0-9a-f]{64}$'),
  page_binding_hmac text NOT NULL
    CHECK (page_binding_hmac ~ '^[0-9a-f]{64}$'),
  recipient_binding_hmac text NOT NULL
    CHECK (recipient_binding_hmac ~ '^[0-9a-f]{64}$'),
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

REVOKE ALL ON ALL TABLES IN SCHEMA t404_canary_private
  FROM PUBLIC, anon, authenticated;
ALTER TABLE t404_canary_private.page_only_authorizations
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_canary_private.page_only_authorizations
  FORCE ROW LEVEL SECURITY;
ALTER TABLE t404_canary_private.one_shot_send_attempt_claims
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_canary_private.one_shot_send_attempt_claims
  FORCE ROW LEVEL SECURITY;

-- SAFETY GATE: No grants or RLS policies for any unverified worker.
-- An independently authorized privileged internal worker and RLS/GRANT plan
-- must be reviewed separately. Do not deploy DDL and then "just turn on"
-- a service_role API or SECURITY DEFINER function.
--
-- IMPORTANT: Never DELETE a claim to retry. Do not recycle canary_id.
-- A claim row is permanent through the approved audit retention window.
-- No automated retry after a provider timeout/unknown outcome.
