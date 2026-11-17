-- V17.23S — DISPOSABLE QA D1 CANDIDATE ONLY.
-- DO NOT apply to existing Commerce, botmap, or production databases.
-- Requires explicit scoped consent, isolation/cost acceptance and rollback plan.
CREATE TABLE IF NOT EXISTS qa_canary_once (
 slot TEXT PRIMARY KEY CHECK (slot='ONE'),
 event_hmac TEXT NOT NULL CHECK (length(event_hmac)=64),
 accepted_at_ms INTEGER NOT NULL CHECK (accepted_at_ms>0)
);
-- Only one accepted event across all isolates via slot primary key.
-- For another admission, provision separately authorized fresh disposable QA storage.
-- No original message, sender identity, chat_id, token, or callback URL stored.
