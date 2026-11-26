-- CANDIDATE: apply only to isolated QA D1 before release approval.
-- Data belongs to a single connection AND store; reconnect does not inherit old data.
CREATE TABLE IF NOT EXISTS zh_lite_catalog (
  connection_id TEXT PRIMARY KEY REFERENCES zh_connections(id),
  store_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  snapshot TEXT NOT NULL CHECK(length(snapshot) <= 32000),
  updated_at INTEGER NOT NULL
);
