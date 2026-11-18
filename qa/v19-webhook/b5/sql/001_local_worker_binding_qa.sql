-- TIEN404 V19.0-B5, LOCAL workerd/Miniflare D1 only.
-- No deployment. No real providers, no order/customer data, no real Store authority.
-- No production migrations and no Cloudflare D1 REST writes in B5.
CREATE TABLE IF NOT EXISTS v19_b5_qa_inbox (
 scope_key TEXT NOT NULL CHECK(length(scope_key)=64),
 event_key TEXT NOT NULL CHECK(length(event_key)=64),
 payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64),
 fixture_ref TEXT NOT NULL CHECK(fixture_ref GLOB 'QA_FIXTURE_[A-Z0-9_]*' AND length(fixture_ref)<=60),
 status TEXT NOT NULL DEFAULT 'QA_READY_NO_SEND' CHECK(status IN
  ('QA_READY_NO_SEND','QA_LEASED_NO_SEND','QA_RETRY_NO_SEND','QA_DONE_NO_SEND','QA_DLQ_NO_SEND')),
 delivery_observations INTEGER NOT NULL DEFAULT 1 CHECK(delivery_observations>=1),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 max_attempts INTEGER NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 5),
 next_attempt_ms INTEGER NOT NULL DEFAULT 0 CHECK(next_attempt_ms>=0),
 lease_token TEXT,
 lease_until_ms INTEGER,
 created_ms INTEGER NOT NULL CHECK(created_ms>0),
 updated_ms INTEGER NOT NULL CHECK(updated_ms>0),
 last_error_code TEXT,
 PRIMARY KEY(scope_key,event_key),
 CHECK((status='QA_LEASED_NO_SEND') = (lease_token IS NOT NULL AND lease_until_ms IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS v19_b5_qa_inbox_due ON v19_b5_qa_inbox(status,next_attempt_ms,lease_until_ms);
-- No real PII or full event payload; receipt-only stub cannot replay real customer
-- messages. This is intentional: live ingestion stays BLOCKED until an approved
-- encrypted/retained payload contract and true consumer are implemented.
