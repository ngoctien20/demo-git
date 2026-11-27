CREATE TABLE zh_web_stores(
  store_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  challenge_hash TEXT,
  expires_at INTEGER,
  requested_by TEXT,
  connection_id TEXT UNIQUE REFERENCES zh_connections(id),
  epoch INTEGER,
  confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN (0,1))
);
-- Re-pairing and revocation invalidate access while retaining the public shop code.
CREATE TRIGGER zh_web_reset AFTER UPDATE OF owner_epoch,status ON zh_connections
WHEN NEW.owner_epoch<>OLD.owner_epoch OR NEW.status='revoked'
BEGIN
 UPDATE zh_web_stores SET connection_id=NULL,epoch=NULL,confirmed=0,challenge_hash=NULL,
 expires_at=NULL,requested_by=NULL WHERE connection_id=NEW.id;
END;
CREATE TRIGGER zh_web_occupied BEFORE INSERT ON zh_connections
WHEN EXISTS(SELECT 1 FROM zh_web_stores WHERE store_id=NEW.store_id AND confirmed=1)
BEGIN SELECT RAISE(ABORT,'STORE_HAS_LIVE_BOT'); END;
