-- TIEN404 V14.5Z-LIVE-01: STRICTLY ISOLATED HOSTED D1 QA DATABASE ONLY.
-- Target: tien404-zalo-live01-security-qa-staging (UNBOUND TO ALL WORKERS).
-- Never apply to: tien404-zalo-replay-staging-v1, Supabase, Commerce, production.
-- All identifiers are QA-only opaque hashes; never store raw recipient chat IDs, tokens or PII.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS z145z_live01_grants (
  grant_id TEXT PRIMARY KEY NOT NULL CHECK(length(grant_id) BETWEEN 8 AND 100),
  tenant_hash TEXT NOT NULL CHECK(length(tenant_hash)=64 AND tenant_hash NOT GLOB '*[^0-9a-f]*'),
  store_hash TEXT NOT NULL CHECK(length(store_hash)=64 AND store_hash NOT GLOB '*[^0-9a-f]*'),
  bot_hash TEXT NOT NULL CHECK(length(bot_hash)=64 AND bot_hash NOT GLOB '*[^0-9a-f]*'),
  recipient_hash TEXT NOT NULL CHECK(length(recipient_hash)=64 AND recipient_hash NOT GLOB '*[^0-9a-f]*'),
  issued_ms INTEGER NOT NULL CHECK(issued_ms>0),
  expires_ms INTEGER NOT NULL CHECK(expires_ms>issued_ms AND expires_ms-issued_ms<=600000),
  status TEXT NOT NULL DEFAULT 'QA_PENDING' CHECK(status IN('QA_PENDING','QA_ARMED','QA_STOPPED')),
  environment TEXT NOT NULL DEFAULT 'OFFLINE_QA' CHECK(environment='OFFLINE_QA'),
  max_replies INTEGER NOT NULL DEFAULT 3 CHECK(max_replies BETWEEN 1 AND 3),
  max_model_calls INTEGER NOT NULL DEFAULT 3 CHECK(max_model_calls BETWEEN 1 AND 3),
  max_tokens INTEGER NOT NULL DEFAULT 2500 CHECK(max_tokens BETWEEN 1 AND 2500),
  CHECK(tenant_hash<>store_hash AND bot_hash<>recipient_hash),
  UNIQUE(bot_hash, recipient_hash, issued_ms)
);
CREATE TABLE IF NOT EXISTS z145z_live01_quotas (
  grant_id TEXT PRIMARY KEY NOT NULL REFERENCES z145z_live01_grants(grant_id),
  replies_claimed INTEGER NOT NULL DEFAULT 0 CHECK(replies_claimed BETWEEN 0 AND 3),
  model_calls_claimed INTEGER NOT NULL DEFAULT 0 CHECK(model_calls_claimed BETWEEN 0 AND 3),
  tokens_reserved INTEGER NOT NULL DEFAULT 0 CHECK(tokens_reserved BETWEEN 0 AND 2500),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  environment TEXT NOT NULL DEFAULT 'OFFLINE_QA' CHECK(environment='OFFLINE_QA')
);
CREATE TABLE IF NOT EXISTS z145z_live01_events (
  grant_id TEXT NOT NULL REFERENCES z145z_live01_grants(grant_id),
  event_hash TEXT NOT NULL CHECK(length(event_hash)=64 AND event_hash NOT GLOB '*[^0-9a-f]*'),
  session_hash TEXT NOT NULL CHECK(length(session_hash)=64 AND session_hash NOT GLOB '*[^0-9a-f]*'),
  claimed_ms INTEGER NOT NULL CHECK(claimed_ms>0),
  state TEXT NOT NULL DEFAULT 'QA_CLAIMED' CHECK(state IN('QA_CLAIMED','QA_SUPPRESSED','QA_SIMULATED')),
  environment TEXT NOT NULL DEFAULT 'OFFLINE_QA' CHECK(environment='OFFLINE_QA'),
  PRIMARY KEY (grant_id,event_hash)
);
CREATE TABLE IF NOT EXISTS z145z_live01_sessions (
  grant_id TEXT NOT NULL REFERENCES z145z_live01_grants(grant_id),
  session_hash TEXT NOT NULL CHECK(length(session_hash)=64 AND session_hash NOT GLOB '*[^0-9a-f]*'),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  last_sequence INTEGER NOT NULL DEFAULT 0 CHECK(last_sequence>=0),
  updated_ms INTEGER NOT NULL CHECK(updated_ms>0),
  state TEXT NOT NULL DEFAULT 'QA_ACTIVE' CHECK(state IN('QA_ACTIVE','QA_HANDOFF','QA_STOPPED')),
  environment TEXT NOT NULL DEFAULT 'OFFLINE_QA' CHECK(environment='OFFLINE_QA'),
  PRIMARY KEY (grant_id,session_hash)
);
CREATE INDEX IF NOT EXISTS z145z_live01_events_by_session ON z145z_live01_events(grant_id,session_hash,claimed_ms);
