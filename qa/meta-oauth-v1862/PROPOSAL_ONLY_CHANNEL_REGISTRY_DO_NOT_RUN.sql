-- TIEN404 V18.6.2 · SQL PREVIEW ONLY · DO NOT RUN ON ANY DB.
-- BLOCKED: public.stores canonical store authority has NOT been verified. Existing tables
-- use tenant_id without store_id. Resolve canonical store model and memberships first.
-- Proposed private schema, not a second Store/Auth/Commerce implementation.
-- Review with Security and QA before adapting and executing a migration.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private_channel;
CREATE TABLE private_channel.channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  store_id uuid NOT NULL, -- TODO canonical public.stores(id,tenant_id) composite FK
  platform text NOT NULL CHECK (platform IN ('messenger','zalo_oa','zalo_bot','website','telegram')),
  external_page_id text NOT NULL,
  bot_id text,
  status text NOT NULL CHECK (status IN ('pending','connected','reauthorization_required','paused','disconnected','error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_active_external_page ON private_channel.channel_connections(platform, external_page_id)
 WHERE status IN ('pending','connected','reauthorization_required','paused');
CREATE TABLE private_channel.oauth_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), state_sha256 text UNIQUE NOT NULL,
 actor_user_id uuid NOT NULL, auth_session_ref text NOT NULL,
 tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 redirect_path text NOT NULL, status text NOT NULL, expires_at timestamptz NOT NULL,
 consumed_at timestamptz
);
CREATE TABLE private_channel.channel_connection_secrets (
 connection_id uuid PRIMARY KEY REFERENCES private_channel.channel_connections(id) ON DELETE CASCADE,
 encrypted_secret_ref text NOT NULL, rotated_at timestamptz
);
CREATE TABLE private_channel.channel_connection_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, connection_id uuid NOT NULL,
 event_type text NOT NULL, actor_user_id uuid, at timestamptz NOT NULL DEFAULT now(),
 safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE private_channel.channel_health_status (
 connection_id uuid PRIMARY KEY REFERENCES private_channel.channel_connections(id) ON DELETE CASCADE,
 health text NOT NULL, checked_at timestamptz, next_check_at timestamptz
);
ALTER TABLE private_channel.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_channel.oauth_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_channel.channel_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_channel.channel_connection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_channel.channel_health_status ENABLE ROW LEVEL SECURITY;
-- NO client SELECT / INSERT / UPDATE / DELETE grants. Backend service + vetted scoped RPC only.
-- TODO: unique current Page external ID canonicalization and per-platform edge cases.
-- TODO: store composite foreign keys, policy truth table and JWT owner A/B negative QA.
ROLLBACK; -- Documentation-only, no data persisted even if deliberately executed in a scratch DB.
