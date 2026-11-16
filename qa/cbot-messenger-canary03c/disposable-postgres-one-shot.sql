-- TIEN404 CBOT-MSG-CANARY-03C
-- DISPOSABLE POSTGRES TEST SCHEMA ONLY. NOT A STAGING/PRODUCTION MIGRATION.
-- Never execute against ifxlvrhyjhbzbrkdsida or an existing customer DB.
-- Apply only to a new throwaway PostgreSQL service with synthetic fingerprints.
BEGIN;
CREATE ROLE canary_runtime_qa NOLOGIN;
CREATE ROLE canary_intruder_qa NOLOGIN;
CREATE SCHEMA canary_disposable_qa;
REVOKE ALL ON SCHEMA canary_disposable_qa FROM PUBLIC;

CREATE TABLE canary_disposable_qa.grants (
  grant_id uuid PRIMARY KEY,
  app_fp bytea NOT NULL CHECK (octet_length(app_fp)=32),
  page_fp bytea NOT NULL CHECK (octet_length(page_fp)=32),
  recipient_fp bytea NOT NULL CHECK (octet_length(recipient_fp)=32),
  marker_fp bytea NOT NULL CHECK (octet_length(marker_fp)=32),
  expires_at timestamptz NOT NULL,
  grant_state text NOT NULL CHECK (grant_state IN ('APPROVED','REVOKED'))
);

CREATE TABLE canary_disposable_qa.claims (
  grant_id uuid PRIMARY KEY REFERENCES canary_disposable_qa.grants(grant_id),
  event_fp bytea NOT NULL CHECK (octet_length(event_fp)=32),
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  delivery_state text NOT NULL DEFAULT 'CLAIMED'
    CHECK (delivery_state IN ('CLAIMED','SEND_ACCEPTED','SEND_UNCERTAIN','CANCELLED'))
);
ALTER TABLE canary_disposable_qa.grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary_disposable_qa.claims ENABLE ROW LEVEL SECURITY;

-- Runtime role sees only active approved synthetic grants.
CREATE POLICY qa_grant_read ON canary_disposable_qa.grants
  FOR SELECT TO canary_runtime_qa
  USING (grant_state='APPROVED' AND expires_at>clock_timestamp());
CREATE POLICY qa_claim_insert ON canary_disposable_qa.claims
  FOR INSERT TO canary_runtime_qa WITH CHECK (true);
CREATE POLICY qa_claim_read ON canary_disposable_qa.claims
  FOR SELECT TO canary_runtime_qa USING (true);

-- SECURITY INVOKER, no privilege elevation or public RPC.
CREATE FUNCTION canary_disposable_qa.claim_once(
  p_grant uuid, p_app_fp bytea, p_page_fp bytea, p_recipient_fp bytea,
  p_marker_fp bytea, p_event_fp bytea
) RETURNS TABLE (claimed_grant uuid)
LANGUAGE sql SECURITY INVOKER
SET search_path = pg_catalog, canary_disposable_qa
AS $function$
  INSERT INTO canary_disposable_qa.claims(grant_id,event_fp)
  SELECT g.grant_id,p_event_fp
  FROM canary_disposable_qa.grants g
  WHERE g.grant_id = p_grant
    AND g.app_fp = p_app_fp
    AND g.page_fp = p_page_fp
    AND g.recipient_fp = p_recipient_fp
    AND g.marker_fp = p_marker_fp
    AND g.grant_state = 'APPROVED'
    AND g.expires_at > clock_timestamp()
    AND octet_length(p_event_fp) = 32
  ON CONFLICT (grant_id) DO NOTHING
  RETURNING canary_disposable_qa.claims.grant_id;
$function$;

REVOKE ALL ON TABLE canary_disposable_qa.grants FROM PUBLIC;
REVOKE ALL ON TABLE canary_disposable_qa.claims FROM PUBLIC;
REVOKE ALL ON FUNCTION canary_disposable_qa.claim_once(
  uuid,bytea,bytea,bytea,bytea,bytea) FROM PUBLIC;
GRANT USAGE ON SCHEMA canary_disposable_qa TO canary_runtime_qa;
GRANT SELECT ON canary_disposable_qa.grants TO canary_runtime_qa;
GRANT SELECT,INSERT ON canary_disposable_qa.claims TO canary_runtime_qa;
GRANT EXECUTE ON FUNCTION canary_disposable_qa.claim_once(
  uuid,bytea,bytea,bytea,bytea,bytea) TO canary_runtime_qa;
-- No login/privilege grants for canary_intruder_qa. No anon/authenticated grants.
COMMIT;

-- The identity fingerprints here MUST be independently computed using a
-- server-secret keyed transform, never from client-supplied page/PSID claims.
-- This ephemeral schema only tests a DB uniqueness/authorization property;
-- it does NOT verify Meta HMAC, consent, n8n routing or real delivery.
-- A provider timeout after claim means 0 or 1 actual deliveries; DO NOT retry
-- automatically, since this design guarantees at-most-one attempt, not delivery.
