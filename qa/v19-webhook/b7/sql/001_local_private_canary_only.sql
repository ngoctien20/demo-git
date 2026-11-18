-- TIEN404 V19.0-B7 / LOCAL MINIFLARE D1 ONLY.
-- Not hosted D1 migration, no provider callback, no real operator credentials.
CREATE TABLE IF NOT EXISTS v19_b7_qa_caller_nonces (
  caller_scope TEXT NOT NULL CHECK(length(caller_scope)=64),
  nonce_hash TEXT NOT NULL CHECK(length(nonce_hash)=64),
  approved_fixture TEXT NOT NULL CHECK(approved_fixture='SYNTHETIC_PROTECTED_D1_ONLY'),
  claimed_at_ms INTEGER NOT NULL CHECK(claimed_at_ms>0),
  PRIMARY KEY(caller_scope,nonce_hash)
);
-- No DELETE/DROP; no recipient, store, order or customer data stored.
