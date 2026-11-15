-- TIEN404 AI V14.5Z-G2.2 — NEW ISOLATED Cloudflare D1 QA DATABASE ONLY.
-- Never apply to Supabase/public schemas or production databases.
-- No personal/customer data or raw Bot Token/ID stored.
CREATE TABLE IF NOT EXISTS g22_trusted_bot_candidates (
  binding_id TEXT PRIMARY KEY CHECK (binding_id = 'G22_QA_SHOP_B_PROVIDER_CANDIDATE_V1'),
  provider TEXT NOT NULL CHECK (provider = 'zalo_bot_creator'),
  bot_digest TEXT NOT NULL CHECK (length(bot_digest) = 64),
  challenge_hex TEXT NOT NULL CHECK (length(challenge_hex) = 64),
  tenant_uuid TEXT NOT NULL,
  tenant_slug TEXT NOT NULL CHECK (tenant_slug = 'qa-staging-shop-b-20261110'),
  store_key TEXT NOT NULL CHECK (store_key = 'qa-store-b'),
  source TEXT NOT NULL CHECK (source = 'SERVER_VERIFIED_QA_TENANT'),
  status TEXT NOT NULL CHECK (status IN ('CANDIDATE', 'REVOKED')),
  owner_certified INTEGER NOT NULL DEFAULT 0 CHECK (owner_certified = 0),
  observed_ms INTEGER NOT NULL,
  created_ms INTEGER NOT NULL,
  expires_ms INTEGER NOT NULL,
  UNIQUE (provider, bot_digest, challenge_hex)
);
CREATE INDEX IF NOT EXISTS idx_g22_candidate_status_expiry
  ON g22_trusted_bot_candidates (status, expires_ms);
-- No public write endpoint. Candidate row insertion requires trusted Cloudflare Admin API
-- after verifying an actual signed provider getMe proof and Supabase QA Shop B tenant.
-- NEVER set owner_certified to 1 in this table; G2.3 uses independent signed authority.
