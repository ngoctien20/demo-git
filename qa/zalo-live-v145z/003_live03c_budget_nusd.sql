-- TIEN404 V14.5Z-LIVE03C — SYNTHETIC NO-SEND QA ONLY
-- Target ONLY D1: tien404-zalo-live01-security-qa-staging
-- New namespaced tables/trigger, not existing LIVE01/LIVE02 tables.
-- 1 nanodollar (nUSD) = 10^-9 USD. Exact n8n rate for gpt-5.4-nano:
-- input USD 0.20 per 1M tokens => 200 nUSD/token
-- output USD 1.25 per 1M tokens => 1250 nUSD/token.
-- QA fixture $0.01 cap is NOT a human approval for LIVE sends.
CREATE TABLE IF NOT EXISTS z145z_live03c_budget_policies (
 grant_id TEXT PRIMARY KEY NOT NULL CHECK(grant_id LIKE 'qa_live03c_%'),
 scope_hash TEXT NOT NULL CHECK(length(scope_hash)=64 AND scope_hash NOT GLOB '*[^0-9a-f]*'),
 model_id TEXT NOT NULL DEFAULT 'gpt-5.4-nano' CHECK(model_id='gpt-5.4-nano'),
 environment TEXT NOT NULL DEFAULT 'OFFLINE_QA' CHECK(environment='OFFLINE_QA'),
 trust_level TEXT NOT NULL DEFAULT 'SYNTHETIC_QA_ONLY' CHECK(trust_level='SYNTHETIC_QA_ONLY'),
 status TEXT NOT NULL DEFAULT 'QA_PENDING' CHECK(status IN('QA_PENDING','QA_ARMED','QA_STOPPED')),
 issued_ms INTEGER NOT NULL CHECK(issued_ms>0),
 expires_ms INTEGER NOT NULL CHECK(expires_ms>issued_ms AND expires_ms-issued_ms<=600000),
 max_calls INTEGER NOT NULL DEFAULT 3 CHECK(max_calls BETWEEN 1 AND 3),
 max_tokens INTEGER NOT NULL DEFAULT 2500 CHECK(max_tokens BETWEEN 1 AND 2500),
 cap_nusd INTEGER NOT NULL CHECK(cap_nusd BETWEEN 1 AND 10000000),
 synthetic_balance_nusd INTEGER NOT NULL CHECK(synthetic_balance_nusd BETWEEN 1 AND 590000000),
 calls_reserved INTEGER NOT NULL DEFAULT 0 CHECK(calls_reserved BETWEEN 0 AND 3),
 tokens_reserved INTEGER NOT NULL DEFAULT 0 CHECK(tokens_reserved BETWEEN 0 AND 2500),
 money_reserved_nusd INTEGER NOT NULL DEFAULT 0 CHECK(money_reserved_nusd BETWEEN 0 AND 10000000),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)
);
CREATE TABLE IF NOT EXISTS z145z_live03c_budget_events (
 grant_id TEXT NOT NULL REFERENCES z145z_live03c_budget_policies(grant_id),
 event_hash TEXT NOT NULL CHECK(length(event_hash)=64 AND event_hash NOT GLOB '*[^0-9a-f]*'),
 scope_hash TEXT NOT NULL CHECK(length(scope_hash)=64 AND scope_hash NOT GLOB '*[^0-9a-f]*'),
 expected_revision INTEGER NOT NULL CHECK(expected_revision BETWEEN 0 AND 3),
 estimated_input_tokens INTEGER NOT NULL CHECK(estimated_input_tokens BETWEEN 0 AND 2500),
 maximum_output_tokens INTEGER NOT NULL CHECK(maximum_output_tokens BETWEEN 1 AND 2500),
 quoted_nusd INTEGER NOT NULL CHECK(quoted_nusd = estimated_input_tokens*200+maximum_output_tokens*1250),
 claimed_ms INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
 environment TEXT NOT NULL DEFAULT 'OFFLINE_QA' CHECK(environment='OFFLINE_QA'),
 PRIMARY KEY(grant_id,event_hash)
);
CREATE TRIGGER IF NOT EXISTS z145z_live03c_budget_guard
AFTER INSERT ON z145z_live03c_budget_events
BEGIN
  UPDATE z145z_live03c_budget_policies
  SET calls_reserved=calls_reserved+1,
      tokens_reserved=tokens_reserved+NEW.estimated_input_tokens+NEW.maximum_output_tokens,
      money_reserved_nusd=money_reserved_nusd+NEW.quoted_nusd,
      revision=revision+1
  WHERE grant_id=NEW.grant_id
    AND scope_hash=NEW.scope_hash
    AND status='QA_ARMED'
    AND environment='OFFLINE_QA'
    AND trust_level='SYNTHETIC_QA_ONLY'
    AND model_id='gpt-5.4-nano'
    AND CAST(strftime('%s','now') AS INTEGER)*1000>=issued_ms
    AND CAST(strftime('%s','now') AS INTEGER)*1000<expires_ms
    AND revision=NEW.expected_revision
    AND calls_reserved<max_calls
    AND tokens_reserved+NEW.estimated_input_tokens+NEW.maximum_output_tokens<=max_tokens
    AND money_reserved_nusd+NEW.quoted_nusd<=cap_nusd
    AND money_reserved_nusd+NEW.quoted_nusd<=synthetic_balance_nusd;
  SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'QA_BUDGET_SCOPE_TIME_CAS_OR_CAP_DENIED') END;
END;