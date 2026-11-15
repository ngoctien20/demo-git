-- TIEN404 LIVE01 QA ONLY. Target: isolated tien404-zalo-live01-security-qa-staging D1, unbound to Worker.
-- ATOMIC fail-closed event claim + CAS + reply/model/token reservation in ONE SQLite statement.
-- No sender or real owner authorization. Never apply to existing REPLAY_DB or production.
CREATE TABLE IF NOT EXISTS z145z_live01_atomic_claims (
  grant_id TEXT NOT NULL REFERENCES z145z_live01_grants(grant_id),
  event_hash TEXT NOT NULL CHECK(length(event_hash)=64 AND event_hash NOT GLOB '*[^0-9a-f]*'),
  session_hash TEXT NOT NULL CHECK(length(session_hash)=64 AND session_hash NOT GLOB '*[^0-9a-f]*'),
  expected_revision INTEGER NOT NULL CHECK(expected_revision>=0),
  sequence INTEGER NOT NULL CHECK(sequence>0),
  reserve_tokens INTEGER NOT NULL CHECK(reserve_tokens BETWEEN 1 AND 2500),
  claimed_ms INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  environment TEXT NOT NULL DEFAULT 'OFFLINE_QA' CHECK(environment='OFFLINE_QA'),
  state TEXT NOT NULL DEFAULT 'QA_RESERVED' CHECK(state IN('QA_RESERVED','QA_SUPPRESSED')),
  PRIMARY KEY(grant_id,event_hash)
);
CREATE TRIGGER IF NOT EXISTS z145z_live01_atomic_claim_guard
AFTER INSERT ON z145z_live01_atomic_claims
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM z145z_live01_grants g
    WHERE g.grant_id=NEW.grant_id AND g.status='QA_ARMED' AND g.environment='OFFLINE_QA'
      AND CAST(strftime('%s','now') AS INTEGER)*1000>=g.issued_ms
      AND CAST(strftime('%s','now') AS INTEGER)*1000<g.expires_ms
  ) THEN RAISE(ABORT,'QA_GRANT_EXPIRED_OR_UNVERIFIED') END;
  UPDATE z145z_live01_sessions
    SET revision=revision+1,last_sequence=NEW.sequence,
        updated_ms=CAST(strftime('%s','now') AS INTEGER)*1000
    WHERE grant_id=NEW.grant_id AND session_hash=NEW.session_hash
      AND revision=NEW.expected_revision AND last_sequence<NEW.sequence
      AND state='QA_ACTIVE' AND environment='OFFLINE_QA';
  SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'QA_SESSION_CAS_OR_HANDOFF_FAILED') END;
  UPDATE z145z_live01_quotas
    SET replies_claimed=replies_claimed+1,
        model_calls_claimed=model_calls_claimed+1,
        tokens_reserved=tokens_reserved+NEW.reserve_tokens,revision=revision+1
    WHERE grant_id=NEW.grant_id AND environment='OFFLINE_QA'
      AND replies_claimed < (SELECT max_replies FROM z145z_live01_grants WHERE grant_id=NEW.grant_id)
      AND model_calls_claimed < (SELECT max_model_calls FROM z145z_live01_grants WHERE grant_id=NEW.grant_id)
      AND tokens_reserved + NEW.reserve_tokens <= (SELECT max_tokens FROM z145z_live01_grants WHERE grant_id=NEW.grant_id);
  SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'QA_REPLY_MODEL_OR_TOKEN_QUOTA_EXCEEDED') END;
END;
