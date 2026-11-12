-- TIEN404 V11.5 / Notification Engine V5 — REVIEW-ONLY SQL CANDIDATE
-- NOT APPLIED to Supabase staging/production. No grants to anon/authenticated.
-- Integrator must review ownership, AUTH architecture, service role and DB migrations.
BEGIN;

CREATE SCHEMA IF NOT EXISTS notification_private;
REVOKE ALL ON SCHEMA notification_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS notification_private.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  merchant_id uuid NOT NULL,
  source_system text NOT NULL CHECK (length(source_system) BETWEEN 2 AND 64),
  source_receipt_ref text NOT NULL,
  order_id uuid NOT NULL,
  order_version integer NOT NULL CHECK (order_version >= 1),
  event_type text NOT NULL CHECK (event_type IN ('order_created')),
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version = 1),
  event_id text NOT NULL,
  saved_order_verified boolean NOT NULL DEFAULT false CHECK (saved_order_verified),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_id),
  UNIQUE (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS notification_private.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('zalo','telegram','gmail','messenger','dashboard')),
  recipient_ref_ciphertext bytea,
  recipient_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sending','accepted','failed','needs_review','blocked','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  provider_message_id text,
  last_error_code text,
  claim_token uuid,
  claimed_at timestamptz,
  next_retry_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (event_id, tenant_id)
    REFERENCES notification_private.notification_events(id, tenant_id),
  UNIQUE (tenant_id, event_id, channel)
);
CREATE INDEX IF NOT EXISTS notification_outbox_queued
  ON notification_private.notification_outbox (next_retry_at, created_at)
  WHERE status = 'queued';

ALTER TABLE notification_private.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_private.notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA notification_private FROM PUBLIC, anon, authenticated;

COMMIT;

-- PSEUDOCODE FOR TRUSTED WORKER ONLY (run within a transaction, no public RPC):
-- 1. BEGIN; validate source order under authenticated tenant-scoped backend permission;
-- 2. INSERT events ... ON CONFLICT (tenant_id,event_id) DO NOTHING;
-- 3. INSERT distinct outbox channel rows, ON CONFLICT DO NOTHING; COMMIT.
-- 4. Claim a row using SELECT ... FOR UPDATE SKIP LOCKED, then UPDATE
--    status='sending', attempts=attempts+1, claim_token=gen_random_uuid()
--    RETURNING id,claim_token (same transaction).
-- 5. Return provider ACK and UPDATE status='accepted' with matching claim_token.
-- 6. On ambiguous timeout, status='needs_review'; DO NOT blind retry.
-- 7. Every operation must assert tenant and scoped merchant/store ownership.
-- 8. No guarantee of external exactly-once if provider lacks idempotency.

-- RELEASE GATES: two independent signed Auth tenants A/B, transaction-concurrency
-- tests, backup/restore, PII encryption plan, RLS/security advisor review,
-- provider policy/cost approval and owner approval. No production activation.
