-- TIEN404 V13.6M.4 — REVIEW ONLY. THIS IS NOT A MIGRATION.
-- There is NO approved durable replay table or Meta send/outbox authorization.
-- Any attempt to execute this artifact MUST fail before data/schema writes.
DO $t404$
BEGIN
  RAISE EXCEPTION 'TIEN404_V136M4_DURABLE_REPLAY_SCHEMA_NOT_APPROVED';
END
$t404$;

-- Future owner-approved migration requirements (documentation only):
-- 1. Keep schema in an explicitly private, non-Data-API-exposed namespace.
-- 2. Canonical store ownership must be verified first (V14.2 migration gate).
-- 3. Event identity derives from VERIFIED Page + PSID + Meta MID or hashed fallback.
-- 4. UNIQUE (tenant_id, store_id, page_id, sender_hash, binding_version, event_hash)
--    with robust conflict handling across retries/process restarts.
-- 5. Atomic INSERT/ON CONFLICT DO NOTHING RETURNING guarded by scoped identity,
--    with race tests on real PostgreSQL and safety on transaction rollback.
-- 6. Persist outcome state (claimed/processed/rejected), timestamps and expiry.
-- 7. Do NOT expose raw PSIDs, customer text, Page secrets, signed payloads or tokens
--    to frontend, log output, error codes or public API.
-- 8. Replay reservation MUST NOT authorize an order write or Meta Send API call.
-- 9. If full outbox is proposed, use a distinct, separately approved transaction:
--    verified saved order/event -> single outbox row -> sender worker gated by policy.
-- 10. Audit private DB role: least privilege, non-BYPASSRLS, correct transaction
--     guarantees and per-store isolation (including SAME-TENANT stores).
-- This file intentionally contains ZERO CREATE/ALTER/INSERT/UPDATE/DELETE statements
-- to prevent accidental deployment. No existing schema is modified.
