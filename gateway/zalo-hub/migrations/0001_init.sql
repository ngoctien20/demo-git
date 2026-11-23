-- TIEN404 Zalo Hub — Cloudflare D1 schema (PROPOSED, not applied).
-- One row per shop ↔ Zalo bot connection. Secrets are never stored in clear:
--   token_sealed / forward_key_sealed = AES-256-GCM under ZH_MASTER_KEY (Worker secret)
--   wh_secret_hash / pairing_code_hash = SHA-256 hex
-- Rollback: migrations/0001_init.down.sql

CREATE TABLE IF NOT EXISTS zh_connections (
  id                 TEXT PRIMARY KEY,
  store_id           TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('pending_owner','active','needs_reconnect','quota_exceeded','disabled','revoked')),
  bot_id             TEXT NOT NULL,
  bot_name           TEXT,
  token_sealed       TEXT,
  token_last4        TEXT,
  key_version        INTEGER NOT NULL DEFAULT 1,
  path_id            TEXT NOT NULL UNIQUE,
  wh_secret_hash     TEXT NOT NULL,
  forward_url        TEXT NOT NULL,
  forward_key_sealed TEXT,
  pairing_code_hash  TEXT,
  pairing_expires_at INTEGER,
  pairing_attempts   INTEGER NOT NULL DEFAULT 0,
  owner_chat_id      TEXT,
  sent_month         TEXT,
  sent_count         INTEGER NOT NULL DEFAULT 0,
  connected_at       INTEGER NOT NULL,
  revoked_at         INTEGER,
  last_ok_at         INTEGER,
  updated_at         INTEGER NOT NULL
);

-- A bot can be live for only one shop, and a shop has at most one live Zalo bot.
CREATE UNIQUE INDEX IF NOT EXISTS zh_connections_live_bot
  ON zh_connections (bot_id) WHERE status <> 'revoked';
CREATE UNIQUE INDEX IF NOT EXISTS zh_connections_live_store
  ON zh_connections (store_id) WHERE status <> 'revoked';

-- Users who have written to the bot (Zalo Basic plan counts them; also the allowlist for /v1/send).
CREATE TABLE IF NOT EXISTS zh_seen_users (
  connection_id TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  PRIMARY KEY (connection_id, user_id)
);

-- Inbound de-duplication by Zalo message_id.
CREATE TABLE IF NOT EXISTS zh_inbound_seen (
  connection_id TEXT NOT NULL,
  message_id    TEXT NOT NULL,
  seen_at       INTEGER NOT NULL,
  PRIMARY KEY (connection_id, message_id)
);
