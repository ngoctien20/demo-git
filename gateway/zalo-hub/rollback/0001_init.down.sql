-- Rollback for 0001_init.sql. Run only after every bot's webhook has been moved away (POST /v1/admin/disconnect).
DROP TABLE IF EXISTS zh_inbound_seen;
DROP TABLE IF EXISTS zh_seen_users;
DROP INDEX IF EXISTS zh_connections_live_store;
DROP INDEX IF EXISTS zh_connections_live_bot;
DROP TABLE IF EXISTS zh_connections;
