-- TIEN404 V13.6M.6 — Security gate / HMAC rotation / retention
-- REVIEW ONLY. NOT A MIGRATION. NEVER execute on Supabase staging or production.
-- Actual PostgreSQL schema is unapproved and missing in staging.
DO $t404_m6$
BEGIN
  RAISE EXCEPTION 'TIEN404_V13_6M6_HOSTED_MIGRATION_NOT_APPROVED';
END
$t404_m6$;

-- PROPOSED READ-ONLY AUDIT, for separate approved manual review ONLY:
-- SELECT to_regclass('public.stores'), to_regclass('public.store_memberships'),
--        to_regclass('app_private.messenger_page_bindings'),
--        to_regclass('app_private.messenger_event_claims');
-- SQL role must be non-owner / NO BYPASSRLS with externally verified grants;
-- never infer RLS from service_role or JavaScript driver assertions.
--
-- FUTURE VERSIONED HMAC IDEMPOTENCY CONTRACT (NO DDL):
-- 1. Key vault, key_id and active/retiring versions are private and server-only.
--    No raw PSID, Page access token, message text or HMAC keys in DB rows.
-- 2. During rotation, atomic matching MUST read old and new HMAC variants
--    inside ONE transaction/serialized logical claim. A naive SELECT-then-INSERT
--    in separate transactions creates a duplicate race.
-- 3. A manifest epoch must prevent mixed old-only and new-only workers.
--    Either fail closed or use a database-enforced stable canonical event key.
-- 4. On retiring a key, prevent new claims until the previous key coverage and
--    dedupe history are proven. Never delete old key just because it is old.
-- 5. Allow a lease-controlled CLAIMED -> PREVIEW_READY / REJECTED transition
--    only. Never finalize SENT or order mutation without separate approval.
--
-- FUTURE RETENTION / PRIVACY CONTRACT (NO DELETE):
-- 6. Deletion of historical UNIQUE rows allows replays of old events. Preserve
--    verified tombstones / uniqueness horizon with separate audit and QA.
-- 7. Do not delete CLAIMED, pending-outbox, legal-hold, unknown-status rows.
-- 8. Default retention policy for *planning only*: >= 30 days (not a legal
--    retention period determination). Privacy/legal/business policy requires
--    separate owner review. No automatic pruning, cron, or migration here.
--
-- HOSTED P0 RELEASE GATES (ALL REQUIRED):
-- 9. Restorable backup and tested rollback; V14.2 canonical Store RLS; real
--    Shop A/B negative tests; private Page ownership validation; restricted
--    DB role session checks; verified Data API exposure and grants.
-- 10. Real PostgreSQL unique-claim concurrency across worker restarts,
--     transaction faults, rotating keys, retention/tombstones and lease races.
-- 11. Provider Send API, Page token, and any outbox/delivery remain DISABLED.
-- 12. No executable CREATE/ALTER/GRANT/REVOKE/INSERT/UPDATE/DELETE statements
--     in this file. This is a security design note, not a deployable migration.
