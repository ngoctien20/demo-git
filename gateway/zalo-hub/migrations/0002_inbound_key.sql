-- 0002: split the per-shop key in two.
--   forward_key  (existing) = shop flow → hub (/v1/send) and HMAC of forwards. Never sent over the wire by the hub.
--   inbound_key  (new)      = hub → shop flow header x-tien404-inbound-key, for n8n Webhook Header Auth.
-- n8n stores webhook request headers in its execution log, so the header key must not be the send key.
-- Rows with inbound_key_sealed NULL keep the old behaviour until POST /v1/admin/rotate-keys.
ALTER TABLE zh_connections ADD COLUMN inbound_key_sealed TEXT;
