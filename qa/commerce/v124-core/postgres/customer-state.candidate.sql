-- Review-only private Customer schema. CI applies it to an empty, disposable PostgreSQL database.
-- All access defaults to denied. Role provisioning and deployment policies require separate review.
BEGIN;
CREATE SCHEMA tien404_customer_core_qa;
REVOKE ALL ON SCHEMA tien404_customer_core_qa FROM PUBLIC;
CREATE TABLE tien404_customer_core_qa.sessions (
  tenant_key text NOT NULL, store_key text NOT NULL, channel text NOT NULL CHECK (channel = 'qa-fixture'),
  bot_key text NOT NULL, actor_hash text NOT NULL CHECK (actor_hash ~ '^[a-f0-9]{64}$'),
  phase text NOT NULL DEFAULT 'NEW' CHECK (phase IN
    ('NEW','DISCOVERING','PRODUCT_SELECTED','QUOTE_PREVIEW','WAITING_FOR_CUSTOMER','HANDOFF_REQUIRED','CANCELLED','EXPIRED')),
  sku text CHECK (sku ~ '^[A-Z]{1,4}[0-9]{2,5}$'), quantity integer CHECK (quantity BETWEEN 1 AND 9999),
  revision bigint NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL DEFAULT '-infinity',
  rate_until timestamptz NOT NULL DEFAULT '-infinity', turn_count integer NOT NULL DEFAULT 0,
  last_event_at timestamptz, PRIMARY KEY(tenant_key,store_key,channel,bot_key,actor_hash)
);
CREATE TABLE tien404_customer_core_qa.receipts (
  tenant_key text NOT NULL, store_key text NOT NULL, channel text NOT NULL, bot_key text NOT NULL, actor_hash text NOT NULL,
  receipt_hash text NOT NULL CHECK (receipt_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_key,store_key,channel,bot_key,actor_hash,receipt_hash),
  FOREIGN KEY(tenant_key,store_key,channel,bot_key,actor_hash)
    REFERENCES tien404_customer_core_qa.sessions(tenant_key,store_key,channel,bot_key,actor_hash) ON DELETE CASCADE
);
CREATE INDEX customer_receipt_expiry ON tien404_customer_core_qa.receipts(expires_at);
CREATE INDEX customer_session_expiry ON tien404_customer_core_qa.sessions(expires_at);
ALTER TABLE tien404_customer_core_qa.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_customer_core_qa.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_customer_core_qa.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_customer_core_qa.receipts FORCE ROW LEVEL SECURITY;
COMMIT;
