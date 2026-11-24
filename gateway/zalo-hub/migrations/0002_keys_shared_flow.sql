-- 0002 (not applied yet anywhere).
-- 1) Split the per-shop key in two.
--   forward_key  (existing) = shop flow → hub (/v1/send) and HMAC of forwards. Never sent over the wire by the hub.
--   inbound_key  (new)      = hub → shop flow header x-tien404-inbound-key, for n8n Webhook Header Auth.
--   n8n stores webhook request headers in its execution log, so the header key must not be the send key.
--   Rows with inbound_key_sealed NULL keep the old behaviour until POST /v1/admin/rotate-keys.
-- 2) flow_mode: 'own'    = the shop has its own flow (forward_url + per-shop keys, e.g. the QA bot).
--               'shared' = connected by the owner from the App; events go to the one shared TIEN404 flow
--                          (ZH_SHARED_FORWARD_URL) authenticated with hub-level secrets, so no key is ever
--                          shown to or pasted by the shop owner. Validated in code (no CHECK: keeps DROP COLUMN possible).
ALTER TABLE zh_connections ADD COLUMN inbound_key_sealed TEXT;
ALTER TABLE zh_connections ADD COLUMN flow_mode TEXT NOT NULL DEFAULT 'own';
-- 3) Lite replies: Bot TIEN404 AI answers the owner who typed "nối bot" (hub holds that bot's token as a secret).
--    Per user per UTC day counter, so a leaked ZH_LITE_KEY cannot turn the system bot into a spammer.
CREATE TABLE IF NOT EXISTS zh_lite_replies (
  day          TEXT NOT NULL,
  zalo_user_id TEXT NOT NULL,
  n            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, zalo_user_id)
);
