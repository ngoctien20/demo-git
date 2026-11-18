-- TIEN404 V19.0-B6: LOCAL WORKER BINDING QA ONLY; NEVER RUN ON HOSTED D1.
-- Synthetic fixtures only. NOT a customer payload migration or a billing change.
-- No ALTER/DROP/DELETE of any B2-B5 table. No provider or Commerce access.
CREATE TABLE IF NOT EXISTS v19_b6_qa_encrypted_inbox (
  scope_key TEXT NOT NULL CHECK(length(scope_key)=64),
  event_key TEXT NOT NULL CHECK(length(event_key)=64),
  payload_digest TEXT NOT NULL CHECK(length(payload_digest)=64),
  key_version TEXT NOT NULL CHECK(key_version IN ('QA_K1','QA_K2')),
  iv BLOB NOT NULL CHECK(length(iv)=12),
  encrypted_blob BLOB NOT NULL CHECK(length(encrypted_blob) BETWEEN 17 AND 4096),
  fixture_ref TEXT NOT NULL CHECK(fixture_ref GLOB 'QA_FIXTURE_[A-Z0-9_]*' AND length(fixture_ref)<=60),
  status TEXT NOT NULL DEFAULT 'QA_READY_NO_SEND' CHECK(status IN
    ('QA_READY_NO_SEND','QA_LEASED_NO_SEND','QA_RETRY_NO_SEND','QA_DONE_NO_SEND','QA_DLQ_NO_SEND')),
  observations INTEGER NOT NULL DEFAULT 1 CHECK(observations>=1),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
  next_attempt_ms INTEGER NOT NULL DEFAULT 0 CHECK(next_attempt_ms>=0),
  lease_token TEXT,
  lease_until_ms INTEGER,
  created_ms INTEGER NOT NULL CHECK(created_ms>0),
  updated_ms INTEGER NOT NULL CHECK(updated_ms>0),
  expires_at_ms INTEGER NOT NULL CHECK(expires_at_ms>created_ms AND expires_at_ms<=created_ms+3600000),
  PRIMARY KEY(scope_key,event_key),
  CHECK((status='QA_LEASED_NO_SEND') = (lease_token IS NOT NULL AND lease_until_ms IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS v19_b6_qa_due ON v19_b6_qa_encrypted_inbox(status,next_attempt_ms,lease_until_ms);
-- IMPORTANT: expiry denial is enforced by admission/replay queries. Purge is
-- NOT implemented here; real data deletion/retention requires separate approval.
