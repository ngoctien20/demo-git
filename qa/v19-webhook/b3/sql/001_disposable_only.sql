-- TIEN404 V19.0-B3 — OFFLINE / DISPOSABLE SQLite D1 DESIGN ONLY.
-- NEVER apply to an existing Cloudflare D1 or production database without
-- a separate scoped review and explicit user approval.
-- Used by Python's in-memory sqlite3 only in this PR.
CREATE TABLE IF NOT EXISTS v19_b3_rate_windows (
  scope_key TEXT NOT NULL CHECK(length(scope_key)=64),
  window_start_ms INTEGER NOT NULL CHECK(window_start_ms>0),
  hits INTEGER NOT NULL CHECK(hits>=1),
  updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms>0),
  PRIMARY KEY (scope_key,window_start_ms)
);
CREATE TABLE IF NOT EXISTS v19_b3_event_claims (
  scope_key TEXT NOT NULL CHECK(length(scope_key)=64),
  event_key TEXT NOT NULL CHECK(length(event_key)=64),
  payload_key TEXT NOT NULL CHECK(length(payload_key)=64),
  admitted_at_ms INTEGER NOT NULL CHECK(admitted_at_ms>0),
  attempts INTEGER NOT NULL CHECK(attempts>=1),
  state TEXT NOT NULL CHECK(state='QA_ADMITTED_NO_SEND'),
  PRIMARY KEY (scope_key,event_key)
);
CREATE INDEX IF NOT EXISTS v19_b3_events_admitted_at
  ON v19_b3_event_claims (admitted_at_ms);
-- Deliberately no cleanup DELETE or DROP in this candidate.
-- Production TTL/retention and D1 migration are separate approval gates.
