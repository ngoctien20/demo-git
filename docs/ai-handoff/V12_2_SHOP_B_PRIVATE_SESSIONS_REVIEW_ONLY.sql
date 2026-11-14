-- TIEN404 AI V12.2 — PRIVATE SHOP B CONVERSATION SESSION STORAGE CANDIDATE
-- *** REVIEW ONLY. NOT APPLIED to Supabase staging or production. ***
-- Purpose: atomic session/receipt/idempotent confirmation on private server.
-- Before apply: owner approves migration, verified database backup/restore,
-- independent A/B tenant auth negative tests, grants/secret review.
--
-- This SQL creates isolated tables ONLY, never modifies
-- tien404_r1_qa.catalog, sandbox_orders, owner_outbox, owner_bindings,
-- published Zalo webhook or AI_SALES_DEMO/Commerce data.
--
-- App must NEVER pass client-controlled tenant/store/recipient to write APIs.
-- Derive scope from authenticated Zalo webhook + validated owner binding.

BEGIN;

CREATE SCHEMA IF NOT EXISTS tien404_dialogue_private;
REVOKE ALL ON SCHEMA tien404_dialogue_private FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA tien404_dialogue_private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS tien404_dialogue_private.shop_b_sessions (
  scope_key text PRIMARY KEY
    CHECK (scope_key ~ '^[a-f0-9]{64}$'),
  tenant_key text NOT NULL CHECK (tenant_key = 'qa-tenant-b'),
  store_key text NOT NULL CHECK (store_key = 'qa-store-b'),
  bot_key text NOT NULL CHECK (bot_key = 'qa-bot-b'),
  binding_fingerprint text NOT NULL CHECK (length(binding_fingerprint) BETWEEN 8 AND 128),
  phase text NOT NULL DEFAULT 'idle'
    CHECK (phase IN ('idle','viewing','await_quantity','await_confirmation','commit_pending')),
  sku text CHECK (sku IS NULL OR sku = 'F01'),
  quantity integer CHECK (quantity IS NULL OR quantity BETWEEN 1 AND 100),
  expected_total_vnd bigint CHECK (expected_total_vnd IS NULL OR expected_total_vnd > 0),
  confirmation_hash text CHECK (confirmation_hash IS NULL OR confirmation_hash ~ '^[a-f0-9]{64}$'),
  quote_expires_at timestamptz,
  order_key text CHECK (order_key IS NULL OR order_key ~ '^QA-B-[A-F0-9]{24}$'),
  idempotency_key text CHECK (idempotency_key IS NULL OR idempotency_key ~ '^[a-f0-9]{64}$'),
  session_ref text CHECK (session_ref IS NULL OR session_ref ~ '^qa-session-[a-f0-9]{24}$'),
  expires_at timestamptz NOT NULL,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    phase <> 'await_confirmation' OR (
      sku='F01' AND quantity IS NOT NULL AND expected_total_vnd IS NOT NULL
      AND confirmation_hash IS NOT NULL AND quote_expires_at IS NOT NULL
      AND order_key IS NOT NULL AND idempotency_key IS NOT NULL
      AND session_ref IS NOT NULL
    )
  ),
  CHECK (expires_at > '2026-01-01'::timestamptz)
);

CREATE TABLE IF NOT EXISTS tien404_dialogue_private.shop_b_receipts (
  scope_key text NOT NULL
    REFERENCES tien404_dialogue_private.shop_b_sessions(scope_key) ON DELETE CASCADE,
  event_hash text NOT NULL CHECK (event_hash ~ '^[a-f0-9]{64}$'),
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_key,event_hash)
);

CREATE INDEX IF NOT EXISTS shop_b_sessions_expiry_idx
  ON tien404_dialogue_private.shop_b_sessions(expires_at);
CREATE INDEX IF NOT EXISTS shop_b_receipts_expiry_idx
  ON tien404_dialogue_private.shop_b_receipts(observed_at);

ALTER TABLE tien404_dialogue_private.shop_b_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_dialogue_private.shop_b_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA tien404_dialogue_private
  FROM PUBLIC, anon, authenticated;

-- No RLS client policies and no exposed RPC functions.
-- RLS without policy intentionally fails closed for client roles.
-- Grant only to a dedicated trusted database executor after review.

COMMIT;

-- BACKEND TRANSACTION CONTRACT (illustrative SQL, NOT a runnable function):
--
-- BEGIN;
-- (A) Verify the caller's service identity, HMAC webhook and current
--     tenant+store+bot binding OUTSIDE SQL with server-held keys.
-- (B) INSERT INTO tien404_dialogue_private.shop_b_sessions
--       (scope_key,tenant_key,store_key,bot_key,binding_fingerprint,expires_at)
--     VALUES (:scope_key,'qa-tenant-b','qa-store-b','qa-bot-b',
--       :current_binding_fingerprint,:max_expiry)
--     ON CONFLICT (scope_key) DO NOTHING;
-- (C) SELECT * FROM tien404_dialogue_private.shop_b_sessions
--     WHERE scope_key=:scope_key FOR UPDATE;
--     -- The row lock serializes all turns and confirmation attempts per Owner/binding.
-- (D) Validate binding fingerprint and expires_at AGAIN with current
--     tien404_r1_qa.owner_bindings + owner_pairing_claims_v3.
-- (E) SELECT sku,product_name,price_vnd,stock
--     FROM tien404_r1_qa.catalog
--     WHERE (tenant_key,store_key,bot_key,sku)=
--           ('qa-tenant-b','qa-store-b','qa-bot-b','F01') FOR SHARE;
--     -- Revalidate price & stock for EACH turn and again before Order commit.
-- (F) INSERT INTO tien404_dialogue_private.shop_b_receipts(scope_key,event_hash)
--     VALUES (:scope_key,:event_hash)
--     ON CONFLICT DO NOTHING RETURNING event_hash;
--     -- 0 rows = duplicate; return no reply/no proposed order.
-- (G) UPDATE shop_b_sessions SET phase=:phase,...,revision=revision+1
--     WHERE scope_key=:scope_key AND revision=:observed_revision;
--     -- Verify exactly one row updated. Persist only challenge hash,
--     -- never plaintext confirmation code, raw chat ID, customer phone or address.
-- COMMIT;
--
-- Commit proposal after explicit confirmation is a SEPARATE approval gate;
-- never automatically call tien404_r1_qa.commit_order_qa until positive
-- authorized binding, fresh catalog readback, order idempotency and RLS QA.
--
-- CAUTION: A transient lock in a single in-memory Node test is NOT evidence
-- of PostgreSQL transaction isolation, tenant RLS or delivery exactly-once.
-- Required: concurrent SQL sessions, rollback injection tests, denied anon /
-- authenticated access, cross-tenant and stale re-pair negative cases,
-- backup + restore rehearsal and approval.
