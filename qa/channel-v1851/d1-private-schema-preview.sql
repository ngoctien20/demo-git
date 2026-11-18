-- TIEN404 V18.5.1: D1 REFERENCE SCHEMA ONLY.
-- NEVER APPLIED. No real store/customer/order rows or secrets included.
-- Host and D1 creation require independent explicit approval.
-- The browser must NEVER write to these tables or submit tenant/store authority.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS qa_widget_installations (
  widget_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('PLATFORM_CONSULTANT','MERCHANT_SANDBOX')),
  install_version INTEGER NOT NULL CHECK(install_version > 0),
  status TEXT NOT NULL CHECK(status IN ('RELEASED','REVOKED','DRAFT')),
  allowed_origin TEXT NOT NULL,
  domain_verified_at_ms INTEGER,
  domain_verified_until_ms INTEGER,
  subscription_active INTEGER NOT NULL CHECK(subscription_active IN (0,1)),
  shop_active INTEGER NOT NULL CHECK(shop_active IN (0,1)),
  approved_at_ms INTEGER,
  revoked_at_ms INTEGER,
  updated_at_ms INTEGER NOT NULL,
  CHECK(domain_verified_until_ms IS NULL OR
        domain_verified_until_ms >= COALESCE(domain_verified_at_ms,0))
);
CREATE INDEX IF NOT EXISTS qa_widget_install_scope
ON qa_widget_installations(tenant_id,store_id,widget_id,status);

CREATE TABLE IF NOT EXISTS qa_widget_event_claims (
  -- Server-derived HMAC of store, install, signed session and event ID.
  -- No raw JWT, message, phone, PSID, IP address or order data.
  event_digest TEXT PRIMARY KEY CHECK(length(event_digest)=64),
  widget_id TEXT NOT NULL REFERENCES qa_widget_installations(widget_id),
  expires_at_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS qa_widget_event_expiry
ON qa_widget_event_claims(expires_at_ms);

CREATE TABLE IF NOT EXISTS qa_widget_quota_buckets (
  -- Server-derived private namespace: widget + operation + time bucket.
  -- Atomic single-statement UPDATE/INSERT only; no read-then-write race.
  bucket_digest TEXT PRIMARY KEY CHECK(length(bucket_digest)=64),
  widget_id TEXT NOT NULL REFERENCES qa_widget_installations(widget_id),
  operation TEXT NOT NULL CHECK(operation IN ('SESSION_OPEN','PUBLIC_PREVIEW')),
  bucket_start_ms INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  expires_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS qa_widget_quota_expiry
ON qa_widget_quota_buckets(expires_at_ms);

-- Proposed atomic replay claim (D1 prepared statement, check meta.changes=1):
-- INSERT OR IGNORE INTO qa_widget_event_claims
--  (event_digest, widget_id, expires_at_ms, created_at_ms)
-- VALUES (?1, ?2, ?3, ?4);
-- Duplicate digest => meta.changes == 0 => deny. Retention must exceed the
-- maximum possible signed-session validity and clock drift; no early delete.

-- Proposed atomic bucket admission (D1 prepared, check returned row):
-- INSERT INTO qa_widget_quota_buckets
--   (bucket_digest,widget_id,operation,bucket_start_ms,count,expires_at_ms)
-- VALUES (?1,?2,?3,?4,1,?5)
-- ON CONFLICT(bucket_digest) DO UPDATE SET
--   count=qa_widget_quota_buckets.count+1
-- WHERE qa_widget_quota_buckets.count < ?6
-- RETURNING count;
-- No returned row => quota exceeded => deny. This must run in a shared
-- durable database, NEVER per-Worker memory or a public JS data structure.
