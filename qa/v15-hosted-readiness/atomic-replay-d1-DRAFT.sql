-- TIEN404 V15.0-03H — D1 ATOMIC REPLAY STORE MIGRATION DRAFT ONLY
-- NOT APPLIED. No REAL Meta/Zalo events or customer data.
-- Requires dedicated QA DB, backup, review, approved schema migration, and
-- transactional reserve/consume-once handler before hosted promotion.
CREATE TABLE IF NOT EXISTS v1503h_nonce_reservations_qa (
  scope_hash TEXT NOT NULL CHECK(length(scope_hash)=64),
  nonce_digest TEXT NOT NULL CHECK(length(nonce_digest)=64),
  event_digest TEXT NOT NULL CHECK(length(event_digest)=64),
  created_ms INTEGER NOT NULL,
  expires_ms INTEGER NOT NULL CHECK(expires_ms>created_ms),
  producer TEXT NOT NULL CHECK(producer IN ('V15_QA_CHANNEL_FIXTURE','V15_QA_TENANT_FIXTURE')),
  PRIMARY KEY(scope_hash,nonce_digest)
);
CREATE INDEX IF NOT EXISTS idx_v1503h_nonce_expiry
 ON v1503h_nonce_reservations_qa(expires_ms);
-- The separate hosted implementation MUST use a single atomic insert:
--   INSERT INTO v1503h_nonce_reservations_qa(...)
--   VALUES(...);
-- A UNIQUE/PRIMARY KEY conflict is a replay => reject. Do not read-then-insert.
-- No API to client for clearing or restarting a nonce; do not silently
-- convert sqlite errors into success or couple this QA schema to commerce DB.
-- Retention and cleanup must be reviewed before any live traffic.
