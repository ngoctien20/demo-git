-- Candidate migration; 0003 is reserved for the parallel care-controls change (#516).
-- Apply on isolated QA D1 first. No existing customer values are rewritten.
ALTER TABLE zh_connections ADD COLUMN owner_user_id TEXT;
ALTER TABLE zh_connections ADD COLUMN owner_epoch INTEGER NOT NULL DEFAULT 0;

-- Conversation ids and user ids are distinct in the provider contract.
CREATE TABLE IF NOT EXISTS zh_seen_chats (
  connection_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  PRIMARY KEY(connection_id, chat_id)
);

-- Data belongs to a connection, store and pairing epoch. A new pairing cannot
-- silently reuse data or in-flight replies belonging to the previous owner.
CREATE TABLE IF NOT EXISTS zh_lite_catalog (
  connection_id TEXT PRIMARY KEY REFERENCES zh_connections(id),
  store_id TEXT NOT NULL,
  owner_epoch INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  snapshot TEXT NOT NULL CHECK(json_valid(snapshot) AND length(snapshot) <= 32000),
  updated_at INTEGER NOT NULL
);

-- Quotas reserve a slot before an inference. Unknown provider outcomes are not retried.
CREATE TABLE IF NOT EXISTS zh_lite_ai_usage (
  scope TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0 CHECK(n >= 0),
  PRIMARY KEY(scope, day)
);

-- Metadata only: no message text, tokens, prices, phone or customer identifiers.
CREATE TABLE IF NOT EXISTS zh_lite_delivery (
  connection_id TEXT NOT NULL REFERENCES zh_connections(id),
  message_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  PRIMARY KEY(connection_id, message_id)
);
